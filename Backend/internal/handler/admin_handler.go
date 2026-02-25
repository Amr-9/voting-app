package handler

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"path/filepath"
	"strconv"

	"votingsystem/internal/repository"
	"votingsystem/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AdminHandler handles all admin-related HTTP endpoints.
type AdminHandler struct {
	adminService  *service.AdminService
	candidateRepo *repository.CandidateRepository
	uploadDir     string
	cookieSecure  bool
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(svc *service.AdminService, repo *repository.CandidateRepository, uploadDir string, cookieSecure bool) *AdminHandler {
	return &AdminHandler{
		adminService:  svc,
		candidateRepo: repo,
		uploadDir:     uploadDir,
		cookieSecure:  cookieSecure,
	}
}

// LoginRequest is the expected JSON body for POST /api/admin/login.
type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login authenticates an admin and returns a JWT token.
func (h *AdminHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	token, err := h.adminService.Login(req.Email, req.Password)
	if err != nil {
		slog.Warn("Admin login attempt failed", "email", req.Email)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Plant the JWT as an HttpOnly cookie — JS cannot read it (XSS protection).
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("admin_token", token, 86400, "/", "", h.cookieSecure, true)
	c.JSON(http.StatusOK, gin.H{"message": "success"})
}

// Logout clears the admin_token cookie, effectively ending the session.
func (h *AdminHandler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("admin_token", "", -1, "/", "", h.cookieSecure, true)
	c.JSON(http.StatusOK, gin.H{"message": "success"})
}

// Me returns the authenticated admin's identity from the JWT claims.
// Protected by JWTAuth middleware.
func (h *AdminHandler) Me(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"id":    c.MustGet("adminID"),
			"email": c.MustGet("adminEmail"),
		},
	})
}

// ChangePasswordRequest is the expected JSON body for PUT /api/admin/change-password.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// ChangePassword allows an authenticated admin to change their account password.
// Protected by JWT middleware — requires a valid Bearer token.
func (h *AdminHandler) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Extract admin ID injected by JWTAuth middleware (stored as float64 from JWT claims)
	adminIDRaw, exists := c.Get("adminID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	adminID, err := strconv.Atoi(fmt.Sprintf("%v", adminIDRaw))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid admin session"})
		return
	}

	if err := h.adminService.ChangePassword(adminID, req.OldPassword, req.NewPassword); err != nil {
		switch {
		case errors.Is(err, service.ErrIncorrectPassword):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		case errors.Is(err, service.ErrWeakPassword):
			c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be at least 8 characters"})
		default:
			slog.Error("ChangePassword failed", "adminID", adminID, "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to change password"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"detail": "Password changed successfully"},
	})
}

// AddCandidate handles multipart/form-data to create a new candidate with an image.
// Protected by JWT middleware.
func (h *AdminHandler) AddCandidate(c *gin.Context) {
	name := c.PostForm("name")
	description := c.PostForm("description")

	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	imagePath := ""

	// Image is optional — if provided, save it with a UUID filename
	file, header, err := c.Request.FormFile("image")
	if err == nil {
		defer file.Close()

		ext := filepath.Ext(header.Filename)
		uniqueName := uuid.New().String() + ext
		savePath := filepath.Join(h.uploadDir, uniqueName)

		if err := c.SaveUploadedFile(header, savePath); err != nil {
			slog.Error("Failed to save candidate image", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save image"})
			return
		}

		// Store the relative URL path (served via /uploads/)
		imagePath = "/uploads/" + uniqueName
		slog.Info("Candidate image saved", "path", savePath)
	}

	id, err := h.candidateRepo.InsertCandidate(name, description, imagePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add candidate"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "success",
		"data": gin.H{
			"detail":       "Candidate added successfully",
			"candidate_id": id,
		},
	})
}

// UpdateCandidate handles PUT /api/admin/candidates/:id.
// Accepts multipart/form-data: name (required), description (optional), image (optional).
// Sets updated_at to the current timestamp in the DB.
func (h *AdminHandler) UpdateCandidate(c *gin.Context) {
	idParam := c.Param("id")
	candidateID, err := strconv.Atoi(idParam)
	if err != nil || candidateID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid candidate ID"})
		return
	}

	name := c.PostForm("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	description := c.PostForm("description")

	// Image is optional — if provided, replace the existing one
	imagePath := ""
	file, header, err := c.Request.FormFile("image")
	if err == nil {
		defer file.Close()
		ext := filepath.Ext(header.Filename)
		uniqueName := uuid.New().String() + ext
		savePath := filepath.Join(h.uploadDir, uniqueName)
		if err := c.SaveUploadedFile(header, savePath); err != nil {
			slog.Error("Failed to save candidate image", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save image"})
			return
		}
		imagePath = "/uploads/" + uniqueName
		slog.Info("Candidate image updated", "path", savePath)
	}

	if err := h.candidateRepo.UpdateCandidate(candidateID, name, description, imagePath); err != nil {
		if errors.Is(err, repository.ErrCandidateNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Candidate not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update candidate"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"detail": "Candidate updated successfully"},
	})
}

// DeleteCandidate handles DELETE /api/admin/candidates/:id.
// Rejects deletion if the candidate has any votes — preserving election data integrity.
// Protected by JWT middleware.
func (h *AdminHandler) DeleteCandidate(c *gin.Context) {
	idParam := c.Param("id")
	candidateID, err := strconv.Atoi(idParam)
	if err != nil || candidateID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid candidate ID"})
		return
	}

	if err := h.candidateRepo.DeleteCandidate(candidateID); err != nil {
		switch {
		case errors.Is(err, repository.ErrCandidateHasVotes):
			c.JSON(http.StatusConflict, gin.H{"error": "Cannot delete candidate: they already have votes"})
		case errors.Is(err, repository.ErrCandidateNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Candidate not found"})
		default:
			slog.Error("DeleteCandidate failed", "id", candidateID, "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete candidate"})
		}
		return
	}

	c.Status(http.StatusNoContent)
}
