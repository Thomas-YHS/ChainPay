package services

import (
	"context"
	"encoding/hex"
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
	rules     RulesProvider
}

// NewPayrollService accepts a shared ethclient, NonceManager, EarnService, and RulesProvider injected from main.
func NewPayrollService(database *gorm.DB, cfg *config.Config, client *ethclient.Client, nm *NonceManager, earnSvc *EarnService, rules RulesProvider) *PayrollService {
	return &PayrollService{db: database, cfg: cfg, ethClient: client, nonceMgr: nm, earnSvc: earnSvc, rules: rules}
}

func (s *PayrollService) DB() *gorm.DB { return s.db }

type Rule struct {
	ChainID      *big.Int       `json:"chainId"`
	TokenAddress common.Address `json:"tokenAddress"`
	Percentage   *big.Int       `json:"percentage"`
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

// approveUSDC 授权 LiFi Diamond 支配后端钱包的 USDC，并等待交易上链。
func (s *PayrollService) approveUSDC(ctx context.Context, amount *big.Int) (string, error) {
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.Blockchain.ExecutorPrivateKey, "0x"))
	if err != nil {
		return "", err
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(BASE_CHAIN_ID))
	if err != nil {
		return "", err
	}

	usdcAddr := common.HexToAddress(USDC_BASE)
	lifiAddr := common.HexToAddress(LIFI_DIAMOND_BASE)

	// ABI-encode approve(spender, amount)
	erc20ABI := mustParseABI(`[{"type":"function","name":"approve","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}]}]`)
	data, err := erc20ABI.Pack("approve", lifiAddr, amount)
	if err != nil {
		return "", err
	}

	msg := ethereum.CallMsg{From: auth.From, To: &usdcAddr, Data: data}
	gasLimit, err := s.ethClient.EstimateGas(ctx, msg)
	if err != nil {
		gasLimit = 100000
	}

	nonce, err := s.nonceMgr.Next(ctx)
	if err != nil {
		s.nonceMgr.Reset()
		return "", fmt.Errorf("get nonce: %w", err)
	}
	gasPrice, err := s.ethClient.SuggestGasPrice(ctx)
	if err != nil {
		s.nonceMgr.Reset()
		return "", fmt.Errorf("get gas price: %w", err)
	}

	tx := types.NewTransaction(nonce, usdcAddr, nil, gasLimit, gasPrice, data)
	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		s.nonceMgr.Reset()
		return "", err
	}

	if err := s.ethClient.SendTransaction(ctx, signedTx); err != nil {
		s.nonceMgr.Reset()
		return "", err
	}

	// Wait for approve to be mined before proceeding with Composer call
	if _, err := bind.WaitMined(ctx, s.ethClient, signedTx); err != nil {
		log.Printf("approveUSDC: WaitMined warning: %v", err)
	}

	return signedTx.Hash().Hex(), nil
}

