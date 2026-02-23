package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimitService uses Redis to enforce a per-IP limit on OTP requests.
type RateLimitService struct {
	redis   *redis.Client
	maxReqs int
	window  time.Duration
}

// NewRateLimitService creates a new RateLimitService.
// maxReqs is the maximum number of allowed requests per IP within the window duration.
func NewRateLimitService(redis *redis.Client, maxReqs int) *RateLimitService {
	return &RateLimitService{
		redis:   redis,
		maxReqs: maxReqs,
		window:  time.Hour,
	}
}

// Allow checks if the given IP is within its request quota.
// Returns true if the request is allowed, false if the limit is exceeded.
func (s *RateLimitService) Allow(ctx context.Context, ip string) (bool, error) {
	key := fmt.Sprintf("ratelimit:%s", ip)

	count, err := s.redis.Incr(ctx, key).Result()
	if err != nil {
		slog.Error("Rate limit Redis INCR failed", "ip", ip, "error", err)
		return false, err
	}

	// Set the expiry only on the first request so the window starts then
	if count == 1 {
		s.redis.Expire(ctx, key, s.window)
	}

	if int(count) > s.maxReqs {
		slog.Warn("Rate limit exceeded", "ip", ip, "count", count, "max", s.maxReqs)
		return false, nil
	}

	slog.Info("Rate limit check passed", "ip", ip, "count", count, "max", s.maxReqs)
	return true, nil
}
