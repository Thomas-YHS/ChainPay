package services

import (
	"errors"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/chainpay/backend/config"
	"github.com/chainpay/backend/db"
	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	USDC_BASE     = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
	BASE_CHAIN_ID = 8453
)

type PayrollService struct {
	db    *gorm.DB
	cfg   *config.Config
	rules RulesProvider
}

// NewPayrollService creates a PayrollService. EarnService is no longer used in employer-direct mode.
func NewPayrollService(database *gorm.DB, cfg *config.Config, rules RulesProvider) *PayrollService {
	return &PayrollService{db: database, cfg: cfg, rules: rules}
}

func (s *PayrollService) DB() *gorm.DB { return s.db }

type Rule struct {
	ChainID      *big.Int       `json:"chainId"`
	TokenAddress common.Address `json:"tokenAddress"`
	Percentage   *big.Int       `json:"percentage"`
}

// ExecutePayout 前端驱动模式：后端只返回员工的分账规则，前端直接用雇主钱包调用 LiFi，签名广播交易。
// 后端只负责数据存储和日志记录。
func (s *PayrollService) ExecutePayout(
	employerAddress string,
	employeeAddress string,
	salaryAmount decimal.Decimal,
	triggerType string,
) ([]Rule, *db.PayrollLog, error) {
	// 归属校验
	var emp db.Employee
	if err := s.db.Where("wallet_address = ?", employeeAddress).First(&emp).Error; err != nil {
		return nil, nil, err
	}
	if !strings.EqualFold(emp.EmployerAddress, employerAddress) {
		return nil, nil, errors.New("forbidden: this employee is not yours")
	}

	salaryStr := salaryAmount.Shift(6).String() // USDC 精度 6 位

	// 获取员工规则，无规则则默认 100% USDC
	rules, err := s.rules.GetRules(employeeAddress)
	if err != nil || len(rules) == 0 {
		rules = []Rule{{
			ChainID:      big.NewInt(BASE_CHAIN_ID),
			TokenAddress: common.HexToAddress(USDC_BASE),
			Percentage:   big.NewInt(10000),
		}}
	}

	// 为每条规则创建 pending PayrollLog
	now := time.Now().Unix()
	var firstLog *db.PayrollLog
	for _, rule := range rules {
		amountBig, _ := new(big.Int).SetString(salaryStr, 10)
		ruleAmount := new(big.Int).Mul(amountBig, rule.Percentage)
		ruleAmount = new(big.Int).Div(ruleAmount, big.NewInt(10000))
		if ruleAmount.Cmp(big.NewInt(0)) == 0 {
			continue
		}

		logEntry := &db.PayrollLog{
			EmployerAddress: employerAddress,
			EmployeeAddress: employeeAddress,
			Amount:          salaryAmount,
			Status:          "pending",
			TriggerType:     triggerType,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if err := s.db.Create(logEntry).Error; err != nil {
			return nil, nil, err
		}
		if firstLog == nil {
			firstLog = logEntry
		}
	}

	return rules, firstLog, nil
}

// AwaitReceipt 异步等待交易回执并更新 PayrollLog 状态。
// 注意：当前架构下后端不持有 ethClient，此方法暂不实现链上回执查询。
// 前端可直接通过链上 API 查询 tx 状态。
func (s *PayrollService) AwaitReceipt(txHash string, logID uint64) {
	log.Printf("AwaitReceipt: tx %s log %d — async polling not implemented in employer-direct mode", txHash, logID)
}