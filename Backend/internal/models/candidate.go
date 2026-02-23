package models

import "time"

// Candidate represents a voting candidate.
// TotalVotes is populated by the LEFT JOIN aggregation query — it is NOT stored in the DB.
// UpdatedAt is nil (JSON null) if the candidate has never been updated by an admin.
type Candidate struct {
	ID          int        `db:"id"          json:"id"`
	Name        string     `db:"name"        json:"name"`
	Description string     `db:"description" json:"description"`
	ImagePath   string     `db:"image_path"  json:"image_path"`
	TotalVotes  int        `db:"total_votes" json:"total_votes"`
	CreatedAt   time.Time  `db:"created_at"  json:"created_at"`
	UpdatedAt   *time.Time `db:"updated_at"  json:"updated_at"`
}
