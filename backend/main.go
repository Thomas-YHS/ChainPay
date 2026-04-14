package main

import (
	"fmt"
	"log"

	"github.com/chainpay/backend/config"
	"github.com/chainpay/backend/db"
	"github.com/chainpay/backend/handlers"
	"github.com/chainpay/backend/router"
	"github.com/chainpay/backend/services"
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

	// 根据配置选择规则存储实现
	var rulesProvider services.RulesProvider
	if cfg.Blockchain.RulesMode == "backend" {
		rulesProvider = services.NewDBRulesProvider(gormDB)
		log.Println("Rules mode: backend (PostgreSQL)")
	} else {
		rulesProvider = services.NewChainRulesProvider(cfg, nil)
		log.Println("Rules mode: chain (contract)")
	}

	// Init services（雇主钱包直发架构：后端不持有私钥，不连接链）
	employeeSvc := services.NewEmployeeService(gormDB, cfg, nil, nil, rulesProvider)
	payrollSvc := services.NewPayrollService(gormDB, cfg, rulesProvider)

	// Init handlers
	employeeHandler := handlers.NewEmployeeHandler(employeeSvc)
	payrollHandler := handlers.NewPayrollHandler(payrollSvc, employeeSvc)
	configHandler := handlers.NewConfigHandler(cfg)

	// 注意：cron 发薪在雇主钱包直发架构下已禁用（需要后端签名）
	if cfg.Blockchain.CronEnabled {
		log.Println("WARNING: cron payroll disabled in employer-direct mode")
	}

	// Start server
	r := router.Setup(employeeHandler, payrollHandler, configHandler)
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Printf("ChainPay backend starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
