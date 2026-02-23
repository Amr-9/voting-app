package repository

import (
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
)

// VotingSettingsRepository handles persistence for the voting_settings singleton row.
type VotingSettingsRepository struct {
	db *sqlx.DB
}

// NewVotingSettingsRepository creates a new VotingSettingsRepository.
func NewVotingSettingsRepository(db *sqlx.DB) *VotingSettingsRepository {
	return &VotingSettingsRepository{db: db}
}

// GetSettings reads the singleton row from voting_settings.
// endsAt is nil if no auto-stop time is configured.
func (r *VotingSettingsRepository) GetSettings() (isOpen bool, endsAt *time.Time, err error) {
	var open bool
	var ends sql.NullTime
	row := r.db.QueryRow(`SELECT is_open, ends_at FROM voting_settings WHERE id = 1`)
	if err = row.Scan(&open, &ends); err != nil {
		return false, nil, err
	}
	isOpen = open
	if ends.Valid {
		t := ends.Time.UTC()
		endsAt = &t
	}
	return isOpen, endsAt, nil
}

// UpdateSettings writes new values to the singleton row.
// Pass nil for endsAt to clear the auto-stop time.
func (r *VotingSettingsRepository) UpdateSettings(isOpen bool, endsAt *time.Time) error {
	_, err := r.db.Exec(
		`UPDATE voting_settings SET is_open = ?, ends_at = ? WHERE id = 1`,
		isOpen, endsAt,
	)
	return err
}
