package handler

import (
	"net/http"

	"votingsystem/internal/repository"

	"github.com/gin-gonic/gin"
)

// CandidateHandler handles public candidate endpoints.
type CandidateHandler struct {
	candidateRepo *repository.CandidateRepository
}

// NewCandidateHandler creates a new CandidateHandler.
func NewCandidateHandler(repo *repository.CandidateRepository) *CandidateHandler {
	return &CandidateHandler{candidateRepo: repo}
}

// GetCandidates returns all candidates with their live vote counts, ordered highest first.
// This is the same query used for the WebSocket broadcast — single source of truth.
func (h *CandidateHandler) GetCandidates(c *gin.Context) {
	candidates, err := h.candidateRepo.GetAllWithVotes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch candidates"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"candidates": candidates},
	})
}
