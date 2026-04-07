package middleware

import (
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// exported for reuse in handlers (M-3 fixed)
var WalletRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

func WalletAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		wallet := c.GetHeader("X-Wallet-Address")
		if !WalletRegex.MatchString(wallet) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "invalid wallet address format",
				"data":    nil,
			})
			return
		}
		c.Set("wallet", wallet)
		c.Next()
	}
}

// CORS returns a minimal CORS middleware (L-6: no gin-contrib dependency needed).
// Allowlist is explicit — add allowed origins before deploying.
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowedMap := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowedMap[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			c.Next()
			return
		}
		if allowedMap[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Wallet-Address, X-Signature, X-Timestamp")
		c.Header("Access-Control-Max-Age", "300") // 5 minutes

		// Signature freshness window (H-1: anti-replay)
		ts := c.GetHeader("X-Timestamp")
		if ts != "" {
			if t, err := strconv.ParseInt(ts, 10, 64); err == nil {
				if time.Now().Unix()-t > 5*60 {
					c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
						"code":    400,
						"message": "signature expired",
						"data":    nil,
					})
					return
				}
			}
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
