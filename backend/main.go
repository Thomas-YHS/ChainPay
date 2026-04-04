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
	cfg := config.Load()

	// Connect to DB
	gormDB, err := db.New(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Auto migrate
	if err := db.Migrate(gormDB); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// Init services
	employeeSvc := services.NewEmployeeService(gormDB, cfg)
	payrollSvc := services.NewPayrollService(gormDB, cfg)

	// Init handlers
	employeeHandler := handlers.NewEmployeeHandler(employeeSvc)
	payrollHandler := handlers.NewPayrollHandler(payrollSvc, employeeSvc)

	// Start cron (only if executor is configured)
	if cfg.ExecutorPrivateKey != "" {
		services.StartCron(employeeSvc, payrollSvc)
		log.Println("Cron job started")
	} else {
		log.Println("WARNING: EXECUTOR_PRIVATE_KEY not set, cron disabled")
	}

	// Start server
	r := router.Setup(employeeHandler, payrollHandler)
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("ChainPay backend starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
