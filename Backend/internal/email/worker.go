package email

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/smtp"
	"time"

	"github.com/hibiken/asynq"
)

// NewServer creates an Asynq server with retry config and an error handler
// that logs permanently failed emails to the database.
func (s *Service) NewServer() *asynq.Server {
	return asynq.NewServer(
		asynq.RedisClientOpt{
			Addr:     s.cfg.RedisAddr,
			Password: s.cfg.RedisPassword,
		},
		asynq.Config{
			Concurrency: 100,
			Queues:      map[string]int{"email": 1},
			// Fixed 20-second delay between each retry attempt.
			RetryDelayFunc: func(_ int, _ error, _ *asynq.Task) time.Duration {
				return 20 * time.Second
			},
			// When all retries are exhausted, log the failure to the database.
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				retried, _ := asynq.GetRetryCount(ctx)
				maxRetry, _ := asynq.GetMaxRetry(ctx)
				if retried >= maxRetry {
					var p emailPayload
					if jsonErr := json.Unmarshal(task.Payload(), &p); jsonErr != nil {
						slog.Error("Failed to parse failed email task payload", "error", jsonErr)
						return
					}
					s.logFailedEmail(p.To, err.Error(), retried)
				}
			}),
		},
	)
}

// NewServeMux registers the email task handler and returns the mux.
func (s *Service) NewServeMux() *asynq.ServeMux {
	mux := asynq.NewServeMux()
	mux.HandleFunc(taskTypeEmail, s.handleEmailTask)
	return mux
}

// handleEmailTask is the worker handler — unmarshals the payload and sends the email.
func (s *Service) handleEmailTask(_ context.Context, t *asynq.Task) error {
	var p emailPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("email: failed to parse task payload: %w", err)
	}

	if err := s.sendSMTP(p.To, p.Subject, p.Body); err != nil {
		slog.Error("Worker failed to send email", "to", p.To, "error", err)
		return err // Asynq will retry automatically
	}

	slog.Info("Email sent by worker", "to", p.To)
	return nil
}

// sendSMTP delivers the email directly via SMTP with STARTTLS.
func (s *Service) sendSMTP(to, subject, body string) error {
	auth := smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPass, s.cfg.SMTPHost)

	msg := "From: " + s.cfg.SMTPFrom + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" + body

	addr := fmt.Sprintf("%s:%d", s.cfg.SMTPHost, s.cfg.SMTPPort)
	return smtp.SendMail(addr, auth, s.cfg.SMTPFrom, []string{to}, []byte(msg))
}

// logFailedEmail records a permanently failed email in the database
// after all retry attempts have been exhausted.
func (s *Service) logFailedEmail(to, errMsg string, retries int) {
	if s.cfg.DB == nil {
		return
	}
	_, err := s.cfg.DB.ExecContext(context.Background(), `
		INSERT INTO email_send_log (to_address, status, error_message, retry_count)
		VALUES (?, 'failed', ?, ?)
	`, to, errMsg, retries)
	if err != nil {
		slog.Error("Failed to log email failure to DB", "to", to, "error", err)
		return
	}
	slog.Warn("Email permanently failed and logged", "to", to, "retries", retries)
}
