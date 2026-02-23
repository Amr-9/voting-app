-- Admin accounts table
CREATE TABLE IF NOT EXISTS admins (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidates table (no vote counter — single source of truth)
CREATE TABLE IF NOT EXISTS candidates (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    image_path  VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NULL DEFAULT NULL
);

-- Migration: add updated_at to existing deployments (safe to re-run)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT NULL;

-- Votes table: UNIQUE on email AND fingerprint prevents double voting
CREATE TABLE IF NOT EXISTS votes (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    voter_email       VARCHAR(255) NOT NULL UNIQUE,
    voter_fingerprint VARCHAR(255) NOT NULL UNIQUE,
    candidate_id      INT NOT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- Index to speed up vote count aggregation per candidate
CREATE INDEX IF NOT EXISTS idx_candidate_id ON votes(candidate_id);
