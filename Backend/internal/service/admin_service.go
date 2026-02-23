package service

import (
	"errors"
	"log/slog"
	"time"

	"votingsystem/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ErrInvalidCredentials is returned when login email or password is wrong.
var ErrInvalidCredentials = errors.New("invalid email or password")

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

	// Compare the provided password against the stored bcrypt hash
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
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
