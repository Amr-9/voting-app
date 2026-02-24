package email

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jmoiron/sqlx"
)

const taskTypeEmail = "email:send"

// Config holds all settings required by the email service.
type Config struct {
	RedisAddr     string
	RedisPassword string

	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	DB *sqlx.DB
}

// emailPayload is the data stored in the queue for each email task.
type emailPayload struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// Service manages enqueueing emails and sending them via a background worker.
type Service struct {
	cfg    Config
	client *asynq.Client
}

// New creates a new Service and opens an Asynq client connection.
func New(cfg Config) *Service {
	client := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
	})
	slog.Info("Email queue initialized")
	return &Service{cfg: cfg, client: client}
}

// Close shuts down the Asynq client — call on application shutdown.
func (s *Service) Close() {
	if err := s.client.Close(); err != nil {
		slog.Warn("Failed to close email queue client", "error", err)
	}
}

// Enqueue adds an email to the queue for async delivery by the worker.
// Falls back to direct SMTP if the enqueue operation fails.
func (s *Service) Enqueue(to, subject, body string) error {
	payload, err := json.Marshal(emailPayload{To: to, Subject: subject, Body: body})
	if err != nil {
		return fmt.Errorf("email: failed to marshal payload: %w", err)
	}

	task := asynq.NewTask(taskTypeEmail, payload)
	info, err := s.client.Enqueue(task,
		asynq.Queue("email"),
		asynq.MaxRetry(3),
		asynq.Timeout(30*time.Second),
	)
	if err != nil {
		slog.Warn("Email enqueue failed, sending directly", "to", to, "error", err)
		return s.sendSMTP(to, subject, body)
	}

	slog.Info("Email enqueued", "task_id", info.ID, "to", to)
	return nil
}
