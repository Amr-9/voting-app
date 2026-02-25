# Voting System — Backend

Real-time voting system built with Go. Voters authenticate via a one-time code sent to their email, cast a single vote, and see live results. Admins manage candidates and control voting state through a protected API.

## Stack

- **Go** + **Gin** — HTTP framework
- **MariaDB** — Primary database
- **Redis** — OTP storage, rate limiting, async email queue
- **WebSocket** — Live leaderboard updates (gorilla/websocket)
- **Asynq** — Background email worker
- **JWT (HttpOnly cookie) + Argon2id** — Admin auth and password hashing
- **Cloudflare Turnstile** — CAPTCHA verification

## Quick Start

```bash
cp .env.example .env
# Fill in the required values in .env
go run ./cmd/server
```

Or with Docker:

```bash
docker compose up -d
```

## Environment Variables

Copy `.env.example` and fill in the required values. Key variables:

| Variable | Required | Default |
|---|---|---|
| `DB_HOST` / `DB_USER` / `DB_PASS` / `DB_NAME` | Yes | — |
| `REDIS_ADDR` | No | `localhost:6379` |
| `JWT_SECRET` | Yes | — |
| `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD` | Yes | — |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Yes | — |
| `CORS_ALLOWED_ORIGINS` | Yes | — |
| `TURNSTILE_SECRET` | No | skipped in dev |

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/login` | — | Authenticate and set HttpOnly cookie |
| `POST` | `/api/admin/logout` | — | Clear auth cookie |
| `GET` | `/api/candidates` | — | List candidates with vote counts |
| `GET` | `/api/voting-status` | — | Check if voting is open |
| `POST` | `/api/vote/request-otp` | — | Send OTP to voter email |
| `POST` | `/api/vote/verify` | — | Verify OTP and record vote |
| `GET` | `/ws` | — | WebSocket live updates |
| `GET` | `/api/admin/me` | Cookie | Get current admin identity |
| `PUT` | `/api/admin/voting-settings` | Cookie | Open/close voting |
| `POST` | `/api/admin/candidates` | Cookie | Add candidate |
| `PUT` | `/api/admin/candidates/:id` | Cookie | Update candidate |
| `DELETE` | `/api/admin/candidates/:id` | Cookie | Delete candidate |
| `PUT` | `/api/admin/change-password` | Cookie | Change admin password |

## How Voting Works

1. Voter submits email + candidate + device fingerprint + CAPTCHA token
2. Server sends a 6-digit OTP to the email (valid 5 minutes)
3. Voter submits the OTP to confirm
4. Vote is recorded; live leaderboard is broadcast to all WebSocket clients

**Anti-fraud:** one vote per email, one vote per device fingerprint, IP rate limiting, OTP bound to specific candidate and device.

## Project Structure

```
cmd/server/main.go       # Entry point
internal/
  config/                # Env var loading
  database/              # DB + Redis init, migrations
  handler/               # HTTP handlers
  service/               # Business logic
  repository/            # SQL queries
  middleware/            # JWT, rate limiting
  email/                 # Async email worker
  ws/                    # WebSocket hub
  models/                # Data structs
  migrations/schema.sql  # DB schema (auto-applied on startup)
```
