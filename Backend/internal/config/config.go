package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	AppPort string

	// Database
	DBDSN string

	// Redis
	RedisAddr     string
	RedisPassword string

	// JWT
	JWTSecret string

	// CORS
	CORSAllowedOrigins string

	// Default admin (seeded on first run)
	AdminDefaultEmail    string
	AdminDefaultPassword string

	// SMTP
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	// Cloudflare Turnstile
	TurnstileSecret string

	// Rate limiting
	RateLimitMax int
}

// Load reads .env (if present) and returns a populated Config.
func Load() *Config {
	// Load .env file — ignore error if it doesn't exist (e.g. in Docker with real env vars)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment variables")
	}

	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	rateLimitMax, _ := strconv.Atoi(getEnv("RATE_LIMIT_MAX", "5"))

	return &Config{
		AppPort:              getEnv("APP_PORT", "8071"),
		DBDSN:                getEnv("DB_DSN", "root:@tcp(localhost:3306)/voting_db?parseTime=true"),
		RedisAddr:            getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		JWTSecret:            getEnv("JWT_SECRET"),
		CORSAllowedOrigins:   getEnv("CORS_ALLOWED_ORIGINS"),
		AdminDefaultEmail:    getEnv("ADMIN_DEFAULT_EMAIL"),
		AdminDefaultPassword: getEnv("ADMIN_DEFAULT_PASSWORD"),
		SMTPHost:             getEnv("SMTP_HOST"),
		SMTPPort:             smtpPort,
		SMTPUser:             getEnv("SMTP_USER"),
		SMTPPass:             getEnv("SMTP_PASS"),
		SMTPFrom:             getEnv("SMTP_FROM"),
		TurnstileSecret:      getEnv("TURNSTILE_SECRET"),
		RateLimitMax:         rateLimitMax,
	}
}

// getEnv returns the value of the environment variable.
// If not set, returns the optional defaultVal (empty string if omitted).
func getEnv(key string, defaultVal ...string) string {
	if val, exists := os.LookupEnv(key); exists && val != "" {
		return val
	}
	if len(defaultVal) > 0 {
		return defaultVal[0]
	}
	return ""
}
