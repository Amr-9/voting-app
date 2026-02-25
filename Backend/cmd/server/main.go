package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"votingsystem/internal/config"
	"votingsystem/internal/database"
	"votingsystem/internal/email"
	"votingsystem/internal/handler"
	"votingsystem/internal/repository"
	"votingsystem/internal/router"
	"votingsystem/internal/service"
	"votingsystem/internal/ws"
)

func main() {
	// Initialize structured JSON logger for production-friendly log output
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting Real-Time Voting System...")

	// Load configuration from environment / .env file
	cfg := config.Load()

	// Initialize MariaDB connection (with retry for Docker startup)
	db := database.NewDB(cfg.DBDSN)
	defer db.Close()

	// Run schema migrations and seed default admin if needed
	database.RunMigrations(db)
	database.SeedDefaultAdmin(db, cfg.AdminDefaultEmail, cfg.AdminDefaultPassword)

	// Initialize Redis client
	redisClient := database.NewRedis(cfg.RedisAddr, cfg.RedisPassword)
	defer redisClient.Close()

	// Initialize email queue service
	emailSvc := email.New(email.Config{
		RedisAddr:     cfg.RedisAddr,
		RedisPassword: cfg.RedisPassword,
		SMTPHost:      cfg.SMTPHost,
		SMTPPort:      cfg.SMTPPort,
		SMTPUser:      cfg.SMTPUser,
		SMTPPass:      cfg.SMTPPass,
		SMTPFrom:      cfg.SMTPFrom,
		DB:            db,
	})
	defer emailSvc.Close()

	// Start the email worker in the background
	emailServer := emailSvc.NewServer()
	if err := emailServer.Start(emailSvc.NewServeMux()); err != nil {
		slog.Error("Failed to start email worker", "error", err)
		os.Exit(1)
	}
	defer emailServer.Shutdown()

	// Build repository layer
	adminRepo := repository.NewAdminRepository(db)
	candidateRepo := repository.NewCandidateRepository(db)
	voteRepo := repository.NewVoteRepository(db)
	votingSettingsRepo := repository.NewVotingSettingsRepository(db)
	customDomainRepo := repository.NewCustomDomainRepository(db, redisClient)

	// Warm the custom domain Redis cache from DB on startup.
	if err := customDomainRepo.WarmCache(context.Background()); err != nil {
		slog.Warn("Failed to warm custom domain cache — DB fallback active", "error", err)
	}

	// WebSocket Hub — start the event loop in a background goroutine
	hub := ws.NewHub()
	go hub.Run()

	// Build service layer
	captchaSvc := service.NewCaptchaService(cfg.TurnstileSecret)
	rateLimitSvc := service.NewRateLimitService(redisClient, cfg.RateLimitMax)
	adminSvc := service.NewAdminService(adminRepo, cfg.JWTSecret)

	// VotingSettingsService receives hub + candidateRepo so it can broadcast
	// the updated state to all WS clients when an admin changes settings.
	votingSettingsSvc := service.NewVotingSettingsService(votingSettingsRepo, redisClient, hub, candidateRepo)

	otpSvc := service.NewOTPService(redisClient, emailSvc)

	// VoteService receives votingSettingsSvc so the WS broadcast includes voting_status.
	voteSvc := service.NewVoteService(voteRepo, candidateRepo, otpSvc, hub, votingSettingsSvc)

	// Build handler layer
	adminHandler := handler.NewAdminHandler(adminSvc, candidateRepo, customDomainRepo, "./uploads")
	candidateHandler := handler.NewCandidateHandler(candidateRepo)
	voteHandler := handler.NewVoteHandler(otpSvc, voteSvc, captchaSvc, votingSettingsSvc, customDomainRepo)
	votingSettingsHandler := handler.NewVotingSettingsHandler(votingSettingsSvc)

	// Ensure uploads directory exists
	if err := os.MkdirAll("./uploads", 0755); err != nil {
		slog.Error("Failed to create uploads directory", "error", err)
		os.Exit(1)
	}

	// snapshotFn is called for every new WebSocket connection to deliver the
	// current candidates + voting_status immediately (no round-trip, no polling).
	// The same function is used on reconnect, so users always get fresh data.
	snapshotFn := func() []byte {
		ctx := context.Background()
		data, err := service.BuildWSPayload(ctx, candidateRepo, votingSettingsSvc)
		if err != nil {
			slog.Warn("Failed to build initial WS snapshot", "error", err)
			return nil
		}
		return data
	}

	// Assemble the Gin router
	engine := router.Setup(hub, snapshotFn, adminHandler, candidateHandler, voteHandler, votingSettingsHandler, cfg.JWTSecret, rateLimitSvc, cfg.CORSAllowedOrigins)

	// Configure the HTTP server with timeouts
	srv := &http.Server{
		Addr:         ":" + cfg.AppPort,
		Handler:      engine,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine to allow graceful shutdown
	go func() {
		slog.Info("Server listening", "port", cfg.AppPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server error", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for OS interrupt / termination signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutdown signal received — gracefully stopping server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Server exited cleanly")
}
