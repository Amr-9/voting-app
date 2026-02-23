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

const (
	// maxOTPAttempts is the maximum number of allowed failed OTP verification attempts.
	maxOTPAttempts = 6
	// otpBlockDuration is how long an email is blocked after exhausting OTP attempts.
	otpBlockDuration = 30 * time.Minute
	// otpTTL is the lifetime of the OTP itself.
	otpTTL = 5 * time.Minute
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

// otpAttemptsKey formats the Redis key for tracking failed OTP verification attempts.
func otpAttemptsKey(email string) string {
	return fmt.Sprintf("otp_attempts:%s", email)
}

// otpBlockedKey formats the Redis key used to block an email after too many failed attempts.
func otpBlockedKey(email string) string {
	return fmt.Sprintf("otp_blocked:%s", email)
}

// IsEmailBlocked returns true if the given email has been blocked due to too many failed OTP attempts.
func (s *OTPService) IsEmailBlocked(ctx context.Context, email string) (bool, error) {
	exists, err := s.redis.Exists(ctx, otpBlockedKey(email)).Result()
	if err != nil {
		return false, fmt.Errorf("checking OTP block status: %w", err)
	}
	return exists > 0, nil
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

	// Reject if this email is currently blocked
	blocked, err := s.IsEmailBlocked(ctx, email)
	if err != nil {
		slog.Error("Failed to check OTP block status", "email", email, "error", err)
		return fmt.Errorf("checking block status: %w", err)
	}
	if blocked {
		return errors.New("email blocked due to too many failed OTP attempts")
	}

	// Store "otp:candidateID:fingerprint" in Redis with 5-minute TTL
	value := fmt.Sprintf("%s:%d:%s", otp, candidateID, fingerprint)
	if err := s.redis.Set(ctx, otpKey(email), value, otpTTL).Err(); err != nil {
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
// After maxOTPAttempts failed attempts the OTP is deleted and the email is blocked.
func (s *OTPService) Verify(ctx context.Context, email, otp string, candidateID int) (string, error) {
	// Check if the email is already blocked
	blocked, err := s.IsEmailBlocked(ctx, email)
	if err != nil {
		slog.Error("Failed to check OTP block", "email", email, "error", err)
		return "", fmt.Errorf("checking block status: %w", err)
	}
	if blocked {
		return "", errors.New("email blocked: too many failed OTP attempts")
	}

	stored, err := s.redis.Get(ctx, otpKey(email)).Result()
	if errors.Is(err, redis.Nil) {
		return "", errors.New("OTP expired or not found")
	}
	if err != nil {
		return "", fmt.Errorf("fetching OTP from Redis: %w", err)
	}

	// Helper: record a failed attempt and potentially block the email.
	recordFailure := func() error {
		attemptsKey := otpAttemptsKey(email)
		// Increment attempt counter, set TTL on first attempt
		attempts, incrErr := s.redis.Incr(ctx, attemptsKey).Result()
		if incrErr != nil {
			slog.Error("Failed to increment OTP attempts", "email", email, "error", incrErr)
			return nil // non-fatal, do not expose Redis errors
		}
		if attempts == 1 {
			// First attempt — set expiry equal to the OTP lifetime
			s.redis.Expire(ctx, attemptsKey, otpTTL)
		}
		remaining := int64(maxOTPAttempts) - attempts
		slog.Warn("Failed OTP attempt", "email", email, "attempt", attempts, "remaining", remaining)
		if attempts >= maxOTPAttempts {
			// Block the email and delete the OTP to force a fresh request
			s.redis.Set(ctx, otpBlockedKey(email), "1", otpBlockDuration)
			s.redis.Del(ctx, otpKey(email), attemptsKey)
			slog.Warn("Email blocked after too many OTP failures", "email", email, "block_duration", otpBlockDuration)
			return errors.New("email blocked: too many failed OTP attempts")
		}
		return nil
	}

	// Expected format: "{otp}:{candidateID}:{fingerprint}"
	parts := strings.SplitN(stored, ":", 3)
	if len(parts) != 3 {
		_ = recordFailure()
		return "", errors.New("malformed OTP record")
	}

	storedOTP, storedCandidateID, storedFingerprint := parts[0], parts[1], parts[2]

	if storedOTP != otp {
		if blockErr := recordFailure(); blockErr != nil {
			return "", blockErr // email just got blocked
		}
		return "", errors.New("invalid OTP")
	}
	if storedCandidateID != fmt.Sprintf("%d", candidateID) {
		if blockErr := recordFailure(); blockErr != nil {
			return "", blockErr
		}
		return "", errors.New("candidate ID mismatch")
	}

	// OTP is correct — delete it and clear attempt counters
	s.redis.Del(ctx, otpKey(email), otpAttemptsKey(email))
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
