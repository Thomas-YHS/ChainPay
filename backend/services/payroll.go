package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
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

const (
	USDC_BASE         = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
	LIFI_DIAMOND_BASE = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"
	BASE_CHAIN_ID     = 8453
)

// composerQuoteAPIResponse 对应 GET /v1/quote 的响应格式
type composerQuoteAPIResponse struct {
	Action struct {
		FromToken struct {
			Address  string `json:"address"`
			Symbol   string `json:"symbol"`
			Decimals int    `json:"decimals"`
		} `json:"fromToken"`
		ToToken struct {
			Address  string `json:"address"`
			Symbol   string `json:"symbol"`
			Decimals int    `json:"decimals"`
		} `json:"toToken"`
		FromAmount  string `json:"fromAmount"`
		FromAddress string `json:"fromAddress"`
		ToAddress   string `json:"toAddress"`
	} `json:"action"`
	Estimate struct {
		ApprovalAddress string `json:"approvalAddress"`
		ToAmount        string `json:"toAmount"`
		ToAmountMin     string `json:"toAmountMin"`
		FromAmount      string `json:"fromAmount"`
	} `json:"estimate"`
	TransactionRequest struct {
		To       string `json:"to"`
		Data     string `json:"data"`
		Value    string `json:"value"`
		GasLimit string `json:"gasLimit"`
		GasPrice string `json:"gasPrice"`
		ChainID  int64  `json:"chainId"`
		From     string `json:"from"`
	} `json:"transactionRequest"`
}

// lifiHTTPClient has an explicit timeout to prevent goroutine leaks on slow API responses.
var lifiHTTPClient = &http.Client{Timeout: 15 * time.Second}

type PayrollService struct {
	db        *gorm.DB
	cfg       *config.Config
	ethClient *ethclient.Client
	nonceMgr  *NonceManager
	earnSvc   *EarnService
}

// NewPayrollService accepts a shared ethclient, NonceManager, and EarnService injected from main.
func NewPayrollService(database *gorm.DB, cfg *config.Config, client *ethclient.Client, nm *NonceManager, earnSvc *EarnService) *PayrollService {
	return &PayrollService{db: database, cfg: cfg, ethClient: client, nonceMgr: nm, earnSvc: earnSvc}
}

func (s *PayrollService) DB() *gorm.DB { return s.db }

type Rule struct {
	ChainID      *big.Int       `json:"chainId"`
	TokenAddress common.Address `json:"tokenAddress"`
	Percentage   *big.Int       `json:"percentage"`
}

