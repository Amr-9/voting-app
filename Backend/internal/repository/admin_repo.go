package repository

import (
	"log/slog"

	"github.com/jmoiron/sqlx"
	"votingsystem/internal/models"
)

// AdminRepository handles all database operations for admin accounts.
type AdminRepository struct {
	db *sqlx.DB
}

// NewAdminRepository creates a new AdminRepository.
func NewAdminRepository(db *sqlx.DB) *AdminRepository {
	return &AdminRepository{db: db}
}

// GetByEmail fetches an admin by their email address.
// Returns nil if no admin is found.
func (r *AdminRepository) GetByEmail(email string) (*models.Admin, error) {
	var admin models.Admin
	err := r.db.Get(&admin, "SELECT * FROM admins WHERE email = ? LIMIT 1", email)
	if err != nil {
		slog.Warn("Admin not found", "email", email, "error", err)
		return nil, err
	}
	return &admin, nil
}

// GetByID fetches an admin by their ID.
func (r *AdminRepository) GetByID(id int) (*models.Admin, error) {
	var admin models.Admin
	err := r.db.Get(&admin, "SELECT * FROM admins WHERE id = ? LIMIT 1", id)
	if err != nil {
		slog.Warn("Admin not found", "id", id, "error", err)
		return nil, err
	}
	return &admin, nil
}

// UpdatePassword sets a new bcrypt password hash for the given admin.
func (r *AdminRepository) UpdatePassword(adminID int, newHash string) error {
	_, err := r.db.Exec("UPDATE admins SET password_hash = ? WHERE id = ?", newHash, adminID)
	if err != nil {
		slog.Error("Failed to update admin password", "adminID", adminID, "error", err)
	}
	return err
}
