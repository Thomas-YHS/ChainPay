package services

import (
	"context"
	"errors"
	"math/big"
	"time"

	"github.com/chainpay/backend/config"
	"github.com/chainpay/backend/db"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"
)

// RulesProvider 定义员工规则的读写接口。
// 有两个实现：ChainRulesProvider（链上合约）和 DBRulesProvider（PostgreSQL）。
type RulesProvider interface {
	GetRules(employeeAddress string) ([]Rule, error)
	SaveRules(employeeAddress string, rules []Rule) error
}

// ---- ChainRulesProvider ----

type ChainRulesProvider struct {
	cfg       *config.Config
	ethClient *ethclient.Client
}

func NewChainRulesProvider(cfg *config.Config, ethClient *ethclient.Client) *ChainRulesProvider {
	return &ChainRulesProvider{cfg: cfg, ethClient: ethClient}
}

// GetRules 从链上合约读取员工规则。
func (p *ChainRulesProvider) GetRules(employeeAddress string) ([]Rule, error) {
	if p.cfg.Blockchain.ChainPayContract == "" {
		return nil, errors.New("contract address not configured")
	}
	if p.ethClient == nil {
		return nil, errors.New("eth client not available")
	}

	contractAddr := common.HexToAddress(p.cfg.Blockchain.ChainPayContract)
	employeeAddr := common.HexToAddress(employeeAddress)

	input, err := chainPayABI.Pack("getRules", employeeAddr)
	if err != nil {
		return nil, err
	}

	msg := ethereum.CallMsg{From: employeeAddr, To: &contractAddr, Data: input}
	result, err := p.ethClient.CallContract(context.Background(), msg, nil)
	if err != nil {
		return nil, err
	}

	unpacked, err := chainPayABI.Unpack("getRules", result)
	if err != nil {
		return nil, err
	}

	var rules []Rule
	if len(unpacked) > 0 {
		if ruleSlice, ok := unpacked[0].([]interface{}); ok {
			for _, r := range ruleSlice {
				if ruleMap, ok := r.(map[string]interface{}); ok {
					rule := Rule{}
					if cid, ok := ruleMap["chainId"].(*big.Int); ok {
						rule.ChainID = cid
					}
					if tok, ok := ruleMap["tokenAddress"].(common.Address); ok {
						rule.TokenAddress = tok
					}
					if pct, ok := ruleMap["percentage"].(*big.Int); ok {
						rule.Percentage = pct
					}
					rules = append(rules, rule)
				}
			}
		}
	}
	return rules, nil
}

// SaveRules 在链上模式下是空操作：链上写入由前端 setRules 负责。
func (p *ChainRulesProvider) SaveRules(_ string, _ []Rule) error {
	return nil
}

// ---- DBRulesProvider ----

type DBRulesProvider struct {
	database *gorm.DB
}

func NewDBRulesProvider(database *gorm.DB) *DBRulesProvider {
	return &DBRulesProvider{database: database}
}

// GetRules 从 employee_rules 表读取员工规则。
func (p *DBRulesProvider) GetRules(employeeAddress string) ([]Rule, error) {
	var rows []db.EmployeeRule
	if err := p.database.Where("employee_address = ?", employeeAddress).Find(&rows).Error; err != nil {
		return nil, err
	}

	rules := make([]Rule, 0, len(rows))
	for _, row := range rows {
		rules = append(rules, Rule{
			ChainID:      big.NewInt(row.ChainID),
			TokenAddress: common.HexToAddress(row.TokenAddress),
			Percentage:   big.NewInt(row.Percentage),
		})
	}
	return rules, nil
}

// SaveRules 先删除员工旧规则，再批量插入新规则，并更新 employees.has_rules = true。
func (p *DBRulesProvider) SaveRules(employeeAddress string, rules []Rule) error {
	return p.database.Transaction(func(tx *gorm.DB) error {
		// 删除旧规则
		if err := tx.Where("employee_address = ?", employeeAddress).Delete(&db.EmployeeRule{}).Error; err != nil {
			return err
		}

		// 批量插入新规则
		now := time.Now().Unix()
		rows := make([]db.EmployeeRule, 0, len(rules))
		for _, r := range rules {
			rows = append(rows, db.EmployeeRule{
				EmployeeAddress: employeeAddress,
				ChainID:         r.ChainID.Int64(),
				TokenAddress:    r.TokenAddress.Hex(),
				Percentage:      r.Percentage.Int64(),
				CreatedAt:       now,
				UpdatedAt:       now,
			})
		}
		if len(rows) > 0 {
			if err := tx.Create(&rows).Error; err != nil {
				return err
			}
		}

		// 更新 has_rules = true
		return tx.Model(&db.Employee{}).
			Where("wallet_address = ?", employeeAddress).
			Update("has_rules", true).Error
	})
}
