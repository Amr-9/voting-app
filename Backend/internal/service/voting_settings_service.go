package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"votingsystem/internal/repository"
	"votingsystem/internal/ws"

	"github.com/redis/go-redis/v9"
)

const votingSettingsRedisKey = "voting:settings"

// cachedSettings is the shape stored in Redis as JSON.
type cachedSettings struct {
	IsOpen            bool       `json:"is_open"`
	EndsAt            *time.Time `json:"ends_at"`             // UTC, nil = no auto-stop
	CustomDomainsOnly bool       `json:"custom_domains_only"` // true = ignore built-in 94 providers
}

// VotingSettingsService manages voting state with Redis as a cache in front of MariaDB.
// Cache is invalidated whenever UpdateSettings or UpdateCustomDomainsOnly is called.
// When hub and candidateRepo are provided, a full WS broadcast is triggered on every
// settings change so all connected clients learn the new open/closed state immediately.
type VotingSettingsService struct {
	repo          *repository.VotingSettingsRepository
	redis         *redis.Client
	hub           *ws.Hub
	candidateRepo *repository.CandidateRepository
}

// NewVotingSettingsService creates a new VotingSettingsService.
// hub and candidateRepo are optional (pass nil to skip WS broadcasts).
func NewVotingSettingsService(
	repo *repository.VotingSettingsRepository,
	redis *redis.Client,
	hub *ws.Hub,
	candidateRepo *repository.CandidateRepository,
) *VotingSettingsService {
	return &VotingSettingsService{repo: repo, redis: redis, hub: hub, candidateRepo: candidateRepo}
}

// GetStatus returns the current settings: is_open flag, optional auto-stop time (UTC),
// and whether only custom domains are allowed.
// It reads from Redis first; on miss, falls back to MariaDB and re-populates the cache.
func (s *VotingSettingsService) GetStatus(ctx context.Context) (isOpen bool, endsAt *time.Time, customDomainsOnly bool, err error) {
	cached, err := s.fromRedis(ctx)
	if err == nil {
		return cached.IsOpen, cached.EndsAt, cached.CustomDomainsOnly, nil
	}

	// Cache miss — read all three values from DB
	isOpen, endsAt, customDomainsOnly, err = s.repo.GetSettings()
	if err != nil {
		return false, nil, false, err
	}

	// Populate cache (no TTL — only invalidated on updates)
	_ = s.toRedis(ctx, isOpen, endsAt, customDomainsOnly)
	return isOpen, endsAt, customDomainsOnly, nil
}

// IsVotingOpen returns true only when is_open=true AND ends_at has not passed yet (UTC).
func (s *VotingSettingsService) IsVotingOpen(ctx context.Context) (bool, error) {
	isOpen, endsAt, _, err := s.GetStatus(ctx)
	if err != nil {
		return false, err
	}
	if !isOpen {
		return false, nil
	}
	if endsAt != nil && time.Now().UTC().After(*endsAt) {
		return false, nil
	}
	return true, nil
}

// GetCustomDomainsOnly returns whether only custom domains are accepted (ignoring built-in list).
func (s *VotingSettingsService) GetCustomDomainsOnly(ctx context.Context) (bool, error) {
	_, _, customDomainsOnly, err := s.GetStatus(ctx)
	return customDomainsOnly, err
}

// UpdateSettings persists new is_open and ends_at to MariaDB, invalidates the Redis cache,
// and broadcasts the updated state to all connected WebSocket clients.
// endsAt must be in UTC (or nil to clear auto-stop). Does not modify custom_domains_only.
func (s *VotingSettingsService) UpdateSettings(ctx context.Context, isOpen bool, endsAt *time.Time) error {
	if err := s.repo.UpdateSettings(isOpen, endsAt); err != nil {
		return err
	}
	// Invalidate cache — next read will pull all fields fresh from DB
	if err := s.redis.Del(ctx, votingSettingsRedisKey).Err(); err != nil {
		slog.Warn("Failed to invalidate voting settings cache", "error", err)
	}

	// Broadcast new state to all connected WebSocket clients immediately.
	if s.hub != nil && s.candidateRepo != nil {
		data, err := BuildWSPayload(ctx, s.candidateRepo, s)
		if err != nil {
			slog.Warn("Failed to build WS payload after settings update", "error", err)
		} else {
			s.hub.Broadcast <- data
			slog.Info("Voting settings updated and broadcasted via WebSocket", "is_open", isOpen)
		}
	}

	return nil
}

// UpdateCustomDomainsOnly sets the custom_domains_only flag and invalidates the Redis cache.
func (s *VotingSettingsService) UpdateCustomDomainsOnly(ctx context.Context, value bool) error {
	if err := s.repo.UpdateCustomDomainsOnly(value); err != nil {
		return err
	}
	// Invalidate cache — next read will pull all fields fresh from DB
	if err := s.redis.Del(ctx, votingSettingsRedisKey).Err(); err != nil {
		slog.Warn("Failed to invalidate voting settings cache after domain mode update", "error", err)
	}
	slog.Info("custom_domains_only updated", "value", value)
	return nil
}

// ── private helpers ─────────────────────────────────────────────────────────

func (s *VotingSettingsService) fromRedis(ctx context.Context) (*cachedSettings, error) {
	raw, err := s.redis.Get(ctx, votingSettingsRedisKey).Result()
	if err != nil {
		return nil, err
	}
	var cs cachedSettings
	if err := json.Unmarshal([]byte(raw), &cs); err != nil {
		return nil, err
	}
	return &cs, nil
}

func (s *VotingSettingsService) toRedis(ctx context.Context, isOpen bool, endsAt *time.Time, customDomainsOnly bool) error {
	cs := cachedSettings{IsOpen: isOpen, EndsAt: endsAt, CustomDomainsOnly: customDomainsOnly}
	raw, err := json.Marshal(cs)
	if err != nil {
		return err
	}
	return s.redis.Set(ctx, votingSettingsRedisKey, raw, 0).Err()
}
