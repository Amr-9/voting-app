package handler

import (
	"net/http"
	"time"

	"votingsystem/internal/service"

	"github.com/gin-gonic/gin"
)

// VotingSettingsHandler exposes endpoints to read and update the voting on/off state.
type VotingSettingsHandler struct {
	svc *service.VotingSettingsService
}

// NewVotingSettingsHandler creates a new VotingSettingsHandler.
func NewVotingSettingsHandler(svc *service.VotingSettingsService) *VotingSettingsHandler {
	return &VotingSettingsHandler{svc: svc}
}

// GetVotingStatus handles GET /api/voting-status (public).
// Returns the current open/closed state and optional auto-stop UTC time.
func (h *VotingSettingsHandler) GetVotingStatus(c *gin.Context) {
	isOpen, endsAt, err := h.svc.GetStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch voting status"})
		return
	}

	// Also evaluate whether voting is effectively open (respects ends_at expiry)
	effectivelyOpen, _ := h.svc.IsVotingOpen(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"is_open":          isOpen,
			"effectively_open": effectivelyOpen,
			"ends_at":          endsAt, // UTC or null
		},
	})
}

// UpdateVotingSettingsRequest is the expected JSON body for PUT /api/admin/voting-settings.
type UpdateVotingSettingsRequest struct {
	IsOpen bool `json:"is_open"`
	// RFC 3339 UTC string, e.g. "2025-12-31T18:00:00Z". Null/omitted = no auto-stop.
	EndsAt *string `json:"ends_at"`
}

// UpdateVotingSettings handles PUT /api/admin/voting-settings (JWT-protected).
// Allows admins to toggle voting on/off and optionally set an auto-stop time (UTC).
func (h *VotingSettingsHandler) UpdateVotingSettings(c *gin.Context) {
	var req UpdateVotingSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	var endsAt *time.Time
	if req.EndsAt != nil && *req.EndsAt != "" {
		t, err := time.Parse(time.RFC3339, *req.EndsAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ends_at must be a valid RFC 3339 UTC timestamp (e.g. 2025-12-31T18:00:00Z)"})
			return
		}
		utc := t.UTC()
		endsAt = &utc
	}

	if err := h.svc.UpdateSettings(c.Request.Context(), req.IsOpen, endsAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update voting settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"detail": "Voting settings updated successfully"},
	})
}
