package main

import (
	"fmt"
	"log"

	"github.com/chainpay/backend/config"
	"github.com/chainpay/backend/db"
	"github.com/chainpay/backend/handlers"
	"github.com/chainpay/backend/router"
	"github.com/chainpay/backend/services"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Connect to DB
	gormDB, err := db.New(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Auto migrate
	if err := db.Migrate(gormDB); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// H-2 + H-3 fixed: create shared ethclient and NonceManager once at startup.
	// Propagate errors instead of discarding them.
	var ethClient *ethclient.Client
	var nonceMgr *services.NonceManager
	if cfg.Blockchain.ExecutorPrivateKey != "" && cfg.Blockchain.ChainPayContract != "" {
		ec, err := services.DialEthClient(cfg.Blockchain.EthRPCURL)
		if err != nil {
			log.Fatalf("failed to dial ethclient: %v", err)
		}
		ethClient = ec

		privateKey, err := crypto.HexToECDSA(cfg.Blockchain.ExecutorPrivateKey)
		if err != nil {
			log.Fatalf("invalid executor private key: %v", err)
		}
		nonceMgr = services.NewNonceManager(ethClient, crypto.PubkeyToAddress(privateKey.PublicKey))
		log.Printf("Executor wallet: %s", nonceMgr.Addr().Hex())
	} else {
		log.Println("WARNING: EXECUTOR_PRIVATE_KEY or CHAIN_PAY_CONTRACT not set — on-chain calls disabled")
	}

	// Init services (inject shared ethclient and nonce manager)
	employeeSvc := services.NewEmployeeService(gormDB, cfg, ethClient, nonceMgr)
	payrollSvc := services.NewPayrollService(gormDB, cfg, ethClient, nonceMgr)

	// Init handlers
	employeeHandler := handlers.NewEmployeeHandler(employeeSvc)
	payrollHandler := handlers.NewPayrollHandler(payrollSvc, employeeSvc)

	// Start cron only if executor is fully configured
	if cfg.Blockchain.ExecutorPrivateKey != "" && cfg.Blockchain.ChainPayContract != "" {
		services.StartCron(employeeSvc, payrollSvc)
		log.Println("Cron job started")
	} else {
		log.Println("WARNING: executor not configured, cron disabled")
	}

	// Start server
	r := router.Setup(employeeHandler, payrollHandler)
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Printf("ChainPay backend starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
