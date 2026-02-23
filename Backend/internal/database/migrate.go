package database

import (
	"log/slog"
	"os"
	"strings"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

// RunMigrations executes schema.sql against the database to create all tables.
// Uses IF NOT EXISTS — safe to call on every startup (idempotent).
func RunMigrations(db *sqlx.DB) {
	schema, err := os.ReadFile("internal/migrations/schema.sql")
	if err != nil {
		slog.Error("Failed to read schema.sql", "error", err)
		panic(err)
	}

	// Split on semicolons because the MySQL driver does not support multi-statement exec
	statements := strings.Split(string(schema), ";")
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			slog.Error("Migration failed", "statement_preview", truncate(stmt, 80), "error", err)
			panic(err)
		}
	}

	slog.Info("Database migrations applied successfully")
}

// SeedDefaultAdmin inserts a default admin account if the admins table is empty.
// Ensures the system is immediately usable after the first run.
func SeedDefaultAdmin(db *sqlx.DB, email, password string) {
	var count int
	if err := db.Get(&count, "SELECT COUNT(*) FROM admins"); err != nil {
		slog.Error("Failed to count admins", "error", err)
		panic(err)
	}

	if count > 0 {
		slog.Info("Admin account already exists — skipping seed")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("Failed to hash default admin password", "error", err)
		panic(err)
	}

	_, err = db.Exec(
		"INSERT INTO admins (email, password_hash) VALUES (?, ?)",
		email, string(hash),
	)
	if err != nil {
		slog.Error("Failed to seed default admin", "error", err)
		panic(err)
	}

	slog.Info("Default admin seeded", "email", email)
}

// truncate shortens a string to maxLen characters for safe log previews.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
