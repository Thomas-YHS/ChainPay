package middleware

import (
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
)

var walletRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

func WalletAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		wallet := c.GetHeader("X-Wallet-Address")
		if !walletRegex.MatchString(wallet) {
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
