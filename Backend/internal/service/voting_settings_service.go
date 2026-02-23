package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"votingsystem/internal/repository"

	"github.com/redis/go-redis/v9"
)

const votingSettingsRedisKey = "voting:settings"

// cachedSettings is the shape stored in Redis as JSON.
type cachedSettings struct {
	IsOpen bool       `json:"is_open"`
	EndsAt *time.Time `json:"ends_at"` // UTC, nil = no auto-stop
}

// VotingSettingsService manages voting state with Redis as a cache in front of MariaDB.
// Cache is invalidated whenever UpdateSettings is called.
type VotingSettingsService struct {
	repo  *repository.VotingSettingsRepository
	redis *redis.Client
}

// NewVotingSettingsService creates a new VotingSettingsService.
func NewVotingSettingsService(repo *repository.VotingSettingsRepository, redis *redis.Client) *VotingSettingsService {
	return &VotingSettingsService{repo: repo, redis: redis}
}

// GetStatus returns the current is_open flag and optional auto-stop time (UTC).
// It reads from Redis first; on miss, falls back to MariaDB and re-populates the cache.
func (s *VotingSettingsService) GetStatus(ctx context.Context) (isOpen bool, endsAt *time.Time, err error) {
	cached, err := s.fromRedis(ctx)
	if err == nil {
		return cached.IsOpen, cached.EndsAt, nil
	}

	// Cache miss — read from DB
	isOpen, endsAt, err = s.repo.GetSettings()
	if err != nil {
		return false, nil, err
	}

	// Populate cache (no TTL — only invalidated on UpdateSettings)
	_ = s.toRedis(ctx, isOpen, endsAt)
	return isOpen, endsAt, nil
}

// IsVotingOpen returns true only when is_open=true AND ends_at has not passed yet (UTC).
func (s *VotingSettingsService) IsVotingOpen(ctx context.Context) (bool, error) {
	isOpen, endsAt, err := s.GetStatus(ctx)
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

// UpdateSettings persists new settings to MariaDB and invalidates the Redis cache.
// endsAt must be in UTC (or nil to clear auto-stop).
func (s *VotingSettingsService) UpdateSettings(ctx context.Context, isOpen bool, endsAt *time.Time) error {
	if err := s.repo.UpdateSettings(isOpen, endsAt); err != nil {
		return err
	}
	// Invalidate cache so the next read pulls fresh data from DB
	if err := s.redis.Del(ctx, votingSettingsRedisKey).Err(); err != nil {
		slog.Warn("Failed to invalidate voting settings cache", "error", err)
	}
	// Eagerly re-populate so the very next request is fast
	_ = s.toRedis(ctx, isOpen, endsAt)
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

func (s *VotingSettingsService) toRedis(ctx context.Context, isOpen bool, endsAt *time.Time) error {
	cs := cachedSettings{IsOpen: isOpen, EndsAt: endsAt}
	raw, err := json.Marshal(cs)
	if err != nil {
		return err
	}
	// No TTL — the cache is explicitly invalidated on every UpdateSettings call.
	// This avoids any thundering-herd on expiry while keeping data consistent.
	return s.redis.Set(ctx, votingSettingsRedisKey, raw, 0).Err()
}
