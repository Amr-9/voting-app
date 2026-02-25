package handler

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"votingsystem/internal/repository"
	"votingsystem/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// allowedImageTypes maps detected MIME types (via magic bytes) to safe file extensions.
// The extension is derived from the detected type — NOT from the client-supplied filename.
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// saveImage validates that an uploaded file is a genuine image by inspecting its magic bytes
// (first 512 bytes), then saves it under a UUID-based filename.
// Returns the public URL path (e.g. "/uploads/abc.jpg") or an error.
func (h *AdminHandler) saveImage(file multipart.File) (string, error) {
	// Read the first 512 bytes — enough for http.DetectContentType to identify any format.
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("failed to read file header: %w", err)
	}

	mimeType := http.DetectContentType(buf[:n])
	ext, ok := allowedImageTypes[mimeType]
	if !ok {
		return "", fmt.Errorf("unsupported file type: %s", mimeType)
	}

	// Reset to the beginning so the full file is written to disk.
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("failed to reset file reader: %w", err)
	}

	uniqueName := uuid.New().String() + ext
	savePath := filepath.Join(h.uploadDir, uniqueName)

	dst, err := os.Create(savePath)
	if err != nil {
		return "", fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("failed to write image: %w", err)
	}

	return "/uploads/" + uniqueName, nil
}

// AdminHandler handles all admin-related HTTP endpoints.
type AdminHandler struct {
	adminService     *service.AdminService
	candidateRepo    *repository.CandidateRepository
	customDomainRepo *repository.CustomDomainRepository
	uploadDir        string
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(svc *service.AdminService, repo *repository.CandidateRepository, customDomainRepo *repository.CustomDomainRepository, uploadDir string) *AdminHandler {
	return &AdminHandler{
		adminService:     svc,
		candidateRepo:    repo,
		customDomainRepo: customDomainRepo,
		uploadDir:        uploadDir,
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
	// SameSite=None; Secure works cross-domain (prod) and on localhost (dev).
	c.SetSameSite(http.SameSiteNoneMode)
	c.SetCookie("admin_token", token, 86400, "/", "", true, true)
	c.JSON(http.StatusOK, gin.H{"message": "success"})
}

// Logout clears the admin_token cookie, effectively ending the session.
func (h *AdminHandler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteNoneMode)
	c.SetCookie("admin_token", "", -1, "/", "", true, true)
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

	// Image is optional — if provided, validate magic bytes then save with a UUID filename.
	file, _, err := c.Request.FormFile("image")
	if err == nil {
		defer file.Close()

		path, saveErr := h.saveImage(file)
		if saveErr != nil {
			slog.Warn("Rejected image upload in AddCandidate", "error", saveErr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid image: " + saveErr.Error()})
			return
		}

		imagePath = path
		slog.Info("Candidate image saved", "path", path)
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

	// Image is optional — if provided, validate magic bytes then replace the existing one.
	imagePath := ""
	file, _, err := c.Request.FormFile("image")
	if err == nil {
		defer file.Close()

		path, saveErr := h.saveImage(file)
		if saveErr != nil {
			slog.Warn("Rejected image upload in UpdateCandidate", "error", saveErr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid image: " + saveErr.Error()})
			return
		}

		imagePath = path
		slog.Info("Candidate image updated", "path", path)
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

// AddDomainRequest is the expected JSON body for POST /api/admin/email-domains.
type AddDomainRequest struct {
	Domain string `json:"domain" binding:"required"`
}

// ListDomains returns all admin-added custom email domains.
// Protected by JWT middleware.
func (h *AdminHandler) ListDomains(c *gin.Context) {
	domains, err := h.customDomainRepo.GetAll()
	if err != nil {
		slog.Error("ListDomains failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch custom domains"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    domains,
	})
}

// AddDomain adds a new custom email domain to the allowed list.
// Protected by JWT middleware.
func (h *AdminHandler) AddDomain(c *gin.Context) {
	var req AddDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Normalize: lowercase, trim whitespace, strip accidental leading "@".
	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	if strings.HasPrefix(domain, "@") {
		domain = domain[1:]
	}

	if errMsg := validateDomain(domain); errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	// Reject if the domain is already covered by the built-in hardcoded list.
	if _, exists := allowedEmailDomains[domain]; exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Domain is already in the built-in allowed list"})
		return
	}

	if err := h.customDomainRepo.Insert(c.Request.Context(), domain); err != nil {
		if errors.Is(err, repository.ErrDomainAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "Domain is already in the custom allowed list"})
			return
		}
		slog.Error("AddDomain failed", "domain", domain, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add domain"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "success",
		"data":    gin.H{"detail": "Domain added successfully", "domain": domain},
	})
}

// DeleteDomain removes a custom email domain by ID.
// Protected by JWT middleware.
func (h *AdminHandler) DeleteDomain(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid domain ID"})
		return
	}

	if err := h.customDomainRepo.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, repository.ErrDomainNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
			return
		}
		slog.Error("DeleteDomain failed", "id", id, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete domain"})
		return
	}

	c.Status(http.StatusNoContent)
}
