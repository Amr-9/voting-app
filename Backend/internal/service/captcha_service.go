package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
)

// TurnstileResponse is the JSON body returned by the Cloudflare Turnstile verify endpoint.
type TurnstileResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// CaptchaService handles Cloudflare Turnstile server-to-server verification.
type CaptchaService struct {
	secret string
}

// NewCaptchaService creates a new CaptchaService.
func NewCaptchaService(secret string) *CaptchaService {
	return &CaptchaService{secret: secret}
}

// Verify sends the token to Cloudflare for server-side validation.
// Returns true if the token is valid, false otherwise.
func (s *CaptchaService) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	if s.secret == "" {
		slog.Warn("Turnstile secret is empty — skipping captcha verification (dev mode)")
		return true, nil
	}

	body := url.Values{
		"secret":   {s.secret},
		"response": {token},
		"remoteip": {remoteIP},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, turnstileVerifyURL,
		strings.NewReader(body.Encode()))
	if err != nil {
		return false, fmt.Errorf("building captcha request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Error("Turnstile HTTP call failed", "error", err)
		return false, fmt.Errorf("turnstile verify request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	var result TurnstileResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return false, fmt.Errorf("parsing turnstile response: %w", err)
	}

	if !result.Success {
		slog.Warn("Captcha verification failed", "error_codes", result.ErrorCodes)
	}

	return result.Success, nil
}
