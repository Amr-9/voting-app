package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"votingsystem/internal/repository"
	"votingsystem/internal/ws"
)

// VoteService orchestrates OTP verification, vote insertion, and WebSocket broadcast.
type VoteService struct {
	voteRepo      *repository.VoteRepository
	candidateRepo *repository.CandidateRepository
	otpService    *OTPService
	hub           *ws.Hub
}

// NewVoteService creates a new VoteService.
func NewVoteService(
	voteRepo *repository.VoteRepository,
	candidateRepo *repository.CandidateRepository,
	otpService *OTPService,
	hub *ws.Hub,
) *VoteService {
	return &VoteService{
		voteRepo:      voteRepo,
		candidateRepo: candidateRepo,
		otpService:    otpService,
		hub:           hub,
	}
}

// VerifyAndVote validates the OTP, records the vote, and broadcasts updated results.
//
// Flow:
//  1. Verify OTP in Redis — retrieves the stored fingerprint to avoid re-sending it
//  2. Insert vote into MariaDB — DB UNIQUE constraint rejects duplicates automatically
//  3. Fetch fresh leaderboard via LEFT JOIN + COUNT
//  4. Broadcast JSON array to all connected WebSocket clients via Hub
func (s *VoteService) VerifyAndVote(ctx context.Context, email, otp string, candidateID int) error {
	// Step 1: verify the OTP and retrieve the fingerprint stored during OTP request
	fingerprint, err := s.otpService.Verify(ctx, email, otp, candidateID)
	if err != nil {
		slog.Warn("OTP verification failed", "email", email, "error", err)
		return fmt.Errorf("otp: %w", err)
	}

	// Step 2: insert the vote — DB enforces uniqueness on voter_email and voter_fingerprint
	if err := s.voteRepo.InsertVote(email, fingerprint, candidateID); err != nil {
		// MariaDB returns error 1062 on UNIQUE constraint violation
		if strings.Contains(err.Error(), "1062") || strings.Contains(err.Error(), "Duplicate") {
			return fmt.Errorf("already voted")
		}
		return fmt.Errorf("recording vote: %w", err)
	}

	// Step 3: fetch updated leaderboard (non-fatal if this fails — vote already recorded)
	candidates, err := s.candidateRepo.GetAllWithVotes()
	if err != nil {
		slog.Error("Failed to fetch updated results after vote", "error", err)
		return nil
	}

	// Step 4: serialize and push to all WebSocket clients
	payload, err := json.Marshal(candidates)
	if err != nil {
		slog.Error("Failed to marshal candidates for broadcast", "error", err)
		return nil
	}

	s.hub.Broadcast <- payload
	slog.Info("Vote recorded and leaderboard broadcasted", "email", email, "candidate_id", candidateID)
	return nil
}
