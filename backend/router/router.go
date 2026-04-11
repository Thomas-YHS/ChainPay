package router

import (
	"github.com/chainpay/backend/handlers"
	"github.com/chainpay/backend/middleware"
	"github.com/gin-gonic/gin"
)

func Setup(employeeHandler *handlers.EmployeeHandler, payrollHandler *handlers.PayrollHandler, vaultHandler *handlers.VaultHandler, configHandler *handlers.ConfigHandler) *gin.Engine {
	// L-1 fixed: use gin.New() instead of gin.Default() so we control middleware explicitly
	r := gin.New()
	r.Use(gin.Logger())            // request log
	r.Use(middleware.CORS([]string{
		"http://localhost:5173",
		"http://localhost:5174",
	}))

	api := r.Group("/api/v1")
	{
		employees := api.Group("/employees")
		employees.Use(middleware.WalletAuth())
		{
			employees.POST("", employeeHandler.Create)
			employees.GET("", employeeHandler.List)
			employees.GET("/:wallet_address", employeeHandler.Get)
			employees.DELETE("/:wallet_address", employeeHandler.Delete)
			employees.GET("/:wallet_address/verify", employeeHandler.Verify)
			employees.PATCH("/:wallet_address/rules-status", employeeHandler.UpdateRulesStatus)
			employees.GET("/:wallet_address/auto-invest", employeeHandler.GetAutoInvest)
			employees.PATCH("/:wallet_address/auto-invest", employeeHandler.UpdateAutoInvest)
			employees.POST("/:wallet_address/rules", employeeHandler.SaveRules)
		}

		payroll := api.Group("/payroll")
		payroll.Use(middleware.WalletAuth())
		{
			payroll.POST("/execute", payrollHandler.Execute)
			payroll.GET("/logs", payrollHandler.ListLogs)
			payroll.GET("/logs/:id", payrollHandler.GetLog)
		}

		// Vault discovery (no wallet auth required — read-only)
		api.GET("/vaults", vaultHandler.List)

		// Config (no auth)
		api.GET("/config/rules-mode", configHandler.GetRulesMode)
	}

	// Health check (no auth)
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	return r
}
