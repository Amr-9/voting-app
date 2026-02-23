# 🗳️ Real-Time Voting System API Documentation

> **Base URL**: `http://localhost:8080` (Default)
> **API Version**: `v1`
> **Content-Type**: `application/json`

---

## 📑 Table of Contents

1. [General Information](#general-information)
2. [Public Endpoints](#public-endpoints)
   - [GET /api/candidates](#get-apicandidates)
   - [POST /api/vote/request-otp](#post-apivoterequest-otp)
   - [POST /api/vote/verify](#post-apivoteverify)
3. [Admin Endpoints](#admin-endpoints)
   - [POST /api/admin/login](#post-apiadminlogin)
   - [POST /api/admin/candidates](#post-apiadmincandidates)
4. [Real-Time & System Endpoints](#real-time--system-endpoints)
   - [GET /ws](#get-ws)
   - [GET /health](#get-health)

---

## General Information

### Authentication
Admin endpoints are protected by **JWT (JSON Web Token)**.
The token must be sent in the `Authorization` header:
```
Authorization: Bearer <your_token>
```

### Response Format
All successful responses follow this uniform structure:
```json
{
  "message": "success",
  "data": {
    "key": "value"
  }
}
```

All error responses follow this structure:
```json
{
  "error": "Human-readable error message"
}
```

### Security & Integrity
- **Unique Constraints**: The system enforces uniqueness on `email` and `fingerprint` to prevent duplicate votes.
- **Tamper Prevention**: OTPs are tied to both the `email` and the `fingerprint` of the device to ensure the person who requested the OTP is the one using it.
- **Rate Limiting**: Applied strictly to OTP requests to prevent spam.

---

## Public Endpoints

---

### GET /api/candidates

Retrieves all candidates with their live vote counts, ordered by highest votes first.

#### Request
`GET /api/candidates`

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "candidates": [
      {
        "id": 1,
        "name": "Jane Doe",
        "description": "Visionary leader for a better future.",
        "image_path": "/uploads/uuid-filename.png",
        "total_votes": 150,
        "created_at": "2024-02-23T10:00:00Z"
      }
    ]
  }
}
```

> **Note on `image_path`**: This is a relative URL path. To construct the full image URL, prepend the base URL:
> `http://localhost:8080/uploads/uuid-filename.png`
> If a candidate has no image, `image_path` will be an empty string `""`.

> **Note on empty list**: If no candidates exist yet, `data.candidates` will be an empty array `[]`, not `null`.

#### Error Responses
| Status Code | Description |
|-------------|-------------|
| `500` | Failed to fetch candidates from the database |

---

### POST /api/vote/request-otp

Initiates the voting process by sending a 6-digit OTP to the user's email. Requires a Cloudflare Turnstile captcha token.

#### Request Body
```json
{
  "email": "voter@example.com",
  "fingerprint": "browser-fingerprint-uuid",
  "captcha_token": "turnstile-token-from-frontend",
  "candidate_id": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | Valid email address |
| `fingerprint` | string | ✅ | Unique browser identifier |
| `captcha_token` | string | ✅ | Cloudflare Turnstile verification token |
| `candidate_id` | integer | ✅ | ID of the candidate you want to vote for (min: 1) |

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "detail": "OTP sent to your email. It expires in 5 minutes."
  }
}
```

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Invalid request body` | Missing or invalid fields |
| `403` | `Captcha verification failed` | Turnstile token is invalid or expired |
| `429` | *(set by rate limiter middleware)* | Too many OTP requests from this IP |
| `500` | `Captcha verification error` | Internal error contacting Cloudflare |
| `500` | `Failed to send OTP — please try again` | Redis storage or email sending failed |

---

### POST /api/vote/verify

Verifies the OTP and records the vote in the database. On success, the updated leaderboard is automatically broadcast to all connected WebSocket clients.

#### Request Body
```json
{
  "email": "voter@example.com",
  "otp": "123456",
  "candidate_id": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | Same email used in `request-otp` |
| `otp` | string | ✅ | 6-digit code received via email (exactly 6 characters) |
| `candidate_id` | integer | ✅ | ID of the candidate (min: 1) |

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "detail": "Vote recorded successfully!"
  }
}
```

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Invalid request body` | Missing or invalid fields (e.g. OTP not 6 digits) |
| `409` | `You have already voted` | This email has already cast a vote |
| `422` | `Invalid or expired OTP` | OTP is wrong, tampered, or older than 5 minutes |
| `500` | `Failed to record vote` | Unexpected database error |

---

## Admin Endpoints

---

### POST /api/admin/login

Authenticates an admin and returns a JWT token.

#### Request Body
```json
{
  "email": "admin@example.com",
  "password": "secure_admin_password"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | Admin email address |
| `password` | string | ✅ | Admin password |

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Invalid request body` | Missing or malformed fields |
| `401` | `Invalid email or password` | Credentials do not match any admin account |

---

### POST /api/admin/candidates

Adds a new candidate with an optional image. This endpoint uses `multipart/form-data`.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

#### Form-Data Parameters
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | ✅ | Candidate's full name |
| `description` | string | ❌ | Candidate biography/platform |
| `image` | File | ❌ | Image file (PNG, JPG, etc.) |

#### Success Response `201 Created`
```json
{
  "message": "success",
  "data": {
    "detail": "Candidate added successfully",
    "candidate_id": 5
  }
}
```

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `name is required` | The `name` form field is missing or empty |
| `401` | `Unauthorized` | JWT token is missing, invalid, or expired |
| `500` | `Failed to save image` | Could not write the uploaded image to disk |
| `500` | `Failed to add candidate` | Database insertion failed |

---

## Real-Time & System Endpoints

---

### GET /ws

WebSocket endpoint for receiving live leaderboard updates.

> **Authentication**: This endpoint is **public** — no token is required to connect. Any client can subscribe to live results.

#### Connection
```
ws://localhost:8080/ws
```

#### Behavior
1. Client connects to `ws://localhost:8080/ws`.
2. Upon connection, the server immediately sends the current leaderboard snapshot.
3. Whenever a new vote is successfully verified via `POST /api/vote/verify`, the server broadcasts the updated leaderboard to **all** connected clients.

#### Message Format (Server → Client)
```json
{
  "candidates": [
    {
      "id": 1,
      "name": "Jane Doe",
      "description": "Visionary leader for a better future.",
      "image_path": "/uploads/uuid-filename.png",
      "total_votes": 151,
      "created_at": "2024-02-23T10:00:00Z"
    },
    {
      "id": 2,
      "name": "John Smith",
      "description": "Building bridges, not walls.",
      "image_path": "",
      "total_votes": 140,
      "created_at": "2024-02-23T10:05:00Z"
    }
  ]
}
```

---

### GET /health

Simple health check to monitor server status.

#### Success Response `200 OK`
```json
{
  "status": "ok"
}
```

---

*Last Updated: 2026-02-23*
