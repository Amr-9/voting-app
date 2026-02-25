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
func (r *VotingSettingsRepository) GetSettings() (isOpen bool, endsAt *time.Time, customDomainsOnly bool, err error) {
	var open, customOnly bool
	var ends sql.NullTime
	row := r.db.QueryRow(`SELECT is_open, ends_at, custom_domains_only FROM voting_settings WHERE id = 1`)
	if err = row.Scan(&open, &ends, &customOnly); err != nil {
		return false, nil, false, err
	}
	isOpen = open
	customDomainsOnly = customOnly
	if ends.Valid {
		t := ends.Time.UTC()
		endsAt = &t
	}
	return isOpen, endsAt, customDomainsOnly, nil
}

// UpdateSettings writes new is_open and ends_at values to the singleton row.
// Pass nil for endsAt to clear the auto-stop time. Does not touch custom_domains_only.
func (r *VotingSettingsRepository) UpdateSettings(isOpen bool, endsAt *time.Time) error {
	_, err := r.db.Exec(
		`UPDATE voting_settings SET is_open = ?, ends_at = ? WHERE id = 1`,
		isOpen, endsAt,
	)
	return err
}

// UpdateCustomDomainsOnly sets the custom_domains_only flag on the singleton row.
func (r *VotingSettingsRepository) UpdateCustomDomainsOnly(value bool) error {
	_, err := r.db.Exec(`UPDATE voting_settings SET custom_domains_only = ? WHERE id = 1`, value)
	return err
}