func (s *PayrollService) GetRulesFromChain(employeeAddress string) ([]Rule, error) {
	if s.cfg.Blockchain.ChainPayContract == "" {
		return nil, errors.New("contract address not configured")
	}
	if s.ethClient == nil {
		return nil, errors.New("eth client not available")
	}

	contractAddr := common.HexToAddress(s.cfg.Blockchain.ChainPayContract)
	employeeAddr := common.HexToAddress(employeeAddress)

	input, err := chainPayABI.Pack("getRules", employeeAddr)
	if err != nil {
		return nil, err
	}

	msg := ethereum.CallMsg{From: employeeAddr, To: &contractAddr, Data: input}
	result, err := s.ethClient.CallContract(context.Background(), msg, nil)
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

// BuildComposerQuote 调用 GET /v1/quote，返回解析后的 transactionRequest。
// fromAddress = 后端钱包地址（来自 ExecutorPrivateKey）
func (s *PayrollService) BuildComposerQuote(
	fromAddress string,
	toAddress string,
	fromToken string,
	toToken string,
	fromAmount string,
) (to, data, value, gasLimit, chainId, fromAddr string, err error) {
	if s.cfg.Blockchain.LiFiAPIKey == "" {
		return "", "", "", "", "", "", errors.New("LIFI_API_KEY not configured")
	}

	url := fmt.Sprintf(
		"https://li.quest/v1/quote?fromChain=%d&toChain=%d&fromToken=%s&toToken=%s&fromAddress=%s&toAddress=%s&fromAmount=%s",
		BASE_CHAIN_ID, BASE_CHAIN_ID, fromToken, toToken, fromAddress, toAddress, fromAmount,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", "", "", "", "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.Blockchain.LiFiAPIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := lifiHTTPClient.Do(req)
	if err != nil {
		return "", "", "", "", "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", "", "", "", "", "", fmt.Errorf("Li.Fi API error %d: %s", resp.StatusCode, string(body))
	}

	var quote composerQuoteAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&quote); err != nil {
		return "", "", "", "", "", "", err
	}

	txReq := quote.TransactionRequest
	return txReq.To, txReq.Data, txReq.Value, txReq.GasLimit, fmt.Sprintf("%d", txReq.ChainID), txReq.From, nil
}

// BuildLiFiCalldata generates Li.Fi swap calldata for each rule.
// toAddress is the employee's wallet — Li.Fi will deliver swapped tokens there.
func (s *PayrollService) BuildLiFiCalldata(amount string, rules []Rule, toAddress string) ([][]byte, error) {
	if s.cfg.Blockchain.LiFiAPIKey == "" {
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
			FromAddress:      s.cfg.Blockchain.ChainPayContract,
			ToAddress:        toAddress, // M-7 fixed: was always ""
			FromAmount:       ruleAmount.String(),
			Slippage:         0.01,
			ChainID:          rule.ChainID.Int64(),
		}

		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}

		// C-2 fixed: response body closed inside anonymous function, not deferred to loop end
		body, err := func() ([]byte, error) {
			req, err := http.NewRequest("POST", "https://api.li.fi/v1/advanced/swap-and-execute", bytes.NewReader(data))
			if err != nil {
				return nil, err
			}
			req.Header.Set("Authorization", "Bearer "+s.cfg.Blockchain.LiFiAPIKey)
			req.Header.Set("Content-Type", "application/json")

			resp, err := lifiHTTPClient.Do(req) // H-6 fixed: uses client with 15s timeout
			if err != nil {
				return nil, err
			}
			defer resp.Body.Close()

			b, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, err
			}
			if resp.StatusCode != http.StatusOK {
				return nil, fmt.Errorf("Li.Fi API error %d: %s", resp.StatusCode, string(b))
			}
			return b, nil
		}()
		if err != nil {
			return nil, err
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

// ExecutePayout builds Li.Fi calldata, signs and broadcasts the executePayout tx,
// records the tx_hash immediately, then confirms the receipt asynchronously.
func (s *PayrollService) ExecutePayout(employerAddress, employeeAddress string, salaryAmount decimal.Decimal, triggerType string) (*db.PayrollLog, error) {
	if s.cfg.Blockchain.ExecutorPrivateKey == "" {
		return nil, errors.New("executor private key not configured")
	}
	if s.cfg.Blockchain.ChainPayContract == "" {
		return nil, errors.New("contract address not configured")
	}
	if s.ethClient == nil {
		return nil, errors.New("eth client not available")
	}

	rules, err := s.GetRulesFromChain(employeeAddress)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return nil, errors.New("no rules configured for employee")
	}

	salaryStr := salaryAmount.Shift(6).String()
	calldatas, err := s.BuildLiFiCalldata(salaryStr, rules, employeeAddress) // M-7 fixed
	if err != nil {
		return nil, err
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.Blockchain.ExecutorPrivateKey, "0x"))
	if err != nil {
		return nil, err
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(8453))
	if err != nil {
		return nil, err
	}

	contractAddr := common.HexToAddress(s.cfg.Blockchain.ChainPayContract)
	employerAddr := common.HexToAddress(employerAddress)
	employeeAddr := common.HexToAddress(employeeAddress)
	totalAmount := salaryAmount.Shift(6).BigInt()

	input, err := chainPayABI.Pack("executePayout", employerAddr, employeeAddr, totalAmount, calldatas)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()

	// Estimate gas
	msg := ethereum.CallMsg{From: auth.From, To: &contractAddr, Data: input}
	gasLimit, err := s.ethClient.EstimateGas(ctx, msg)
	if err != nil {
		gasLimit = 500000
	}

	// C-1 fixed: fetch nonce via shared manager and current gas price
	nonce, err := s.nonceMgr.Next(ctx)
	if err != nil {
		return nil, fmt.Errorf("get nonce: %w", err)
	}
	gasPrice, err := s.ethClient.SuggestGasPrice(ctx)
	if err != nil {
		s.nonceMgr.Reset()
		return nil, fmt.Errorf("get gas price: %w", err)
	}

	tx := types.NewTransaction(nonce, contractAddr, nil, gasLimit, gasPrice, input)
	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		s.nonceMgr.Reset()
		return nil, err
	}

	now := time.Now().Unix()
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
		s.nonceMgr.Reset()
		return nil, err
	}

	if err := s.ethClient.SendTransaction(ctx, signedTx); err != nil {
		s.nonceMgr.Reset()
		s.db.Model(logEntry).Updates(map[string]interface{}{
			"status":        "failed",
			"error_message": err.Error(),
			"updated_at":    time.Now().Unix(),
		})
		return nil, err
	}

	// C-3 fixed: record tx_hash immediately, then confirm asynchronously
	txHash := signedTx.Hash().Hex()
	s.db.Model(logEntry).Updates(map[string]interface{}{
		"tx_hash":    txHash,
		"updated_at": time.Now().Unix(),
	})
	logEntry.TxHash = txHash

	go s.awaitReceipt(signedTx.Hash(), logEntry.ID)

	// Auto-invest: trigger after tx is sent if earn is enabled
	if s.earnSvc != nil && s.cfg.Blockchain.EarnEnabled {
		go s.triggerAutoInvest(employeeAddress, salaryAmount)
	}

	return logEntry, nil
}

