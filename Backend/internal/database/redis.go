package database

import (
	"context"
	"log/slog"

	"github.com/redis/go-redis/v9"
)

// NewRedis creates a Redis client and verifies the connection with a Ping.
func NewRedis(addr, password string) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
		panic(err)
	}

	slog.Info("Redis connected successfully", "addr", addr)
	return client
}
