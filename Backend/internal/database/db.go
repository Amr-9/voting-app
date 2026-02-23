package database

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/jmoiron/sqlx"

	// MySQL/MariaDB driver — imported for its side effects (registers the driver)
	_ "github.com/go-sql-driver/mysql"
)

// NewDB opens a MariaDB connection using sqlx and verifies it with a Ping.
// It retries up to 10 times to handle Docker startup race conditions.
func NewDB(dsn string) *sqlx.DB {
	var db *sqlx.DB
	var err error

	for i := 1; i <= 10; i++ {
		db, err = sqlx.Open("mysql", dsn)
		if err != nil {
			slog.Error("Failed to open database", "error", err)
			panic(err)
		}

		if err = db.Ping(); err == nil {
			slog.Info("Database connected successfully")
			break
		}

		slog.Warn("Database not ready, retrying...", "attempt", i, "max", 10, "error", err)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		slog.Error("Could not connect to database after 10 attempts", "error", err)
		panic(fmt.Sprintf("database unreachable: %v", err))
	}

	// Connection pool tuning
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	slog.Info("MariaDB connection pool ready")
	return db
}
