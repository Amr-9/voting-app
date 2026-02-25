# Real-Time Voting System

Web application for running live elections. Voters authenticate via a one-time code sent to their email and cast a single vote. Results update in real time for everyone watching. Admins manage candidates and control voting state through a protected dashboard.

## Architecture

```
voting-app/
├── Backend/    # Go REST API + WebSocket server
└── FrontEnd/   # React SPA
```

## Stack

| Layer | Technology |
|---|---|
| Backend | Go + Gin, MariaDB, Redis, gorilla/websocket |
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4 |
| Auth (Admin) | JWT in HttpOnly cookie (XSS-proof) |
| Auth (Voter) | Email OTP, valid 5 minutes |
| Email | Asynq async queue + SMTP |
| Anti-fraud | Unique email + device fingerprint + IP rate limiting |
| CAPTCHA | Cloudflare Turnstile |

## How It Works

1. Voter selects a candidate, enters their email, and completes CAPTCHA
2. Server sends a 6-digit OTP to the email
3. Voter enters the OTP — vote is recorded
4. Live leaderboard updates instantly via WebSocket for all connected clients

Each email and device fingerprint can only vote once. OTPs expire in 5 minutes and are bound to the specific candidate and device that requested them.

## Running with Docker

```bash
cd Backend
cp .env.example .env
# Fill in the required values in .env
docker compose up -d
```

The backend API is exposed on port `8071`. PhpMyAdmin is available on port `8072`.

For the frontend, see [FrontEnd/README.md](FrontEnd/README.md).
For the full API reference, see [Backend/API_DOCUMENTATION.md](Backend/API_DOCUMENTATION.md).
