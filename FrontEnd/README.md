# Voting System — Frontend

Real-time voting interface built with React 19 + TypeScript. Voters browse candidates, verify identity via email OTP, and see live results. Admins manage candidates and control voting through a protected dashboard.

## Stack

- **React 19** + **TypeScript** — UI framework
- **Vite 6** — Build tool and dev server
- **React Router v7** — Client-side routing (lazy-loaded routes)
- **Tailwind CSS v4** — Styling (utility-only, no custom CSS)
- **Axios** — HTTP client with cookie-based auth (`withCredentials`)
- **WebSocket** — Real-time leaderboard (native API + auto-reconnect)
- **FingerprintJS** — Browser fingerprinting (anti-fraud)
- **Cloudflare Turnstile** — CAPTCHA verification

## Quick Start

```bash
cp .env.example .env
# Fill in VITE_API_URL and VITE_CF_TURNSTILE_SITE_KEY
npm install
npm run dev
```

Dev server runs on `http://localhost:5173` and proxies `/api`, `/ws`, and `/uploads` to the backend at `http://localhost:8071`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend base URL, no trailing slash (e.g. `http://localhost:8071`) |
| `VITE_CF_TURNSTILE_SITE_KEY` | Yes | Cloudflare Turnstile public site key. Use `1x00000000000000000000AA` locally to always pass |

## Scripts

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check (tsc) + production build → dist/
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

## Project Structure

```
src/
├── pages/
│   ├── Home.tsx              # Public voting dashboard (candidates + live results)
│   └── admin/
│       ├── Login.tsx         # Admin login
│       └── Dashboard.tsx     # Admin panel (candidates, voting settings, password)
├── components/
│   ├── CandidateCard.tsx     # Candidate display + vote button
│   ├── VoteModal.tsx         # Email + OTP verification flow
│   ├── Navbar.tsx            # Header with theme toggle
│   ├── ProtectedRoute.tsx    # Redirects unauthenticated admins to login
│   ├── Toaster.tsx           # Toast notification renderer
│   └── LoadingSpinner.tsx
├── context/
│   ├── AdminAuthContext.tsx  # Cookie-based auth state (HttpOnly, no localStorage)
│   └── ToastContext.tsx      # Global toast notifications
├── hooks/
│   ├── useWebSocket.ts       # WS connection with exponential backoff reconnect
│   └── useFingerprint.ts     # FingerprintJS browser fingerprint
├── services/
│   └── api.ts                # Axios instance + all API call functions
├── types/index.ts            # TypeScript interfaces
└── App.tsx                   # Router with lazy-loaded routes
```

## Routes

| Path | Auth | Description |
|---|---|---|
| `/` | — | Public voting dashboard |
| `/admin/login` | — | Admin authentication |
| `/admin/dashboard` | Cookie | Admin control panel |
| `*` | — | Redirects to `/` |

## How Voting Works

1. Voter clicks a candidate and enters their email + CAPTCHA token
2. Server sends a 6-digit OTP to the email (valid 5 minutes)
3. Voter enters the OTP in the modal to confirm
4. Vote is recorded; all connected clients receive a live WebSocket update

## Admin Flow

1. Login at `/admin/login` → Backend sets `admin_token` as an **HttpOnly cookie** (JS cannot read it)
2. On every subsequent request, the browser sends the cookie automatically (`withCredentials: true`)
3. On page refresh, `AdminAuthContext` calls `GET /api/admin/me` to verify the cookie is still valid
4. On 401 (expired/invalid cookie), auth state is cleared and admin is redirected to login
5. Logout calls `POST /api/admin/logout` → Backend clears the cookie server-side

## WebSocket

`useWebSocket` connects to `{VITE_API_URL}/ws` (replacing `http` with `ws`). On connect, the server sends a full snapshot of candidates and voting status. Updates are pushed after every vote or settings change. Reconnection uses exponential backoff: 1s → 2s → 4s → 8s → max 30s.

## Docker

```bash
# Production image
docker build -t voting-frontend .
docker run -p 80:80 voting-frontend
```
