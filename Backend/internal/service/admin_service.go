package service

import (
	"errors"
	"log/slog"
	"time"

	"votingsystem/internal/repository"

	"github.com/alexedwards/argon2id"
	"github.com/golang-jwt/jwt/v5"
)

// ErrInvalidCredentials is returned when login email or password is wrong.
var ErrInvalidCredentials = errors.New("invalid email or password")

// ErrIncorrectPassword is returned when the supplied current password is wrong.
var ErrIncorrectPassword = errors.New("incorrect current password")

// ErrWeakPassword is returned when the new password does not meet minimum length.
var ErrWeakPassword = errors.New("password must be at least 10 characters")

// argon2Params defines the Argon2id hashing parameters.
var argon2Params = &argon2id.Params{
	Memory:      32768, // 32 MB
	Iterations:  3,
	Parallelism: 2,
	SaltLength:  16,
	KeyLength:   32,
}

// AdminService handles authentication and JWT issuance for admin accounts.
type AdminService struct {
	adminRepo *repository.AdminRepository
	jwtSecret []byte
}

// NewAdminService creates a new AdminService.
func NewAdminService(repo *repository.AdminRepository, jwtSecret string) *AdminService {
	return &AdminService{
		adminRepo: repo,
		jwtSecret: []byte(jwtSecret),
	}
}

// Login verifies admin credentials and returns a signed JWT on success.
func (s *AdminService) Login(email, password string) (string, error) {
	admin, err := s.adminRepo.GetByEmail(email)
	if err != nil {
		// Do not leak whether the email exists or not
		return "", ErrInvalidCredentials
	}

	// Compare the provided password against the stored Argon2id hash
	match, err := argon2id.ComparePasswordAndHash(password, admin.PasswordHash)
	if err != nil || !match {
		slog.Warn("Admin login failed — wrong password", "email", email)
		return "", ErrInvalidCredentials
	}

	// Build JWT claims
	claims := jwt.MapClaims{
		"sub":   admin.ID,
		"email": admin.Email,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		slog.Error("Failed to sign JWT", "error", err)
		return "", err
	}

	slog.Info("Admin logged in", "email", email)
	return signed, nil
}

// ChangePassword verifies the admin's current password, then replaces it with a new Argon2id hash.
func (s *AdminService) ChangePassword(adminID int, oldPassword, newPassword string) error {
	if len(newPassword) < 10 {
		return ErrWeakPassword
	}

	admin, err := s.adminRepo.GetByID(adminID)
	if err != nil {
		return ErrInvalidCredentials
	}

	match, err := argon2id.ComparePasswordAndHash(oldPassword, admin.PasswordHash)
	if err != nil || !match {
		slog.Warn("ChangePassword failed — wrong current password", "adminID", adminID)
		return ErrIncorrectPassword
	}

	hash, err := argon2id.CreateHash(newPassword, argon2Params)
	if err != nil {
		slog.Error("Failed to hash new password", "error", err)
		return err
	}

	if err := s.adminRepo.UpdatePassword(adminID, hash); err != nil {
		return err
	}

	slog.Info("Admin password changed", "adminID", adminID)
	return nil
}
