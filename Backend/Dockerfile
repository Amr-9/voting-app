# ===============================
# 🏗️ Build Stage
# ===============================
FROM golang:1.25-alpine AS builder

# Install required tools
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build a statically linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o server ./cmd/server

# ===============================
# 🚀 Production Stage
# ===============================
FROM alpine:latest

# Install CA certificates for HTTPS (SMTP, Cloudflare Turnstile) and timezone data
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/server .

# Copy SQL migrations so the app can read schema.sql at startup
COPY --from=builder /app/internal/migrations ./internal/migrations

# Create the uploads directory (Docker Compose will mount a volume here)
RUN mkdir -p uploads

EXPOSE 8071

CMD ["./server"]
