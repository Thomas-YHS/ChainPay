package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/chainpay/backend/db"
	"github.com/chainpay/backend/services"
	"github.com/gin-gonic/gin"
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

	// Get employee from DB
	emp, err := h.employeeSvc.GetByWallet(req.EmployeeWallet)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if !emp.HasRules {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "employee has not set rules yet", "data": nil})
		return
	}

	log, err := h.payrollSvc.ExecutePayout(employer, req.EmployeeWallet, emp.SalaryAmount)
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
		"amount":    log.Amount.String(),
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

	var logs []db.PayrollLog
	var total int64
	query := h.payrollSvc.DB().Where("employer_address = ?", employer)
	if employeeFilter != "" {
		query = query.Where("employee_address = ?", employeeFilter)
	}
	if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}
	query.Count(&total)
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs)

	// Enrich with employee names
	var result []gin.H
	for _, log := range logs {
		emp, _ := h.employeeSvc.GetByWallet(log.EmployeeAddress)
		name := ""
		if emp != nil {
			name = emp.Name
		}
		result = append(result, gin.H{
			"id":               log.ID,
			"employer_address":  log.EmployerAddress,
			"employee_address":  log.EmployeeAddress,
			"employee_name":     name,
			"amount":           log.Amount.String(),
			"tx_hash":          log.TxHash,
			"status":           log.Status,
			"trigger_type":     log.TriggerType,
			"created_at":       log.CreatedAt,
			"updated_at":       log.UpdatedAt,
		})
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
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid id", "data": nil})
		return
	}
	var log db.PayrollLog
	if err := h.payrollSvc.DB().First(&log, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "log not found", "data": nil})
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
