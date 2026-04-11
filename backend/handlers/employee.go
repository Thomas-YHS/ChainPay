package handlers

import (
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"regexp"
	"strings"

	"github.com/chainpay/backend/services"
	"github.com/ethereum/go-ethereum/common"
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

// POST /api/v1/employees/:wallet_address/rules
// 仅在 rules_mode: "backend" 时有效；chain 模式返回 405。
func (h *EmployeeHandler) SaveRules(c *gin.Context) {
	if h.svc.RulesMode() != "backend" {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"code": 405, "message": "rules_mode is 'chain': use setRules on the contract", "data": nil})
		return
	}

	wallet := c.Param("wallet_address")
	caller := c.GetString("wallet")

	// 只允许员工本人提交自己的规则
	emp, err := h.svc.GetByWallet(wallet)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	if !strings.EqualFold(emp.WalletAddress, caller) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "forbidden: you are not this employee", "data": nil})
		return
	}

	var body []struct {
		ChainID      int64  `json:"chain_id"`
		TokenAddress string `json:"token_address"`
		Percentage   int64  `json:"percentage"` // 基数 10000
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}
	if len(body) == 0 || len(body) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "rules must be between 1 and 5", "data": nil})
		return
	}
	var total int64
	for _, r := range body {
		total += r.Percentage
	}
	if total != 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "percentages must sum to 10000", "data": nil})
		return
	}

	rules := make([]services.Rule, 0, len(body))
	for _, r := range body {
		rules = append(rules, services.Rule{
			ChainID:      new(big.Int).SetInt64(r.ChainID),
			TokenAddress: common.HexToAddress(r.TokenAddress),
			Percentage:   new(big.Int).SetInt64(r.Percentage),
		})
	}

	if err := h.svc.SaveRules(wallet, rules); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "rules saved", "data": nil})
}