// triggerAutoInvest checks if the employee has auto-invest configured and deposits funds into the vault.
func (s *PayrollService) triggerAutoInvest(employeeAddress string, salaryAmount decimal.Decimal) {
	var emp db.Employee
	if err := s.db.Where("wallet_address = ?", employeeAddress).First(&emp).Error; err != nil {
		log.Printf("triggerAutoInvest: employee not found: %s", employeeAddress)
		return
	}
	if !emp.HasRules {
		log.Printf("triggerAutoInvest: skipping %s, no on-chain rules", employeeAddress)
		return
	}
	if !emp.AutoInvestEnabled || emp.AutoInvestVaultID == "" {
		return
	}

	investAmount, err := CalculateAutoInvestValue(salaryAmount, emp.AutoInvestType, emp.AutoInvestValue)
	if err != nil {
		log.Printf("triggerAutoInvest: invalid config for %s: %v", employeeAddress, err)
		return
	}
	if investAmount.LessThanOrEqual(decimal.Zero) {
		return
	}

	usdcAddress := "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
	txHash, err := s.earnSvc.ExecuteDeposit(
		emp.AutoInvestVaultID,
		s.cfg.Blockchain.ChainPayContract, // from the contract
		emp.WalletAddress,                  // to the employee
		investAmount.Shift(6).String(),    // shift to USDC decimals
		usdcAddress,
	)
	if err != nil {
		log.Printf("triggerAutoInvest: deposit failed for %s: %v", employeeAddress, err)
		return
	}
	log.Printf("triggerAutoInvest: deposited %s USDC for %s (tx=%s)", investAmount.String(), employeeAddress, txHash)
}

// awaitReceipt polls for the transaction receipt and updates the payroll log status.
// Runs in a separate goroutine; times out after 5 minutes.
func (s *PayrollService) awaitReceipt(txHash common.Hash, logID uint64) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.db.Model(&db.PayrollLog{}).Where("id = ?", logID).Updates(map[string]interface{}{
				"status":        "failed",
				"error_message": "receipt timeout after 5 minutes",
				"updated_at":    time.Now().Unix(),
			})
			log.Printf("awaitReceipt: timeout for tx %s (log %d)", txHash.Hex(), logID)
			return
		case <-ticker.C:
			r, err := s.ethClient.TransactionReceipt(ctx, txHash)
			if err != nil {
				continue // not mined yet
			}
			status := "failed"
			if r.Status == types.ReceiptStatusSuccessful {
				status = "success"
			}
			s.db.Model(&db.PayrollLog{}).Where("id = ?", logID).Updates(map[string]interface{}{
				"status":     status,
				"updated_at": time.Now().Unix(),
			})
			log.Printf("awaitReceipt: tx %s status=%s (log %d)", txHash.Hex(), status, logID)
			return
		}
	}
}
