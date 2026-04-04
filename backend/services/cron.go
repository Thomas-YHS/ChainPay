package services

import (
	"log"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/shopspring/decimal"
)

func StartCron(employeeSvc *EmployeeService, payrollSvc *PayrollService) {
	c := cron.New()
	_, err := c.AddFunc("0 0 * * *", func() {
		runScheduledPayroll(employeeSvc, payrollSvc)
	})
	if err != nil {
		log.Printf("Failed to register cron job: %v", err)
		return
	}
	c.Start()
	log.Println("Cron scheduler started: runs daily at UTC 00:00")
}

func runScheduledPayroll(employeeSvc *EmployeeService, payrollSvc *PayrollService) {
	now := time.Now().Unix()

	var employees []struct {
		WalletAddress  string
		EmployerAddress string
		SalaryAmount   string
		PayFrequency   string
		NextPayDate    int64
	}

	err := employeeSvc.db.Table("employees").
		Select("wallet_address, employer_address, salary_amount, pay_frequency, next_pay_date").
		Where("next_pay_date <= ? AND has_rules = ?", now, true).
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

		_, err = payrollSvc.ExecutePayout(emp.EmployerAddress, emp.WalletAddress, salary)
		if err != nil {
			log.Printf("Cron: payout failed for %s: %v", emp.WalletAddress, err)
			continue
		}

		nextDate := calcNextPayDate(emp.PayFrequency)
		employeeSvc.db.Model(&struct{}{}).Table("employees").
			Where("wallet_address = ?", emp.WalletAddress).
			Update("next_pay_date", nextDate)

		log.Printf("Cron: payout succeeded for %s", emp.WalletAddress)
	}
}
