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
	"sort"
	"strings"
	"time"

	"github.com/chainpay/backend/config"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"
)

var earnHTTPClient = &http.Client{Timeout: 15 * time.Second}

// EarnService wraps the LiFi Earn Data API and Composer API for yield strategies.
type EarnService struct {
	cfg       *config.Config
	ethClient *ethclient.Client
	nonceMgr  *NonceManager
}

// NewEarnService creates an EarnService.
func NewEarnService(cfg *config.Config, client *ethclient.Client, nm *NonceManager) *EarnService {
	return &EarnService{cfg: cfg, ethClient: client, nonceMgr: nm}
}

// Vault represents a yield vault from the Earn Data API.
type Vault struct {
	ID              string `json:"id"`
	Protocol        string `json:"protocol"`
	Name            string `json:"name"`
	ChainID         int64  `json:"chainId"`
	TokenAddress    string `json:"tokenAddress"`
	APY             string `json:"apy"`
	TVL             string `json:"tvlUsd"`
	AvailableFunds  string `json:"availableFunds"`
	Tags            []string `json:"tags"`
}

// GetVaults queries earn.li.fi for available vaults.
// filterChain: chain ID (8453 = Base). filterToken: token symbol or address.
func (s *EarnService) GetVaults(filterChain int64, filterToken string) ([]Vault, error) {
	url := fmt.Sprintf("https://earn.li.fi/v1/earn/vaults?chainId=%d", filterChain)
	resp, err := earnHTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("earn API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("earn API returned %d: %s", resp.StatusCode, string(body))
	}

	var raw struct {
		Data []Vault `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("failed to decode vault response: %w", err)
	}

	// Filter by token if specified
	var vaults []Vault
	for _, v := range raw.Data {
		if filterToken != "" && !strings.EqualFold(v.TokenAddress, filterToken) && !strings.Contains(strings.ToLower(v.Name), strings.ToLower(filterToken)) {
			continue
		}
		vaults = append(vaults, v)
	}

	return vaults, nil
}

// TopVaultByAPY returns the vault with the highest APY from the given list.
func TopVaultByAPY(vaults []Vault) (*Vault, error) {
	if len(vaults) == 0 {
		return nil, errors.New("no vaults available")
	}
	sort.Slice(vaults, func(i, j int) bool {
		apyI, _ := parseAPY(vaults[i].APY)
		apyJ, _ := parseAPY(vaults[j].APY)
		return apyI > apyJ
	})
	return &vaults[0], nil
}

func parseAPY(apyStr string) (float64, error) {
	// APY may be like "12.5%" or "0.125" or "12.5"
	cleaned := strings.TrimSuffix(strings.TrimSpace(apyStr), "%")
	var f float64
	fmt.Sscanf(cleaned, "%f", &f)
	if strings.Contains(apyStr, "%") {
		f = f / 100
	}
	return f, nil
}

// composerQuoteRequest is the request body for POST /v1/quote on li.quest.
type composerQuoteRequest struct {
	FromToken        string `json:"fromToken"`
	ToToken          string `json:"toToken"`
	FromAmount       string `json:"fromAmount"`
	FromAddress      string `json:"fromAddress"`
	ToAddress        string `json:"toAddress"`
	Slug             string `json:"slug"`
}

// composerQuoteResponse is the response from POST /v1/quote on li.quest.
type composerQuoteResponse struct {
	Steps []struct {
		Action struct {
			Calldata []byte `json:"calldata"`
			To       string `json:"to"`
			Value    string `json:"value"`
		} `json:"action"`
	} `json:"steps"`
}

// BuildDepositTx generates the deposit calldata for a vault using the Composer API.
func (s *EarnService) BuildDepositTx(vaultID, fromToken, toToken, fromAddress, toAddress, amount string) ([]byte, string, error) {
	if s.cfg.Blockchain.LiFiAPIKey == "" {
		return nil, "", errors.New("LIFI_API_KEY not configured")
	}

	slug := vaultID // Vault ID acts as the slug for deposit
	payload := composerQuoteRequest{
		FromToken:   fromToken,
		ToToken:     toToken,
		FromAmount:  amount,
		FromAddress: fromAddress,
		ToAddress:   toAddress,
		Slug:        slug,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, "", err
	}

	req, err := http.NewRequest("POST", "https://li.quest/v1/quote", bytes.NewReader(data))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.Blockchain.LiFiAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := earnHTTPClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("composer API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("composer API returned %d: %s", resp.StatusCode, string(body))
	}

	var quote composerQuoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&quote); err != nil {
		return nil, "", fmt.Errorf("failed to decode composer response: %w", err)
	}

	if len(quote.Steps) == 0 || len(quote.Steps[0].Action.Calldata) == 0 {
		return nil, "", errors.New("composer returned no calldata")
	}

	return quote.Steps[0].Action.Calldata, quote.Steps[0].Action.To, nil
}

// ExecuteDeposit builds the deposit calldata and broadcasts the transaction using the executor wallet.
func (s *EarnService) ExecuteDeposit(vaultID, fromAddress, toAddress, amount, tokenAddress string) (string, error) {
	if s.cfg.Blockchain.ExecutorPrivateKey == "" {
		return "", errors.New("executor private key not configured")
	}
	if s.ethClient == nil {
		return "", errors.New("eth client not available")
	}

	calldata, to, err := s.BuildDepositTx(vaultID, tokenAddress, tokenAddress, fromAddress, toAddress, amount)
	if err != nil {
		return "", fmt.Errorf("build deposit tx: %w", err)
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.Blockchain.ExecutorPrivateKey, "0x"))
	if err != nil {
		return "", err
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(8453))
	if err != nil {
		return "", err
	}

	toAddr := common.HexToAddress(to)
	calldataHash := common.HexToHash(calldataStr(calldata))

	msg := ethereum.CallMsg{From: auth.From, To: &toAddr, Data: calldataHash.Bytes()}
	gasLimit, err := s.ethClient.EstimateGas(context.Background(), msg)
	if err != nil {
		gasLimit = 500000
	}

	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	nonce, err := s.nonceMgr.Next(ctx)
	if err != nil {
		return "", fmt.Errorf("get nonce: %w", err)
	}
	gasPrice, err := s.ethClient.SuggestGasPrice(ctx)
	if err != nil {
		s.nonceMgr.Reset()
		return "", fmt.Errorf("get gas price: %w", err)
	}

	txData := common.HexToHash(calldataStr(calldata)).Bytes()
	tx := types.NewTransaction(nonce, toAddr, nil, gasLimit, gasPrice, txData)
	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		s.nonceMgr.Reset()
		return "", err
	}

	if err := s.ethClient.SendTransaction(ctx, signedTx); err != nil {
		s.nonceMgr.Reset()
		return "", err
	}

	txHash := signedTx.Hash().Hex()
	log.Printf("EarnService: deposit tx sent %s (vault=%s, amount=%s)", txHash, vaultID, amount)
	return txHash, nil
}

func calldataStr(calldata []byte) string {
	return "0x" + common.Bytes2Hex(calldata)
}

// CalculateAutoInvestAmount calculates the USDC amount to invest based on employee's auto-invest config.
func CalculateAutoInvestValue(salary decimal.Decimal, investType string, investValue decimal.Decimal) (decimal.Decimal, error) {
	switch investType {
	case "percentage":
		return salary.Mul(investValue).Div(decimal.NewFromInt(10000)), nil // investValue is in basis points (e.g., 1000 = 10%)
	case "fixed":
		return investValue, nil
	default:
		return decimal.Zero, errors.New("invalid auto_invest_type")
	}
}
