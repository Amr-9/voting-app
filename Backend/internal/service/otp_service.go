package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/smtp"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// OTPService generates, stores, and emails OTP codes.
type OTPService struct {
	redis    *redis.Client
	smtpHost string
	smtpPort int
	smtpUser string
	smtpPass string
	smtpFrom string
}

// NewOTPService creates a new OTPService.
func NewOTPService(redis *redis.Client, host string, port int, user, pass, from string) *OTPService {
	return &OTPService{
		redis:    redis,
		smtpHost: host,
		smtpPort: port,
		smtpUser: user,
		smtpPass: pass,
		smtpFrom: from,
	}
}

// otpKey formats the Redis key for a given email's OTP.
func otpKey(email string) string {
	return fmt.Sprintf("otp:%s", email)
}

// GenerateAndStore creates a 6-digit OTP, stores it in Redis for 5 minutes,
// and sends it to the voter's email address.
// The Redis value encodes: "{otp}:{candidateID}:{fingerprint}" so that VerifyVote
// can confirm all three match — preventing OTP reuse across different candidates or devices.
func (s *OTPService) GenerateAndStore(ctx context.Context, email, fingerprint string, candidateID int) error {
	// Generate a cryptographically secure 6-digit code
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return fmt.Errorf("generating OTP: %w", err)
	}
	otp := fmt.Sprintf("%06d", n.Int64()+100000)

	// Store "otp:candidateID:fingerprint" in Redis with 5-minute TTL
	value := fmt.Sprintf("%s:%d:%s", otp, candidateID, fingerprint)
	if err := s.redis.Set(ctx, otpKey(email), value, 5*time.Minute).Err(); err != nil {
		slog.Error("Failed to store OTP in Redis", "email", email, "error", err)
		return fmt.Errorf("storing OTP: %w", err)
	}

	// Send the OTP via email
	if err := s.sendEmail(email, otp); err != nil {
		// Delete the stored OTP if sending fails to keep state consistent
		s.redis.Del(ctx, otpKey(email))
		return fmt.Errorf("sending OTP email: %w", err)
	}

	slog.Info("OTP generated and sent", "email", email, "candidate_id", candidateID)
	return nil
}

// Verify retrieves the stored OTP from Redis and validates it against the provided values.
// Returns the fingerprint from Redis so the vote service can use it without the client re-sending it.
func (s *OTPService) Verify(ctx context.Context, email, otp string, candidateID int) (string, error) {
	stored, err := s.redis.Get(ctx, otpKey(email)).Result()
	if errors.Is(err, redis.Nil) {
		return "", errors.New("OTP expired or not found")
	}
	if err != nil {
		return "", fmt.Errorf("fetching OTP from Redis: %w", err)
	}

	// Expected format: "{otp}:{candidateID}:{fingerprint}"
	parts := strings.SplitN(stored, ":", 3)
	if len(parts) != 3 {
		return "", errors.New("malformed OTP record")
	}

	storedOTP, storedCandidateID, storedFingerprint := parts[0], parts[1], parts[2]

	if storedOTP != otp {
		return "", errors.New("invalid OTP")
	}
	if storedCandidateID != fmt.Sprintf("%d", candidateID) {
		return "", errors.New("candidate ID mismatch")
	}

	// OTP is single-use — delete it immediately after successful verification
	s.redis.Del(ctx, otpKey(email))
	slog.Info("OTP verified and consumed", "email", email)

	return storedFingerprint, nil
}

// sendEmail delivers the OTP code to the voter using STARTTLS SMTP.
func (s *OTPService) sendEmail(to, otp string) error {
	auth := smtp.PlainAuth("", s.smtpUser, s.smtpPass, s.smtpHost)

	subject := "Your Voting OTP Code"
	body := fmt.Sprintf(
		"Your one-time password to confirm your vote is: %s\n\nThis code expires in 5 minutes.",
		otp,
	)

	msg := "From: " + s.smtpFrom + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" + body

	addr := fmt.Sprintf("%s:%d", s.smtpHost, s.smtpPort)
	if err := smtp.SendMail(addr, auth, s.smtpFrom, []string{to}, []byte(msg)); err != nil {
		slog.Error("Failed to send OTP email", "to", to, "error", err)
		return err
	}

	slog.Info("OTP email sent successfully", "to", to)
	return nil
}
