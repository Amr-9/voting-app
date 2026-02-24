# 🗳️ Real-Time Voting System API Documentation

> **Base URL**: `http://localhost:8080` (Default)
> **API Version**: `v1`
> **Content-Type**: `application/json`

---

## 📑 Table of Contents

1. [General Information](#general-information)
2. [Public Endpoints](#public-endpoints)
   - [GET /api/candidates](#get-apicandidates)
   - [GET /api/voting-status](#get-apivoting-status)
   - [POST /api/vote/request-otp](#post-apivoterequest-otp)
   - [POST /api/vote/verify](#post-apivoteverify)
3. [Admin Endpoints](#admin-endpoints)
   - [POST /api/admin/login](#post-apiadminlogin)
   - [PUT /api/admin/change-password](#put-apiadminchange-password)
   - [POST /api/admin/candidates](#post-apiadmincandidates)
   - [PUT /api/admin/candidates/:id](#put-apiadmincandidatesid)
   - [DELETE /api/admin/candidates/:id](#delete-apiadmincandidatesid)
   - [PUT /api/admin/voting-settings](#put-apiadminvoting-settings)
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

### GET /api/voting-status

Returns the current voting status — whether voting is open or closed, and the optional auto-stop time.

> **Authentication**: Public — no token required.

#### Request
`GET /api/voting-status`

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "is_open": true,
    "effectively_open": true,
    "ends_at": "2025-12-31T18:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `is_open` | boolean | Admin-set toggle: `true` = open, `false` = closed |
| `effectively_open` | boolean | `true` only if `is_open=true` AND `ends_at` has not passed yet |
| `ends_at` | string (RFC 3339 UTC) \| `null` | Auto-stop datetime in UTC, or `null` if no auto-stop is set |

> **Important**: Always use `effectively_open` (not `is_open`) on the frontend to determine whether to allow voting. `effectively_open` correctly accounts for the `ends_at` deadline.

#### Error Responses
| Status Code | Description |
|-------------|-------------|
| `500` | Failed to fetch voting status |

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
| `403` | `Voting is currently closed` | Voting has been disabled by an admin or `ends_at` has passed |
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
  "otp": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | Same email used in `request-otp` |
| `otp` | string | ✅ | 6-digit code received via email (exactly 6 characters) |

> **Security note**: `candidate_id` is intentionally absent. The backend reads it from Redis (where it was locked in at OTP-request time) to prevent a candidate-swap attack.

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
| `403` | `Voting is currently closed` | Voting was closed between OTP request and verification |
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

### PUT /api/admin/change-password

Allows an authenticated admin to change their account password. Requires a valid Bearer token.

> **Authentication**: Required — `Authorization: Bearer <jwt_token>`

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "old_password": "current_secure_password",
  "new_password": "new_secure_password_10chars"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `old_password` | string | ✅ | The admin's current password |
| `new_password` | string | ✅ | The desired new password (minimum 10 characters) |

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "detail": "Password changed successfully"
  }
}
```

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Invalid request body` | Missing or malformed fields |
| `400` | `New password must be at least 10 characters` | New password is too short |
| `401` | `Unauthorized` | JWT token is missing, invalid, or expired |
| `401` | `Current password is incorrect` | The supplied `old_password` does not match |
| `500` | `Failed to change password` | Unexpected database error |

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

### PUT /api/admin/candidates/:id

Updates an existing candidate's name, description, and/or image.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Candidate ID |

#### Form-Data Parameters
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | ✅ | Candidate's full name |
| `description` | string | ❌ | Candidate biography/platform |
| `image` | File | ❌ | New image file — replaces the existing one if provided |

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "detail": "Candidate updated successfully"
  }
}
```

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Invalid candidate ID` | ID parameter is not a valid integer ≥ 1 |
| `400` | `name is required` | The `name` form field is missing or empty |
| `401` | `Unauthorized` | JWT token is missing, invalid, or expired |
| `404` | `Candidate not found` | No candidate with the given ID exists |
| `500` | `Failed to save image` | Could not write the image to disk |
| `500` | `Failed to update candidate` | Database update failed |

---

### DELETE /api/admin/candidates/:id

Permanently deletes a candidate **only if they have zero votes**. This protects election data integrity — candidates who have already received votes cannot be removed.

#### Headers
```
Authorization: Bearer <jwt_token>
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Candidate ID |

#### Success Response `204 No Content`
No response body.

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Invalid candidate ID` | ID parameter is not a valid integer ≥ 1 |
| `401` | `Unauthorized` | JWT token is missing, invalid, or expired |
| `404` | `Candidate not found` | No candidate with the given ID exists |
| `409` | `Cannot delete candidate: they already have votes` | The candidate has at least one vote and cannot be deleted |  
| `500` | `Failed to delete candidate` | Unexpected database error |

---

### PUT /api/admin/voting-settings

Allows an admin to toggle voting on/off and optionally set an auto-stop datetime (UTC).

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "is_open": true,
  "ends_at": "2025-12-31T18:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_open` | boolean | ✅ | `true` to open voting, `false` to close it immediately |
| `ends_at` | string (RFC 3339 UTC) \| `null` | ❌ | Auto-stop datetime in UTC. Omit or send `null` to disable auto-stop |

> **UTC timezone**: All datetime values must be sent and are stored in **UTC**. The frontend is responsible for converting to/from the user's local timezone.

> **Auto-stop behavior**: If `is_open=true` and `ends_at` is set, voting automatically closes once `ends_at` passes — no job or cron is needed. The check happens on every vote request using the Redis-cached settings.

#### Success Response `200 OK`
```json
{
  "message": "success",
  "data": {
    "detail": "Voting settings updated successfully"
  }
}
```

#### Error Responses
| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| `400` | `Invalid request body` | Malformed JSON |
| `400` | `ends_at must be a valid RFC 3339 UTC timestamp` | Invalid datetime format |
| `401` | `Unauthorized` | JWT token is missing, invalid, or expired |
| `500` | `Failed to update voting settings` | Database or Redis error |

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
2. Upon connection, the server immediately sends the current leaderboard snapshot and voting status.
3. Whenever a new vote is successfully verified via `POST /api/vote/verify`, or whenever an admin updates the voting settings via `PUT /api/admin/voting-settings`, the server broadcasts the updated payload to **all** connected clients.

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
  ],
  "voting_status": {
    "is_open": true,
    "effectively_open": true,
    "ends_at": "2025-12-31T18:00:00Z"
  }
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

*Last Updated: 2026-02-24*
