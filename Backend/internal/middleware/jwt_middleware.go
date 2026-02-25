package middleware

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTAuth returns a Gin middleware that validates the admin_token HttpOnly cookie.
// On success, it sets "adminID" and "adminEmail" in the Gin context.
func JWTAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := c.Cookie("admin_token")
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			// Enforce HS256 — reject tokens with unexpected algorithms (alg:none attack)
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			slog.Warn("Invalid JWT token", "error", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		// Inject admin info into the context for downstream handlers
		c.Set("adminID", claims["sub"])
		c.Set("adminEmail", claims["email"])
		c.Next()
	}
}