// ExecutePayout 使用纯 Composer 触发发薪（无需 ChainPay 合约）。
// 每条规则执行流程：
//  1. 后端 approve USDC 给 LiFi Diamond
//  2. 后端调用 GET /v1/quote（fromAddress = 后端钱包）
//  3. 后端签名并提交 transactionRequest
//  4. LiFi 从后端钱包拉取 USDC → 路由到员工
func (s *PayrollService) ExecutePayout(
	employerAddress,
	employeeAddress string,
	salaryAmount decimal.Decimal,
	triggerType string,
) (*db.PayrollLog, error) {
	if s.cfg.Blockchain.ExecutorPrivateKey == "" {
		return nil, errors.New("executor private key not configured")
	}
	if s.ethClient == nil {
		return nil, errors.New("eth client not available")
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.Blockchain.ExecutorPrivateKey, "0x"))
	if err != nil {
		return nil, err
	}
	backendWallet := crypto.PubkeyToAddress(privateKey.PublicKey)
	salaryStr := salaryAmount.Shift(6).String() // USDC 精度 6 位

	// 获取员工规则，无规则则直接转 USDC（100%）
	rules, err := s.rules.GetRules(employeeAddress)
	if err != nil || len(rules) == 0 {
		rules = []Rule{{
			ChainID:      big.NewInt(BASE_CHAIN_ID),
			TokenAddress: common.HexToAddress(USDC_BASE),
			Percentage:   big.NewInt(10000),
		}}
	}

	ctx := context.Background()
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(BASE_CHAIN_ID))
	if err != nil {
		return nil, err
	}

	var lastTxHash string
	for _, rule := range rules {
		// 计算规则金额
		amountBig, _ := new(big.Int).SetString(salaryStr, 10)
		ruleAmount := new(big.Int).Mul(amountBig, rule.Percentage)
		ruleAmount = new(big.Int).Div(ruleAmount, big.NewInt(10000))
		if ruleAmount.Cmp(big.NewInt(0)) == 0 {
			continue
		}
		ruleAmountStr := ruleAmount.String()

		// 步骤 1: Approve USDC 给 LiFi Diamond（并等待上链）
		approveTxHash, err := s.approveUSDC(ctx, ruleAmount)
		if err != nil {
			return nil, fmt.Errorf("approve failed: %w", err)
		}
		log.Printf("ExecutePayout: approved %s USDC (tx=%s)", ruleAmountStr, approveTxHash)

		// 步骤 2: 获取 Composer quote
		to, txDataHex, value, gasLimitHex, _, _, err := s.BuildComposerQuote(
			backendWallet.Hex(),     // fromAddress = 后端钱包
			employeeAddress,          // toAddress = 员工
			USDC_BASE,               // fromToken = USDC
			rule.TokenAddress.Hex(), // toToken
			ruleAmountStr,           // fromAmount
		)
		if err != nil {
			return nil, fmt.Errorf("composer quote failed: %w", err)
		}

		// 步骤 3: 签名并提交交易
		toAddr := common.HexToAddress(to)
		txData, _ := hex.DecodeString(strings.TrimPrefix(txDataHex, "0x"))
		txValue := new(big.Int)
		if value != "" && value != "0x0" && value != "0x" {
			txValue.SetString(strings.TrimPrefix(value, "0x"), 16)
		}
		txGasLimit := new(big.Int)
		txGasLimit.SetString(strings.TrimPrefix(gasLimitHex, "0x"), 16)
		if txGasLimit.Cmp(big.NewInt(0)) == 0 {
			txGasLimit = big.NewInt(500000)
		}

		nonce, err := s.nonceMgr.Next(ctx)
		if err != nil {
			s.nonceMgr.Reset()
			return nil, fmt.Errorf("get nonce: %w", err)
		}
		gasPrice, err := s.ethClient.SuggestGasPrice(ctx)
		if err != nil {
			s.nonceMgr.Reset()
			return nil, fmt.Errorf("get gas price: %w", err)
		}

		tx := types.NewTransaction(nonce, toAddr, txValue, txGasLimit.Uint64(), gasPrice, txData)
		signedTx, err := auth.Signer(auth.From, tx)
		if err != nil {
			s.nonceMgr.Reset()
			return nil, err
		}

		// 记录发薪日志
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

		lastTxHash = signedTx.Hash().Hex()
		s.db.Model(logEntry).Updates(map[string]interface{}{
			"tx_hash":    lastTxHash,
			"updated_at": time.Now().Unix(),
		})
		logEntry.TxHash = lastTxHash

		// 异步等待回执
		go s.awaitReceipt(signedTx.Hash(), logEntry.ID)
	}

	// 自动定投
	if s.earnSvc != nil && s.cfg.Blockchain.EarnEnabled {
		go s.triggerAutoInvestPureComposer(employeeAddress, salaryAmount, backendWallet.Hex())
	}

	return &db.PayrollLog{
		TxHash: lastTxHash,
		Status: "pending",
	}, nil
}

// triggerAutoInvestPureComposer 将部分薪资存入 LiFi Earn 理财。
// 对于纯 Composer 架构，资金来自后端钱包。
func (s *PayrollService) triggerAutoInvestPureComposer(
	employeeAddress string,
	salaryAmount decimal.Decimal,
	fromAddress string,
) {
	var emp db.Employee
	if err := s.db.Where("wallet_address = ?", employeeAddress).First(&emp).Error; err != nil {
		log.Printf("triggerAutoInvestPureComposer: employee not found: %s", employeeAddress)
		return
	}
	if !emp.AutoInvestEnabled || emp.AutoInvestVaultID == "" {
		return
	}

	investAmount, err := CalculateAutoInvestValue(salaryAmount, emp.AutoInvestType, emp.AutoInvestValue)
	if err != nil || investAmount.LessThanOrEqual(decimal.Zero) {
		return
	}

	txHash, err := s.earnSvc.ExecuteDeposit(
		emp.AutoInvestVaultID,
		fromAddress,
		emp.WalletAddress,
		investAmount.Shift(6).String(),
		USDC_BASE,
	)
	if err != nil {
		log.Printf("triggerAutoInvestPureComposer: deposit failed for %s: %v", employeeAddress, err)
		return
	}
	log.Printf("triggerAutoInvestPureComposer: deposited %s USDC for %s (tx=%s)", investAmount.String(), employeeAddress, txHash)
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