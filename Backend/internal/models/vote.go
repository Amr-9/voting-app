package models

import "time"

// Vote represents a single cast vote.
type Vote struct {
	ID               int       `db:"id"`
	VoterEmail       string    `db:"voter_email"`
	VoterFingerprint string    `db:"voter_fingerprint"`
	CandidateID      int       `db:"candidate_id"`
	CreatedAt        time.Time `db:"created_at"`
}
