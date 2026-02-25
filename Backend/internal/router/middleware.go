package router

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// registerMiddleware attaches all global middleware to the engine.
// allowedOrigins is a comma-separated list of allowed CORS origins
// (e.g. "https://vote.com,https://admin.vote.com").
func registerMiddleware(r *gin.Engine, allowedOrigins string) {
	// Structured request logger and panic recovery
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS — origins loaded from CORS_ALLOWED_ORIGINS env var
	origins := strings.Split(allowedOrigins, ",")
	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
}
