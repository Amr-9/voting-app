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

	// Build repository layer
	adminRepo := repository.NewAdminRepository(db)
	candidateRepo := repository.NewCandidateRepository(db)
	voteRepo := repository.NewVoteRepository(db)

	// Build service layer
	captchaSvc := service.NewCaptchaService(cfg.TurnstileSecret)
	rateLimitSvc := service.NewRateLimitService(redisClient, cfg.RateLimitMax)
	adminSvc := service.NewAdminService(adminRepo, cfg.JWTSecret)
	otpSvc := service.NewOTPService(
		redisClient,
		cfg.SMTPHost, cfg.SMTPPort,
		cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPFrom,
	)

	// WebSocket Hub — start the event loop in a background goroutine
	hub := ws.NewHub()
	go hub.Run()

	voteSvc := service.NewVoteService(voteRepo, candidateRepo, otpSvc, hub)

	// Build handler layer
	adminHandler := handler.NewAdminHandler(adminSvc, candidateRepo, "./uploads")
	candidateHandler := handler.NewCandidateHandler(candidateRepo)
	voteHandler := handler.NewVoteHandler(otpSvc, voteSvc, captchaSvc)

	// Ensure uploads directory exists
	if err := os.MkdirAll("./uploads", 0755); err != nil {
		slog.Error("Failed to create uploads directory", "error", err)
		os.Exit(1)
	}

	// Assemble the Gin router
	engine := router.Setup(hub, adminHandler, candidateHandler, voteHandler, cfg.JWTSecret, rateLimitSvc, cfg.CORSAllowedOrigins)

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
