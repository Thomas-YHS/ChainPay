package services

import (
	"log"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/shopspring/decimal"
)

func StartCron(employeeSvc *EmployeeService, payrollSvc *PayrollService, cronEnabled bool) {
	if !cronEnabled {
		log.Println("Cron disabled by config — auto payout will not run")
		return
	}
	c := cron.New(
		cron.WithChain(
			// H-7 fixed: SkipIfStillRunning prevents double-firing if previous run hasn't finished
			cron.SkipIfStillRunning(cron.DefaultLogger),
		),
	)
	_, err := c.AddFunc("0 0 * * *", func() {
		runScheduledPayroll(employeeSvc, payrollSvc)
	})
	if err != nil {
		log.Printf("Failed to register cron job: %v", err)
		return
	}
	c.Start()
	log.Println("Cron scheduler started: runs daily at UTC 00:00, skip-if-still-running enabled")
}

func runScheduledPayroll(employeeSvc *EmployeeService, payrollSvc *PayrollService) {
	now := time.Now().Unix()

	var employees []struct {
		WalletAddress   string
		EmployerAddress string
		SalaryAmount    string
		PayFrequency    string
		NextPayDate     int64
	}

	err := employeeSvc.DB().Table("employees").
		Select("wallet_address, employer_address, salary_amount, pay_frequency, next_pay_date").
		Where("next_pay_date <= ? AND has_rules = ? AND cron_enabled = ?", now, true, true).
		Scan(&employees).Error
	if err != nil {
		log.Printf("Cron: failed to query employees: %v", err)
		return
	}

	for _, emp := range employees {
		if emp.EmployerAddress == "" {
			continue
		}

		salary, err := decimal.NewFromString(emp.SalaryAmount)
		if err != nil {
			log.Printf("Cron: invalid salary for %s: %v", emp.WalletAddress, err)
			continue
		}

		_, result, err := payrollSvc.ExecutePayout(emp.EmployerAddress, emp.WalletAddress, salary, "cron")
		if err != nil {
			log.Printf("Cron: payout failed for %s: %v", emp.WalletAddress, err)
			continue
		}
		if result == nil {
			log.Printf("Cron: no log created for %s", emp.WalletAddress)
			continue
		}

		// M-5 fixed: check update result, and update next_pay_date only after successful payout
		// Note: awaitReceipt runs async, so "pending" status is expected immediately.
		// We optimistically advance next_pay_date on broadcast success.
		nextDate := calcNextPayDate(emp.PayFrequency)
		res := employeeSvc.DB().Model(&struct{}{}).Table("employees").
			Where("wallet_address = ?", emp.WalletAddress).
			Update("next_pay_date", nextDate)
		if res.Error != nil {
			log.Printf("Cron: failed to update next_pay_date for %s (log_id=%d): %v",
				emp.WalletAddress, result.ID, res.Error)
		} else {
			log.Printf("Cron: payout prepared for %s (log_id=%d)",
				emp.WalletAddress, result.ID)
		}
	}
}
