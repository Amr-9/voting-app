package repository

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strings"

	"votingsystem/internal/models"

	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	redis "github.com/redis/go-redis/v9"
)

const (
	customDomainsRedisKey       = "custom_email_domains"
	customDomainsWarmedRedisKey = "custom_email_domains:warmed"
)

var (
	ErrDomainAlreadyExists = errors.New("domain already exists")
	ErrDomainNotFound      = errors.New("domain not found")
)

// CustomDomainRepository manages admin-added email domains that are allowed for voting.
// Domains are persisted in MariaDB and cached in Redis as a SET for fast OTP-time lookups.
type CustomDomainRepository struct {
	db    *sqlx.DB
	redis *redis.Client
}

// NewCustomDomainRepository creates a new CustomDomainRepository.
func NewCustomDomainRepository(db *sqlx.DB, redis *redis.Client) *CustomDomainRepository {
	return &CustomDomainRepository{db: db, redis: redis}
}

// GetAll returns all admin-added custom domains ordered by newest first.
// Always reads from DB for accuracy (admin-only, infrequent call).
func (r *CustomDomainRepository) GetAll() ([]models.CustomDomain, error) {
	domains := []models.CustomDomain{}
	err := r.db.Select(&domains, `SELECT id, domain, created_at FROM custom_email_domains ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	return domains, nil
}

// Insert adds a new domain to the DB and updates the Redis SET.
// Returns ErrDomainAlreadyExists if the domain is already present.
func (r *CustomDomainRepository) Insert(ctx context.Context, domain string) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO custom_email_domains (domain) VALUES (?)`, domain)
	if err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			return ErrDomainAlreadyExists
		}
		return err
	}

	// Update Redis SET — add the new domain without rebuilding the whole cache.
	if redisErr := r.redis.SAdd(ctx, customDomainsRedisKey, domain).Err(); redisErr != nil {
		slog.Warn("Failed to add domain to Redis cache after insert", "domain", domain, "error", redisErr)
		// Non-fatal: IsDomainAllowed will detect cache miss and fall back to DB.
	}

	slog.Info("Custom domain added", "domain", domain)
	return nil
}

// Delete removes a domain by ID from the DB and Redis SET.
// Returns ErrDomainNotFound if no row with that ID exists.
func (r *CustomDomainRepository) Delete(ctx context.Context, id int) error {
	// Fetch the domain string first so we can remove it from the Redis SET by value.
	var domain string
	err := r.db.QueryRowContext(ctx, `SELECT domain FROM custom_email_domains WHERE id = ?`, id).Scan(&domain)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrDomainNotFound
		}
		return err
	}

	res, err := r.db.ExecContext(ctx, `DELETE FROM custom_email_domains WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return ErrDomainNotFound
	}

	// Remove from Redis SET.
	if redisErr := r.redis.SRem(ctx, customDomainsRedisKey, domain).Err(); redisErr != nil {
		slog.Warn("Failed to remove domain from Redis cache after delete", "domain", domain, "error", redisErr)
		// Non-fatal: stale cache entries are handled by a DB fallback or next WarmCache call.
	}

	slog.Info("Custom domain deleted", "id", id, "domain", domain)
	return nil
}

// IsDomainAllowed checks whether the given (already lowercased) domain is in the custom list.
// Hot path: checks Redis first. Falls back to DB if the cache is not warmed.
func (r *CustomDomainRepository) IsDomainAllowed(ctx context.Context, domain string) (bool, error) {
	domain = strings.ToLower(domain) // defensive normalisation

	// Check whether the cache has been warmed.
	warmed, err := r.redis.Exists(ctx, customDomainsWarmedRedisKey).Result()
	if err != nil {
		// Redis is unavailable — fall back to DB and schedule a re-warm.
		slog.Warn("Redis unavailable in IsDomainAllowed, falling back to DB", "error", err)
		allowed, dbErr := r.isDomainAllowedFromDB(ctx, domain)
		if dbErr == nil {
			go func() {
				if wErr := r.WarmCache(context.Background()); wErr != nil {
					slog.Warn("Background cache re-warm failed", "error", wErr)
				}
			}()
		}
		return allowed, dbErr
	}

	if warmed == 0 {
		// Cache has not been warmed yet (e.g., after a Redis restart).
		allowed, dbErr := r.isDomainAllowedFromDB(ctx, domain)
		if dbErr == nil {
			go func() {
				if wErr := r.WarmCache(context.Background()); wErr != nil {
					slog.Warn("Background cache re-warm failed", "error", wErr)
				}
			}()
		}
		return allowed, dbErr
	}

	// Cache is warmed — use SISMEMBER for O(1) lookup.
	return r.redis.SIsMember(ctx, customDomainsRedisKey, domain).Result()
}

// isDomainAllowedFromDB performs a direct DB lookup for a domain.
func (r *CustomDomainRepository) isDomainAllowedFromDB(ctx context.Context, domain string) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM custom_email_domains WHERE domain = ?`, domain).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// WarmCache loads all custom domains from DB into Redis and marks the cache as warmed.
// Called once at startup and after a Redis restart is detected.
func (r *CustomDomainRepository) WarmCache(ctx context.Context) error {
	domains, err := r.GetAll()
	if err != nil {
		return err
	}

	pipe := r.redis.Pipeline()
	pipe.Del(ctx, customDomainsRedisKey)

	if len(domains) > 0 {
		members := make([]interface{}, len(domains))
		for i, d := range domains {
			members[i] = d.Domain
		}
		pipe.SAdd(ctx, customDomainsRedisKey, members...)
	}

	// Mark the cache as warmed regardless of whether there are any domains.
	pipe.Set(ctx, customDomainsWarmedRedisKey, "1", 0)

	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}

	slog.Info("Custom domain cache warmed", "count", len(domains))
	return nil
}
