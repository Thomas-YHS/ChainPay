package services

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/chainpay/backend/config"
	"github.com/chainpay/backend/db"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	chainPayABI = mustParseABI(`[{"type":"function","name":"registerEmployee","inputs":[{"type":"address","name":"employee"}]},{"type":"function","name":"getRules","inputs":[{"type":"address","name":"employee"}],"outputs":[{"type":"tuple[]","components":[{"type":"uint256","name":"chainId"},{"type":"address","name":"tokenAddress"},{"type":"uint256","name":"percentage"}]}]},{"type":"function","name":"executePayout","inputs":[{"type":"address","name":"employer"},{"type":"address","name":"employee"},{"type":"uint256","name":"totalAmount"},{"type":"bytes[]","name":"lifiCallData"}]},{"type":"function","name":"employeeEmployer","inputs":[{"type":"address","name":"employee"}],"outputs":[{"type":"address"}]}]`)
)

func mustParseABI(jsonStr string) abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(jsonStr))
	if err != nil {
		panic("failed to parse ABI: " + err.Error())
	}
	return parsed
}

type EmployeeService struct {
	db        *gorm.DB
	cfg       *config.Config
	ethClient *ethclient.Client
	nonceMgr  *NonceManager
}

// NewEmployeeService accepts a shared ethclient and NonceManager injected from main.
// Both may be nil when EXECUTOR_PRIVATE_KEY / CHAIN_PAY_CONTRACT are not set;
// on-chain calls will return a clear error in that case.
func NewEmployeeService(database *gorm.DB, cfg *config.Config, client *ethclient.Client, nm *NonceManager) *EmployeeService {
	return &EmployeeService{db: database, cfg: cfg, ethClient: client, nonceMgr: nm}
}

type CreateEmployeeRequest struct {
	Name          string `json:"name" binding:"required"`
	Nickname      string `json:"nickname"`
	WalletAddress string `json:"wallet_address" binding:"required"`
	SalaryAmount  string `json:"salary_amount" binding:"required"`
	PayFrequency  string `json:"pay_frequency" binding:"required"`
}

func (s *EmployeeService) Create(req CreateEmployeeRequest, employerAddress string) (*db.Employee, error) {
	var existing db.Employee
	err := s.db.Where("wallet_address = ?", req.WalletAddress).First(&existing).Error
	if err == nil {
		return nil, errors.New("employee already exists")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	salary, err := decimal.NewFromString(req.SalaryAmount)
	if err != nil {
		return nil, errors.New("invalid salary amount")
	}
	if salary.LessThanOrEqual(decimal.Zero) {
		return nil, errors.New("salary_amount must be positive")
	}

	if err := s.registerOnChain(context.Background(), req.WalletAddress); err != nil {
		return nil, fmt.Errorf("on-chain registration failed: %w", err)
	}

	now := time.Now().Unix()
	emp := &db.Employee{
		EmployerAddress: employerAddress,
		Name:            req.Name,
		Nickname:        req.Nickname,
		WalletAddress:   req.WalletAddress,
		SalaryAmount:    salary,
		PayFrequency:    req.PayFrequency,
		HasRules:        false,
		NextPayDate:     calcNextPayDate(req.PayFrequency),
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.db.Create(emp).Error; err != nil {
		return nil, err
	}
	return emp, nil
}

func (s *EmployeeService) ListByEmployer(employerAddress string) ([]db.Employee, error) {
	var employees []db.Employee
	err := s.db.Where("employer_address = ?", employerAddress).Order("created_at DESC").Find(&employees).Error
	return employees, err
}

func (s *EmployeeService) GetByWallet(walletAddress string) (*db.Employee, error) {
	var emp db.Employee
	err := s.db.Where("wallet_address = ?", walletAddress).First(&emp).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, gorm.ErrRecordNotFound
	}
	return &emp, err
}

func (s *EmployeeService) DB() *gorm.DB { return s.db }

func (s *EmployeeService) Delete(walletAddress, employerAddress string) error {
	employeeEmployer, err := s.getEmployeeEmployer(walletAddress)
	if err != nil {
		return fmt.Errorf("cannot verify employee relationship: %w", err)
	}
	if !strings.EqualFold(employeeEmployer, employerAddress) {
		return errors.New("forbidden: not the employer of this employee")
	}
	return s.db.Where("wallet_address = ? AND employer_address = ?", walletAddress, employerAddress).Delete(&db.Employee{}).Error
}

func (s *EmployeeService) UpdateRulesStatus(walletAddress string, hasRules bool) error {
	return s.db.Model(&db.Employee{}).Where("wallet_address = ?", walletAddress).Update("has_rules", hasRules).Error
}

func calcNextPayDate(frequency string) int64 {
	now := time.Now()
	switch frequency {
	case "daily":
		return now.Add(24 * time.Hour).Unix()
	case "weekly":
		return now.Add(7 * 24 * time.Hour).Unix()
	case "monthly":
		return now.AddDate(0, 1, 0).Unix()
	default:
		return now.Add(24 * time.Hour).Unix()
	}
}

func (s *EmployeeService) registerOnChain(ctx context.Context, employeeAddress string) error {
	if s.cfg.Blockchain.ExecutorPrivateKey == "" {
		return errors.New("executor private key not configured")
	}
	if s.cfg.Blockchain.ChainPayContract == "" {
		return errors.New("contract address not configured")
	}
	if s.ethClient == nil {
		return errors.New("eth client not available")
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.Blockchain.ExecutorPrivateKey, "0x"))
	if err != nil {
		return err
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(8453))
	if err != nil {
		return err
	}

	contractAddr := common.HexToAddress(s.cfg.Blockchain.ChainPayContract)
	input, err := chainPayABI.Pack("registerEmployee", common.HexToAddress(employeeAddress))
	if err != nil {
		return err
	}

	// Estimate gas
	msg := ethereum.CallMsg{From: auth.From, To: &contractAddr, Data: input}
	gasLimit, err := s.ethClient.EstimateGas(ctx, msg)
	if err != nil {
		gasLimit = 200000
	}

	// Fetch nonce (thread-safe, shared with PayrollService)
	nonce, err := s.nonceMgr.Next(ctx)
	if err != nil {
		return fmt.Errorf("get nonce: %w", err)
	}

	// Fetch current gas price
	gasPrice, err := s.ethClient.SuggestGasPrice(ctx)
	if err != nil {
		s.nonceMgr.Reset()
		return fmt.Errorf("get gas price: %w", err)
	}

	tx := types.NewTransaction(nonce, contractAddr, nil, gasLimit, gasPrice, input)
	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		s.nonceMgr.Reset()
		return err
	}

	if err := s.ethClient.SendTransaction(ctx, signedTx); err != nil {
		s.nonceMgr.Reset()
		return err
	}
	return nil
}

func (s *EmployeeService) getEmployeeEmployer(employeeAddress string) (string, error) {
	if s.cfg.Blockchain.ChainPayContract == "" {
		return "", errors.New("contract address not configured")
	}
	if s.ethClient == nil {
		return "", errors.New("eth client not available")
	}

	contractAddr := common.HexToAddress(s.cfg.Blockchain.ChainPayContract)
	employeeAddr := common.HexToAddress(employeeAddress)

	input, err := chainPayABI.Pack("employeeEmployer", employeeAddr)
	if err != nil {
		return "", err
	}

	msg := ethereum.CallMsg{From: employeeAddr, To: &contractAddr, Data: input}
	result, err := s.ethClient.CallContract(context.Background(), msg, nil)
	if err != nil {
		return "", err
	}

	out := common.BytesToAddress(result)
	return out.Hex(), nil
}
