package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/chainpay/backend/config"
	"github.com/chainpay/backend/db"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PayrollService struct {
	db        *gorm.DB
	cfg       *config.Config
	ethClient *ethclient.Client
}

func NewPayrollService(database *gorm.DB, cfg *config.Config) *PayrollService {
	client, _ := ethclient.Dial("https://mainnet.base.org")
	return &PayrollService{db: database, cfg: cfg, ethClient: client}
}

func (s *PayrollService) DB() *gorm.DB { return s.db }

type Rule struct {
	ChainID      *big.Int       `json:"chainId"`
	TokenAddress common.Address  `json:"tokenAddress"`
	Percentage   *big.Int       `json:"percentage"`
}

type ExecutePayoutRequest struct {
	EmployeeWallet string `json:"employee_wallet" binding:"required"`
}

func (s *PayrollService) GetRulesFromChain(employeeAddress string) ([]Rule, error) {
	if s.cfg.ChainPayContract == "" {
		return nil, errors.New("contract address not configured")
	}

	contractAddr := common.HexToAddress(s.cfg.ChainPayContract)
	employeeAddr := common.HexToAddress(employeeAddress)

	input, err := chainPayABI.Pack("getRules", employeeAddr)
	if err != nil {
		return nil, err
	}

	msg := ethereum.CallMsg{From: employeeAddr, To: &contractAddr, Data: input}
	ctx := context.Background()
	result, err := s.ethClient.CallContract(ctx, msg, nil)
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

func (s *PayrollService) BuildLiFiCalldata(amount string, rules []Rule) ([][]byte, error) {
	if s.cfg.LiFiAPIKey == "" {
		return nil, errors.New("LIFI_API_KEY not configured")
	}

	usdcAddress := "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
	var calldatas [][]byte

	for _, rule := range rules {
		amountBig, ok := new(big.Int).SetString(amount, 10)
		if !ok {
			return nil, errors.New("invalid amount")
		}
		ruleAmount := new(big.Int).Mul(amountBig, rule.Percentage)
		ruleAmount = new(big.Int).Div(ruleAmount, big.NewInt(10000))

		payload := lifiSwapRequest{
			FromTokenAddress: usdcAddress,
			ToTokenAddress:   rule.TokenAddress.Hex(),
			FromAddress:      s.cfg.ChainPayContract,
			ToAddress:        "",
			FromAmount:       ruleAmount.String(),
			Slippage:         0.01,
			ChainID:          rule.ChainID.Int64(),
		}

		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}

		req, err := http.NewRequest("POST", "https://api.li.fi/v1/advanced/swap-and-execute", bytes.NewReader(data))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+s.cfg.LiFiAPIKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("Li.Fi API error: %s", string(body))
		}

		var lifiResp lifiSwapResponse
		if err := json.Unmarshal(body, &lifiResp); err != nil {
			return nil, err
		}

		if len(lifiResp.Steps) == 0 {
			continue
		}

		calldatas = append(calldatas, lifiResp.Steps[0].Action.Calldata)
	}

	return calldatas, nil
}

type lifiSwapRequest struct {
	FromTokenAddress string  `json:"fromTokenAddress"`
	ToTokenAddress   string  `json:"toTokenAddress"`
	FromAddress      string  `json:"fromAddress"`
	ToAddress        string  `json:"toAddress"`
	FromAmount       string  `json:"fromAmount"`
	Slippage         float64 `json:"slippage"`
	ChainID          int64   `json:"chainId,omitempty"`
}

type lifiSwapResponse struct {
	Steps []struct {
		Action struct {
			Calldata []byte `json:"calldata"`
		} `json:"action"`
	} `json:"steps"`
}

func (s *PayrollService) ExecutePayout(employerAddress, employeeAddress string, salaryAmount decimal.Decimal) (*db.PayrollLog, error) {
	if s.cfg.ExecutorPrivateKey == "" {
		return nil, errors.New("executor private key not configured")
	}
	if s.cfg.ChainPayContract == "" {
		return nil, errors.New("contract address not configured")
	}

	rules, err := s.GetRulesFromChain(employeeAddress)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return nil, errors.New("no rules configured for employee")
	}

	salaryStr := salaryAmount.Shift(6).String()
	calldatas, err := s.BuildLiFiCalldata(salaryStr, rules)
	if err != nil {
		return nil, err
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.ExecutorPrivateKey, "0x"))
	if err != nil {
		return nil, err
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(8453))
	if err != nil {
		return nil, err
	}

	contractAddr := common.HexToAddress(s.cfg.ChainPayContract)
	employerAddr := common.HexToAddress(employerAddress)
	employeeAddr := common.HexToAddress(employeeAddress)
	totalAmount := salaryAmount.Shift(6).BigInt()

	input, err := chainPayABI.Pack("executePayout", employerAddr, employeeAddr, totalAmount, calldatas)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	msg := ethereum.CallMsg{From: auth.From, To: &contractAddr, Data: input}
	gasLimit, err := s.ethClient.EstimateGas(ctx, msg)
	if err != nil {
		gasLimit = 500000
	}
	auth.GasLimit = gasLimit

	tx := types.NewTransaction(auth.Nonce.Uint64(), contractAddr, nil, auth.GasLimit, auth.GasPrice, input)
	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		return nil, err
	}

	now := time.Now().Unix()
	logEntry := &db.PayrollLog{
		EmployerAddress: employerAddress,
		EmployeeAddress: employeeAddress,
		Amount:          salaryAmount,
		Status:          "pending",
		TriggerType:     "manual",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.db.Create(logEntry).Error; err != nil {
		return nil, err
	}

	err = s.ethClient.SendTransaction(ctx, signedTx)
	if err != nil {
		s.db.Model(logEntry).Updates(map[string]interface{}{"status": "failed", "error_message": err.Error(), "updated_at": time.Now().Unix()})
		return nil, err
	}

	receipt, err := s.ethClient.TransactionReceipt(ctx, signedTx.Hash())
	if err != nil {
		return logEntry, nil
	}

	if receipt.Status == types.ReceiptStatusSuccessful {
		s.db.Model(logEntry).Updates(map[string]interface{}{"tx_hash": receipt.TxHash.Hex(), "status": "success", "updated_at": time.Now().Unix()})
		logEntry.TxHash = receipt.TxHash.Hex()
		logEntry.Status = "success"
	} else {
		s.db.Model(logEntry).Updates(map[string]interface{}{"tx_hash": receipt.TxHash.Hex(), "status": "failed", "updated_at": time.Now().Unix()})
		logEntry.TxHash = receipt.TxHash.Hex()
		logEntry.Status = "failed"
	}

	return logEntry, nil
}
