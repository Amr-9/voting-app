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
// allowedOrigins is a comma-separated list of allowed CORS origins (e.g. "https://vote.com,https://admin.vote.com").
func Setup(
	hub *ws.Hub,
	adminHandler *handler.AdminHandler,
	candidateHandler *handler.CandidateHandler,
	voteHandler *handler.VoteHandler,
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

	// WebSocket endpoint — clients connect here to receive live vote updates
	r.GET("/ws", func(c *gin.Context) {
		ws.ServeWS(hub, c.Writer, c.Request)
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

		// Admin login is public (it issues the token)
		api.POST("/admin/login", adminHandler.Login)

		// Admin routes — protected by JWT middleware
		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth(jwtSecret))
		{
			admin.POST("/candidates", adminHandler.AddCandidate)
			admin.PUT("/candidates/:id", adminHandler.UpdateCandidate)
		}
	}

	return r
}
