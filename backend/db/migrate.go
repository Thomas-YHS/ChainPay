package db

import (
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type Employee struct {
	ID               uint64  `gorm:"primaryKey;autoIncrement" json:"id"`
	EmployerAddress  string  `gorm:"type:varchar(42);not null;index" json:"employer_address"`
	Name             string  `gorm:"type:varchar(100);not null" json:"name"`
	Nickname         string  `gorm:"type:varchar(100)" json:"nickname"`
	WalletAddress    string  `gorm:"type:varchar(42);not null;uniqueIndex" json:"wallet_address"`
	SalaryAmount     decimal.Decimal `gorm:"type:numeric;not null" json:"salary_amount"`
	PayFrequency     string  `gorm:"type:varchar(10);not null" json:"pay_frequency"`
	HasRules         bool    `gorm:"not null;default:false" json:"has_rules"`
	NextPayDate      int64   `gorm:"not null" json:"next_pay_date"` // Unix timestamp
	CreatedAt        int64   `gorm:"not null" json:"created_at"`
	UpdatedAt        int64   `gorm:"not null" json:"updated_at"`
}

type PayrollLog struct {
	ID               uint64  `gorm:"primaryKey;autoIncrement" json:"id"`
	EmployerAddress  string  `gorm:"type:varchar(42);not null;index" json:"employer_address"`
	EmployeeAddress  string  `gorm:"type:varchar(42);not null;index" json:"employee_address"`
	Amount           decimal.Decimal `gorm:"type:numeric;not null" json:"amount"`
	TxHash           string  `gorm:"type:varchar(66)" json:"tx_hash"`
	Status           string  `gorm:"type:varchar(10);not null;default:pending;index" json:"status"`
	TriggerType      string  `gorm:"type:varchar(10);not null;default:manual" json:"trigger_type"`
	ErrorMessage     string  `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt        int64   `gorm:"not null" json:"created_at"`
	UpdatedAt        int64   `gorm:"not null" json:"updated_at"`
}

func Migrate(database *gorm.DB) error {
	return database.AutoMigrate(&Employee{}, &PayrollLog{})
}
