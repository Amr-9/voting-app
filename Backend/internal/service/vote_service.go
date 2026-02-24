package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"votingsystem/internal/models"
	"votingsystem/internal/repository"
	"votingsystem/internal/ws"
)

// wsVotingStatus is the voting_status field embedded in every WebSocket broadcast.
type wsVotingStatus struct {
	EffectivelyOpen bool       `json:"effectively_open"`
	EndsAt          *time.Time `json:"ends_at"`
}

// wsPayload is the full JSON structure sent to WebSocket clients.
// Combining candidates + voting_status in one message eliminates any need
// for the frontend to do separate HTTP polling.
type wsPayload struct {
	Candidates   []models.Candidate `json:"candidates"`
	VotingStatus wsVotingStatus     `json:"voting_status"`
}

// VoteService orchestrates OTP verification, vote insertion, and WebSocket broadcast.
type VoteService struct {
	voteRepo       *repository.VoteRepository
	candidateRepo  *repository.CandidateRepository
	otpService     *OTPService
	hub            *ws.Hub
	votingSettings *VotingSettingsService
}

// NewVoteService creates a new VoteService.
func NewVoteService(
	voteRepo *repository.VoteRepository,
	candidateRepo *repository.CandidateRepository,
	otpService *OTPService,
	hub *ws.Hub,
	votingSettings *VotingSettingsService,
) *VoteService {
	return &VoteService{
		voteRepo:       voteRepo,
		candidateRepo:  candidateRepo,
		otpService:     otpService,
		hub:            hub,
		votingSettings: votingSettings,
	}
}

// BuildWSPayload builds the full WebSocket payload: candidates + voting_status.
// Exported so main.go can use it to build the initial snapshot for new connections.
func BuildWSPayload(ctx context.Context, candidateRepo *repository.CandidateRepository, settingsSvc *VotingSettingsService) ([]byte, error) {
	candidates, err := candidateRepo.GetAllWithVotes()
	if err != nil {
		return nil, fmt.Errorf("fetching candidates for payload: %w", err)
	}
	if candidates == nil {
		candidates = []models.Candidate{}
	}

	effectivelyOpen, _ := settingsSvc.IsVotingOpen(ctx)
	_, endsAt, _ := settingsSvc.GetStatus(ctx)

	payload := wsPayload{
		Candidates: candidates,
		VotingStatus: wsVotingStatus{
			EffectivelyOpen: effectivelyOpen,
			EndsAt:          endsAt,
		},
	}
	return json.Marshal(payload)
}

// VerifyAndVote validates the OTP, records the vote, and broadcasts updated results.
//
// Flow:
//  1. Verify OTP in Redis — reads candidateID and fingerprint from the server-stored value;
//     the client is NOT trusted to supply candidateID at this stage (prevents candidate-swap attack)
//  2. Insert vote into MariaDB — DB enforces uniqueness; voter IP + User-Agent are stored for audit
//  3. Fetch fresh leaderboard via LEFT JOIN + COUNT
//  4. Broadcast JSON {candidates, voting_status} to all connected WebSocket clients via Hub
func (s *VoteService) VerifyAndVote(ctx context.Context, email, otp, ip, userAgent string) error {
	// Step 1: verify the OTP; candidateID is read from Redis, not from the client
	fingerprint, candidateID, err := s.otpService.Verify(ctx, email, otp)
	if err != nil {
		slog.Warn("OTP verification failed", "email", email, "error", err)
		return fmt.Errorf("otp: %w", err)
	}

	// Step 2: insert the vote — DB enforces uniqueness on voter_email and voter_fingerprint
	if err := s.voteRepo.InsertVote(email, fingerprint, candidateID, ip, userAgent); err != nil {
		// MariaDB returns error 1062 on UNIQUE constraint violation
		if strings.Contains(err.Error(), "1062") || strings.Contains(err.Error(), "Duplicate") {
			return fmt.Errorf("already voted")
		}
		return fmt.Errorf("recording vote: %w", err)
	}

	// Step 3 & 4: build full payload and broadcast (non-fatal if this fails — vote already recorded)
	data, err := BuildWSPayload(ctx, s.candidateRepo, s.votingSettings)
	if err != nil {
		slog.Error("Failed to build WS payload after vote", "error", err)
		return nil
	}

	s.hub.Broadcast <- data
	slog.Info("Vote recorded and leaderboard broadcasted", "email", email, "candidate_id", candidateID)
	return nil
}
