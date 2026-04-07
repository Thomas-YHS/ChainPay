package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/chainpay/backend/db"
	"github.com/chainpay/backend/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PayrollHandler struct {
	payrollSvc  *services.PayrollService
	employeeSvc *services.EmployeeService
}

func NewPayrollHandler(payrollSvc *services.PayrollService, employeeSvc *services.EmployeeService) *PayrollHandler {
	return &PayrollHandler{payrollSvc: payrollSvc, employeeSvc: employeeSvc}
}

// POST /api/v1/payroll/execute
func (h *PayrollHandler) Execute(c *gin.Context) {
	employer := c.GetString("wallet")
	var req struct {
		EmployeeWallet string `json:"employee_wallet" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "employee_wallet is required", "data": nil})
		return
	}

	emp, err := h.employeeSvc.GetByWallet(req.EmployeeWallet)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	if !emp.HasRules {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "employee has not set rules yet", "data": nil})
		return
	}

	log, err := h.payrollSvc.ExecutePayout(employer, req.EmployeeWallet, emp.SalaryAmount, "manual")
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "not configured") || strings.Contains(msg, "no rules") {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": msg, "data": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "contract execution failed: " + msg, "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "payout executed", "data": gin.H{
		"log_id":     log.ID,
		"tx_hash":    log.TxHash,
		"amount":     log.Amount.String(),
		"status":    log.Status,
		"created_at": log.CreatedAt,
	}})
}

// GET /api/v1/payroll/logs
func (h *PayrollHandler) ListLogs(c *gin.Context) {
	employer := c.GetString("wallet")
	employeeFilter := c.Query("employee_wallet")
	statusFilter := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	query := h.payrollSvc.DB().Model(&db.PayrollLog{}).Where("employer_address = ?", employer)
	if employeeFilter != "" {
		query = query.Where("employee_address = ?", employeeFilter)
	}
	// M-2 fixed: validate status against allowed values
	if statusFilter != "" {
		if !map[string]bool{"pending": true, "success": true, "failed": true}[statusFilter] {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid status value", "data": nil})
			return
		}
		query = query.Where("status = ?", statusFilter)
	}
	query.Count(&total)

	var logs []db.PayrollLog
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs)

	// M-1 fixed: batch-fetch employee names instead of N+1 individual queries
	result, err := h.enrichLogsWithEmployeeNames(logs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"logs":      result,
	}})
}

// GET /api/v1/payroll/logs/:id
func (h *PayrollHandler) GetLog(c *gin.Context) {
	employer := c.GetString("wallet") // M-6 fixed: verify ownership
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid id", "data": nil})
		return
	}
	var log db.PayrollLog
	if err := h.payrollSvc.DB().First(&log, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "log not found", "data": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	// M-6 fixed: verify the log belongs to the caller
	if !strings.EqualFold(log.EmployerAddress, employer) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "forbidden", "data": nil})
		return
	}

	emp, _ := h.employeeSvc.GetByWallet(log.EmployeeAddress)
	name := ""
	if emp != nil {
		name = emp.Name
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": gin.H{
		"id":               log.ID,
		"employer_address":  log.EmployerAddress,
		"employee_address":  log.EmployeeAddress,
		"employee_name":     name,
		"amount":           log.Amount.String(),
		"tx_hash":          log.TxHash,
		"status":           log.Status,
		"trigger_type":     log.TriggerType,
		"error_message":    log.ErrorMessage,
		"created_at":       log.CreatedAt,
		"updated_at":       log.UpdatedAt,
	}})
}

// enrichLogsWithEmployeeNames fetches employee names for all logs in a single query.
func (h *PayrollHandler) enrichLogsWithEmployeeNames(logs []db.PayrollLog) ([]gin.H, error) {
	if len(logs) == 0 {
		return nil, nil
	}
	addrs := make([]string, len(logs))
	for i, l := range logs {
		addrs[i] = l.EmployeeAddress
	}

	var employees []db.Employee
	if err := h.employeeSvc.DB().
		Where("wallet_address IN ?", addrs).
		Find(&employees).Error; err != nil {
		return nil, err
	}
	nameMap := make(map[string]string, len(employees))
	for _, e := range employees {
		nameMap[e.WalletAddress] = e.Name
	}

	result := make([]gin.H, len(logs))
	for i, l := range logs {
		result[i] = gin.H{
			"id":               l.ID,
			"employer_address":  l.EmployerAddress,
			"employee_address":  l.EmployeeAddress,
			"employee_name":     nameMap[l.EmployeeAddress],
			"amount":           l.Amount.String(),
			"tx_hash":          l.TxHash,
			"status":           l.Status,
			"trigger_type":     l.TriggerType,
			"created_at":       l.CreatedAt,
			"updated_at":       l.UpdatedAt,
		}
	}
	return result, nil
}
