# --- Stage 1: Build ---
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build a statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o votingsystem ./cmd/main.go

# --- Stage 2: Final image ---
FROM alpine:3.20

# Install CA certificates for HTTPS (needed for SMTP and Cloudflare Turnstile calls)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/votingsystem .

# Copy SQL migrations (now inside internal/migrations — already included in COPY . .)

# Create the uploads directory (Docker Compose will mount a volume here)
RUN mkdir -p uploads

EXPOSE 8080

CMD ["./votingsystem"]
