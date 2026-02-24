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

// HasVotedByEmail returns true if the given email has already cast a vote.
func (r *VoteRepository) HasVotedByEmail(email string) (bool, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM votes WHERE voter_email = ?", email).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// HasVotedByFingerprint returns true if the given device fingerprint has already cast a vote.
func (r *VoteRepository) HasVotedByFingerprint(fingerprint string) (bool, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM votes WHERE voter_fingerprint = ?", fingerprint).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CountVotesByIP returns how many votes have been cast from the given IP address.
func (r *VoteRepository) CountVotesByIP(ip string) (int, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM votes WHERE voter_ip = ?", ip).Scan(&count)
	return count, err
}

// InsertVote records a new vote including the voter's IP address and User-Agent.
// MariaDB enforces uniqueness on voter_email AND voter_fingerprint via UNIQUE constraints,
// so duplicate votes are rejected at the database level — no extra check needed here.
func (r *VoteRepository) InsertVote(email, fingerprint string, candidateID int, ip, userAgent string) error {
	_, err := r.db.Exec(
		`INSERT INTO votes (voter_email, voter_fingerprint, candidate_id, voter_ip, voter_user_agent)
		 VALUES (?, ?, ?, ?, ?)`,
		email, fingerprint, candidateID, ip, userAgent,
	)
	if err != nil {
		slog.Warn("InsertVote failed (possible duplicate)", "email", email, "candidate_id", candidateID, "error", err)
		return err
	}

	slog.Info("Vote recorded", "email", email, "candidate_id", candidateID, "ip", ip)
	return nil
}
