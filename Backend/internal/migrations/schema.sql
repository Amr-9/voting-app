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
    voter_ip          VARCHAR(45)  NULL DEFAULT NULL,
    voter_user_agent  VARCHAR(512) NULL DEFAULT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- Migration: add voter_ip / voter_user_agent to existing deployments (safe to re-run)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_ip         VARCHAR(45)  NULL DEFAULT NULL;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_user_agent VARCHAR(512) NULL DEFAULT NULL;

-- Index to speed up vote count aggregation per candidate
CREATE INDEX IF NOT EXISTS idx_candidate_id ON votes(candidate_id);

-- Voting control: singleton row for global on/off switch and optional auto-stop time (UTC)
CREATE TABLE IF NOT EXISTS voting_settings (
    id      INT PRIMARY KEY DEFAULT 1,
    is_open TINYINT(1) NOT NULL DEFAULT 1,
    ends_at DATETIME NULL DEFAULT NULL
);

-- Ensure the singleton row exists on every migration run
INSERT IGNORE INTO voting_settings (id, is_open, ends_at) VALUES (1, 1, NULL);
