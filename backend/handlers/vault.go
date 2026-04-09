package handlers

import (
	"net/http"
	"strconv"

	"github.com/chainpay/backend/services"
	"github.com/gin-gonic/gin"
)

// VaultHandler handles vault discovery endpoints.
type VaultHandler struct {
	earnSvc *services.EarnService
}

// NewVaultHandler creates a VaultHandler.
func NewVaultHandler(earnSvc *services.EarnService) *VaultHandler {
	return &VaultHandler{earnSvc: earnSvc}
}

// GET /api/v1/vaults
// Query params:
//   - chain_id: chain ID (default 8453 = Base)
//   - token: token symbol or address to filter (default USDC)
func (h *VaultHandler) List(c *gin.Context) {
	chainID := int64(8453) // Base mainnet default
	if q := c.Query("chain_id"); q != "" {
		if parsed, err := strconv.ParseInt(q, 10, 64); err == nil {
			chainID = parsed
		}
	}
	token := c.DefaultQuery("token", "USDC")

	vaults, err := h.earnSvc.GetVaults(chainID, token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": gin.H{"total": len(vaults), "vaults": vaults}})
}
