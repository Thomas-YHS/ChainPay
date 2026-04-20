package handlers

import (
	"net/http"

	"github.com/chainpay/backend/config"
	"github.com/gin-gonic/gin"
)

type ConfigHandler struct {
	cfg *config.Config
}

func NewConfigHandler(cfg *config.Config) *ConfigHandler {
	return &ConfigHandler{cfg: cfg}
}

// GET /api/v1/config/rules-mode
func (h *ConfigHandler) GetRulesMode(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    gin.H{"mode": h.cfg.Blockchain.RulesMode},
	})
}
