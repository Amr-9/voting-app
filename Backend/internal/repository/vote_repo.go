package repository

import (
	"log/slog"

	"github.com/jmoiron/sqlx"
)

// VoteRepository handles all database operations for votes.
type VoteRepository struct {
	db *sqlx.DB
}

// NewVoteRepository creates a new VoteRepository.
func NewVoteRepository(db *sqlx.DB) *VoteRepository {
	return &VoteRepository{db: db}
}

// InsertVote records a new vote.
// MariaDB enforces uniqueness on voter_email AND voter_fingerprint via UNIQUE constraints,
// so duplicate votes are rejected at the database level — no extra check needed here.
func (r *VoteRepository) InsertVote(email, fingerprint string, candidateID int) error {
	_, err := r.db.Exec(
		"INSERT INTO votes (voter_email, voter_fingerprint, candidate_id) VALUES (?, ?, ?)",
		email, fingerprint, candidateID,
	)
	if err != nil {
		slog.Warn("InsertVote failed (possible duplicate)", "email", email, "candidate_id", candidateID, "error", err)
		return err
	}

	slog.Info("Vote recorded", "email", email, "candidate_id", candidateID)
	return nil
}
