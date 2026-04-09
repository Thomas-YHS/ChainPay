package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/chainpay/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// walletRegex is shared with the middleware to avoid re-compiling on every request (M-3).
var walletRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

type EmployeeHandler struct {
	svc *services.EmployeeService
}

func NewEmployeeHandler(svc *services.EmployeeService) *EmployeeHandler {
	return &EmployeeHandler{svc: svc}
}

// POST /api/v1/employees
func (h *EmployeeHandler) Create(c *gin.Context) {
	employer := c.GetString("wallet")
	var req services.CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}
	if !walletRegex.MatchString(req.WalletAddress) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid wallet address format", "data": nil})
		return
	}
	if !map[string]bool{"daily": true, "weekly": true, "monthly": true}[req.PayFrequency] {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid pay_frequency", "data": nil})
		return
	}

	// H-4 fixed: validate salary is positive
	salary, err := decimal.NewFromString(req.SalaryAmount)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid salary_amount", "data": nil})
		return
	}
	if salary.LessThanOrEqual(decimal.Zero) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "salary_amount must be positive", "data": nil})
		return
	}

	emp, err := h.svc.Create(req, employer)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "already exists") {
			c.JSON(http.StatusConflict, gin.H{"code": 409, "message": "employee wallet address already registered", "data": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": msg, "data": nil})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 201, "message": "success", "data": emp})
}

// GET /api/v1/employees
func (h *EmployeeHandler) List(c *gin.Context) {
	employer := c.GetString("wallet")
	employees, err := h.svc.ListByEmployer(employer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": gin.H{"total": len(employees), "employees": employees}})
}

// GET /api/v1/employees/:wallet_address
func (h *EmployeeHandler) Get(c *gin.Context) {
	wallet := c.Param("wallet_address")
	emp, err := h.svc.GetByWallet(wallet)
	// H-5 fixed: correct error handling — ErrRecordNotFound -> 404, other errors -> 500
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": emp})
}

// DELETE /api/v1/employees/:wallet_address
func (h *EmployeeHandler) Delete(c *gin.Context) {
	wallet := c.Param("wallet_address")
	employer := c.GetString("wallet")
	if err := h.svc.Delete(wallet, employer); err != nil {
		msg := err.Error()
		if strings.Contains(msg, "forbidden") {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": msg, "data": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": msg, "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "employee deleted", "data": nil})
}

// GET /api/v1/employees/:wallet_address/verify
func (h *EmployeeHandler) Verify(c *gin.Context) {
	wallet := c.Param("wallet_address")
	emp, err := h.svc.GetByWallet(wallet)
	// H-5 fixed: same pattern as Get()
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": gin.H{"exists": false}})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": gin.H{
		"exists":           true,
		"has_rules":        emp.HasRules,
		"employer_address": emp.EmployerAddress,
		"name":             emp.Name,
		"salary_amount":    emp.SalaryAmount.String(),
	}})
}

// PATCH /api/v1/employees/:wallet_address/rules-status
func (h *EmployeeHandler) UpdateRulesStatus(c *gin.Context) {
	wallet := c.Param("wallet_address")
	caller := c.GetString("wallet") // H-1/H-4: the caller claiming this wallet

	var body struct{ HasRules bool `json:"has_rules"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request", "data": nil})
		return
	}

	// C-4 fixed: authorization — only the employee themselves can update their rules status
	emp, err := h.svc.GetByWallet(wallet)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	// Only the employee wallet itself may call this endpoint
	if !strings.EqualFold(emp.WalletAddress, caller) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "forbidden: you are not this employee", "data": nil})
		return
	}

	if err := h.svc.UpdateRulesStatus(wallet, body.HasRules); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "rules status updated", "data": nil})
}

// GET /api/v1/employees/:wallet_address/auto-invest
func (h *EmployeeHandler) GetAutoInvest(c *gin.Context) {
	wallet := c.Param("wallet_address")
	caller := c.GetString("wallet")

	emp, err := h.svc.GetByWallet(wallet)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	// Only employee themselves can view their auto-invest config
	if !strings.EqualFold(emp.WalletAddress, caller) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "forbidden: you are not this employee", "data": nil})
		return
	}

	cfg, err := h.svc.GetAutoInvest(wallet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": cfg})
}

// PATCH /api/v1/employees/:wallet_address/auto-invest
func (h *EmployeeHandler) UpdateAutoInvest(c *gin.Context) {
	wallet := c.Param("wallet_address")
	caller := c.GetString("wallet")

	emp, err := h.svc.GetByWallet(wallet)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	// Only employee themselves can update their auto-invest config
	if !strings.EqualFold(emp.WalletAddress, caller) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "forbidden: you are not this employee", "data": nil})
		return
	}

	var body struct {
		Enabled     bool   `json:"enabled"`
		VaultID     string `json:"vault_id"`
		InvestType  string `json:"invest_type"`  // "percentage" or "fixed"
		InvestValue string `json:"invest_value"` // basis points or USDC amount
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request", "data": nil})
		return
	}
	if body.Enabled && (body.VaultID == "" || body.InvestType == "" || body.InvestValue == "") {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "vault_id, invest_type, and invest_value are required when enabled", "data": nil})
		return
	}
	if body.InvestType != "" && body.InvestType != "percentage" && body.InvestType != "fixed" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invest_type must be 'percentage' or 'fixed'", "data": nil})
		return
	}
	if body.Enabled && body.InvestType == "percentage" {
		// basis points: 0-10000 (0%-100%)
		var bp int64
		fmt.Sscanf(body.InvestValue, "%d", &bp)
		if bp < 0 || bp > 10000 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "percentage must be between 0 and 10000 basis points (0-100%)", "data": nil})
			return
		}
	}
	if body.Enabled && body.InvestType == "fixed" {
		// fixed USDC amount: must be positive
		amount, err := decimal.NewFromString(body.InvestValue)
		if err != nil || amount.LessThanOrEqual(decimal.Zero) {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "fixed amount must be a positive number", "data": nil})
			return
		}
	}

	cfg := services.AutoInvestConfig{
		Enabled:    body.Enabled,
		VaultID:    body.VaultID,
		InvestType: body.InvestType,
		InvestValue: body.InvestValue,
	}
	if err := h.svc.UpdateAutoInvest(wallet, cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "auto-invest config updated", "data": nil})
}
