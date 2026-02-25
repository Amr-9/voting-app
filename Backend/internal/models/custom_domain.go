package models

import "time"

// CustomDomain represents an admin-added email domain that is allowed for voting.
// The domain is stored in lowercase without a trailing dot.
type CustomDomain struct {
	ID        int       `db:"id"         json:"id"`
	Domain    string    `db:"domain"     json:"domain"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
