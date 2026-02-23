package handler

import (
	"log/slog"
	"net/http"
	"strings"

	"votingsystem/internal/service"

	"github.com/gin-gonic/gin"
)

// VoteHandler handles all voting-related HTTP endpoints.
type VoteHandler struct {
	otpService     *service.OTPService
	voteService    *service.VoteService
	captchaService *service.CaptchaService
	votingSettings *service.VotingSettingsService
}

// NewVoteHandler creates a new VoteHandler.
func NewVoteHandler(otp *service.OTPService, vote *service.VoteService, captcha *service.CaptchaService, settings *service.VotingSettingsService) *VoteHandler {
	return &VoteHandler{
		otpService:     otp,
		voteService:    vote,
		captchaService: captcha,
		votingSettings: settings,
	}
}

// RequestOTPRequest is the expected JSON body for POST /api/vote/request-otp.
type RequestOTPRequest struct {
	Email        string `json:"email"         binding:"required,email"`
	Fingerprint  string `json:"fingerprint"   binding:"required"`
	CaptchaToken string `json:"captcha_token" binding:"required"`
	CandidateID  int    `json:"candidate_id"  binding:"required,min=1"`
}

// RequestOTP validates the captcha, enforces rate limiting, then generates and emails the OTP.
func (h *VoteHandler) RequestOTP(c *gin.Context) {
	// Guard: reject if voting is closed or auto-stop time has passed
	open, err := h.votingSettings.IsVotingOpen(c.Request.Context())
	if err != nil {
		slog.Error("Failed to check voting status", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not verify voting status"})
		return
	}
	if !open {
		c.JSON(http.StatusForbidden, gin.H{"error": "Voting is currently closed"})
		return
	}

	var req RequestOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Reject emails from domains that are not in the allowed list
	if !isEmailDomainAllowed(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email domain is not supported. Please use a common email provider (e.g. gmail.com, outlook.com)."})
		return
	}

	// Verify Cloudflare Turnstile token (server-to-server)
	valid, err := h.captchaService.Verify(c.Request.Context(), req.CaptchaToken, c.ClientIP())
	if err != nil {
		slog.Error("Captcha service error", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Captcha verification error"})
		return
	}
	if !valid {
		c.JSON(http.StatusForbidden, gin.H{"error": "Captcha verification failed"})
		return
	}

	// Generate OTP, store in Redis, and send to email
	if err := h.otpService.GenerateAndStore(c.Request.Context(), req.Email, req.Fingerprint, req.CandidateID); err != nil {
		if err.Error() == "email blocked due to too many failed OTP attempts" {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "This email is temporarily blocked due to too many failed OTP attempts. Please try again later."})
			return
		}
		slog.Error("Failed to generate/send OTP", "email", req.Email, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send OTP — please try again"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"detail": "OTP sent to your email. It expires in 5 minutes."},
	})
}

// VerifyVoteRequest is the expected JSON body for POST /api/vote/verify.
type VerifyVoteRequest struct {
	Email       string `json:"email"        binding:"required,email"`
	OTP         string `json:"otp"          binding:"required,len=6"`
	CandidateID int    `json:"candidate_id" binding:"required,min=1"`
}

// VerifyVote confirms the OTP and records the vote in the database.
// On success, the updated leaderboard is automatically broadcasted via WebSocket.
func (h *VoteHandler) VerifyVote(c *gin.Context) {
	// Guard: reject if voting closed between OTP request and verification
	open, err := h.votingSettings.IsVotingOpen(c.Request.Context())
	if err != nil {
		slog.Error("Failed to check voting status", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not verify voting status"})
		return
	}
	if !open {
		c.JSON(http.StatusForbidden, gin.H{"error": "Voting is currently closed"})
		return
	}

	var req VerifyVoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	if err := h.voteService.VerifyAndVote(c.Request.Context(), req.Email, req.OTP, req.CandidateID); err != nil {
		errMsg := err.Error()
		switch {
		case errMsg == "already voted":
			c.JSON(http.StatusConflict, gin.H{"error": "You have already voted"})
		case strings.Contains(errMsg, "email blocked"):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "This email is temporarily blocked due to too many failed OTP attempts. Please request a new OTP after 30 minutes."})
		case len(errMsg) > 3 && errMsg[:4] == "otp:":
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Invalid or expired OTP"})
		default:
			slog.Error("VerifyAndVote failed", "email", req.Email, "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record vote"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"detail": "Vote recorded successfully!"},
	})
}
