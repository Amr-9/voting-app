package middleware

import (
	"net/http"

	"votingsystem/internal/service"

	"github.com/gin-gonic/gin"
)

// RateLimit returns a Gin middleware that enforces per-IP OTP request limits.
// Uses the RateLimitService backed by Redis.
func RateLimit(svc *service.RateLimitService) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		allowed, err := svc.Allow(c.Request.Context(), ip)
		if err != nil {
			// On Redis error, fail open (allow the request) to avoid availability issues
			c.Next()
			return
		}

		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many OTP requests. Please wait an hour before trying again.",
			})
			return
		}

		c.Next()
	}
}
