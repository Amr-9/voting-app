package router

import (
	"net/http"

	"votingsystem/internal/handler"
	"votingsystem/internal/middleware"
	"votingsystem/internal/service"
	"votingsystem/internal/ws"

	"github.com/gin-gonic/gin"
)

// Setup builds and returns the Gin engine with all routes registered.
// snapshotFn is called on each new WebSocket connection to produce an initial state payload.
// allowedOrigins is a comma-separated list of allowed CORS origins (e.g. "https://vote.com,https://admin.vote.com").
func Setup(
	hub *ws.Hub,
	snapshotFn func() []byte,
	adminHandler *handler.AdminHandler,
	candidateHandler *handler.CandidateHandler,
	voteHandler *handler.VoteHandler,
	votingSettingsHandler *handler.VotingSettingsHandler,
	jwtSecret string,
	rateLimitSvc *service.RateLimitService,
	allowedOrigins string,
) *gin.Engine {
	r := gin.New()
	registerMiddleware(r, allowedOrigins)

	// Serve uploaded candidate images as static files
	r.Static("/uploads", "./uploads")

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// WebSocket endpoint — clients connect here to receive live vote updates.
	// snapshotFn ensures every client gets the current state immediately on connect/reconnect.
	r.GET("/ws", func(c *gin.Context) {
		ws.ServeWS(hub, snapshotFn, c.Writer, c.Request)
	})

	api := r.Group("/api")
	{
		// Public: vote operations
		vote := api.Group("/vote")
		{
			// Rate limiting applied only to OTP requests to prevent email spam/abuse
			vote.POST("/request-otp",
				middleware.RateLimit(rateLimitSvc),
				voteHandler.RequestOTP,
			)
			vote.POST("/verify", voteHandler.VerifyVote)
		}

		// Public: candidate listing
		api.GET("/candidates", candidateHandler.GetCandidates)

		// Public: current voting status (open/closed + ends_at)
		api.GET("/voting-status", votingSettingsHandler.GetVotingStatus)

		// Admin login/logout are public (login issues the cookie, logout clears it)
		api.POST("/admin/login", adminHandler.Login)
		api.POST("/admin/logout", adminHandler.Logout)

		// Admin routes — protected by JWT cookie middleware
		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth(jwtSecret))
		{
			admin.GET("/me", adminHandler.Me)
			admin.PUT("/change-password", adminHandler.ChangePassword)
			admin.POST("/candidates", adminHandler.AddCandidate)
			admin.PUT("/candidates/:id", adminHandler.UpdateCandidate)
			admin.DELETE("/candidates/:id", adminHandler.DeleteCandidate)
			admin.PUT("/voting-settings", votingSettingsHandler.UpdateVotingSettings)
			admin.GET("/email-domains", adminHandler.ListDomains)
			admin.POST("/email-domains", adminHandler.AddDomain)
			admin.DELETE("/email-domains/:id", adminHandler.DeleteDomain)
			admin.PUT("/email-domains/mode", votingSettingsHandler.UpdateDomainMode)
		}
	}

	return r
}
