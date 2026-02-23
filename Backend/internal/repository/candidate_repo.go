package repository

import (
	"errors"
	"log/slog"

	"votingsystem/internal/models"

	"github.com/jmoiron/sqlx"
)

// ErrCandidateNotFound is returned when an UPDATE/DELETE targets a non-existent candidate.
var ErrCandidateNotFound = errors.New("candidate not found")

// CandidateRepository handles all database operations for candidates.
type CandidateRepository struct {
	db *sqlx.DB
}

// NewCandidateRepository creates a new CandidateRepository.
func NewCandidateRepository(db *sqlx.DB) *CandidateRepository {
	return &CandidateRepository{db: db}
}

// GetAllWithVotes returns all candidates with their vote counts, ordered highest first.
// Uses LEFT JOIN so candidates with 0 votes are still included.
const getAllWithVotesQuery = `
	SELECT
		c.id,
		c.name,
		c.description,
		c.image_path,
		c.created_at,
		c.updated_at,
		COUNT(v.id) AS total_votes
	FROM candidates c
	LEFT JOIN votes v ON c.id = v.candidate_id
	GROUP BY c.id
	ORDER BY total_votes DESC
`

func (r *CandidateRepository) GetAllWithVotes() ([]models.Candidate, error) {
	var candidates []models.Candidate
	if err := r.db.Select(&candidates, getAllWithVotesQuery); err != nil {
		slog.Error("GetAllWithVotes query failed", "error", err)
		return nil, err
	}
	return candidates, nil
}

// InsertCandidate adds a new candidate to the database.
func (r *CandidateRepository) InsertCandidate(name, description, imagePath string) (int64, error) {
	result, err := r.db.Exec(
		"INSERT INTO candidates (name, description, image_path) VALUES (?, ?, ?)",
		name, description, imagePath,
	)
	if err != nil {
		slog.Error("InsertCandidate failed", "name", name, "error", err)
		return 0, err
	}

	id, _ := result.LastInsertId()
	slog.Info("Candidate inserted", "id", id, "name", name)
	return id, nil
}

// UpdateCandidate updates a candidate's fields and sets updated_at to now.
// If imagePath is empty the image_path column is left unchanged.
// Returns ErrCandidateNotFound if no row matched the given id.
func (r *CandidateRepository) UpdateCandidate(id int, name, description, imagePath string) error {
	var result interface{ RowsAffected() (int64, error) }
	var err error

	if imagePath != "" {
		result, err = r.db.Exec(
			`UPDATE candidates
			 SET name=?, description=?, image_path=?, updated_at=NOW()
			 WHERE id=?`,
			name, description, imagePath, id,
		)
	} else {
		result, err = r.db.Exec(
			`UPDATE candidates
			 SET name=?, description=?, updated_at=NOW()
			 WHERE id=?`,
			name, description, id,
		)
	}

	if err != nil {
		slog.Error("UpdateCandidate failed", "id", id, "error", err)
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrCandidateNotFound
	}

	slog.Info("Candidate updated", "id", id, "name", name)
	return nil
}
