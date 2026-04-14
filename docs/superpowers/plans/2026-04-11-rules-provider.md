# 员工规则存储策略模式 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 `RulesProvider` 接口，支持通过 `config.yaml` 在链上合约模式与后端数据库模式之间系统级切换员工规则存储。

**Architecture:** `RulesProvider` 接口有两个实现：`ChainRulesProvider`（现有逻辑）和 `DBRulesProvider`（新增，存 PostgreSQL）。`main.go` 启动时根据 `config.yaml` 的 `rules_mode` 构造对应实现，注入 `PayrollService` 和 `EmployeeService`。前端通过 `GET /config/rules-mode` 感知当前模式，动态切换提交方式和按钮文案。

**Tech Stack:** Go (Gin + GORM), PostgreSQL, React 19 (Vite), TypeScript

---

## 文件改动一览

```
backend/
├── db/db.go                           ← 新增 EmployeeRule 模型 + Migrate 注册
├── config/config.go                   ← 新增 RulesMode 字段，默认 "chain"
├── services/rules_provider.go         ← 新建：接口 + ChainRulesProvider + DBRulesProvider
├── services/payroll.go                ← ExecutePayout 用 provider.GetRules 替换 GetRulesFromChain
├── services/employee.go               ← 新增 provider 字段、SaveRules()、RulesMode()
├── handlers/employee.go               ← 新增 SaveRules handler
├── handlers/config.go                 ← 新建：GetRulesMode handler
├── router/router.go                   ← 注册新路由，Setup 接收 configHandler 参数
└── main.go                            ← 构造 RulesProvider，注入服务，注册 configHandler

frontend/src/
├── features/shared/hooks/useBackend.ts         ← 新增 getRulesMode / saveRules
├── features/employee/components/RulesForm.tsx  ← 双模式提交逻辑 + 按钮文案
└── features/employee/components/RulesDone.tsx  ← 后端模式文案
```

---

## 任务 1：EmployeeRule 模型 + 迁移

**文件：**
- 修改: `backend/db/db.go`

- [ ] **步骤 1：新增 EmployeeRule 模型**

在 `backend/db/db.go` 的 `PayrollLog` 结构体之后添加：

```go
type EmployeeRule struct {
	ID              uint64 `gorm:"primaryKey;autoIncrement" json:"id"`
	EmployeeAddress string `gorm:"type:varchar(42);not null;index" json:"employee_address"`
	ChainID         int64  `gorm:"not null" json:"chain_id"`
	TokenAddress    string `gorm:"type:varchar(42);not null" json:"token_address"`
	Percentage      int64  `gorm:"not null" json:"percentage"` // 基数 10000，40% = 4000
	CreatedAt       int64  `gorm:"not null" json:"created_at"`
	UpdatedAt       int64  `gorm:"not null" json:"updated_at"`
}
```

- [ ] **步骤 2：注册到 AutoMigrate**

将 `Migrate` 函数中的 `AutoMigrate` 调用改为包含 `EmployeeRule`：

```go
func Migrate(database *gorm.DB) error {
	return database.AutoMigrate(&Employee{}, &PayrollLog{}, &EmployeeRule{})
}
```

- [ ] **步骤 3：编译检查**

```bash
cd backend && go build ./...
```

预期：无报错。

- [ ] **步骤 4：提交**

```bash
git add backend/db/db.go
git commit -m "feat(db): 新增 EmployeeRule 模型用于后端规则存储"
```

---

## 任务 2：Config 新增 RulesMode 字段

**文件：**
- 修改: `backend/config/config.go`

- [ ] **步骤 1：在 BlockchainConfig 中添加字段**

在 `EarnEnabled` 字段之后添加：

```go
RulesMode string `yaml:"rules_mode"` // "chain" 或 "backend"，默认 "chain"
```

完整 `BlockchainConfig` 结构体：

```go
type BlockchainConfig struct {
	ChainPayContract   string `yaml:"chain_pay_contract"`
	ExecutorPrivateKey string `yaml:"executor_private_key"`
	LiFiAPIKey         string `yaml:"lifi_api_key"`
	EthRPCURL          string `yaml:"eth_rpc_url"`
	CronEnabled        bool   `yaml:"cron_enabled"`
	EarnEnabled        bool   `yaml:"earn_enabled"`
	RulesMode          string `yaml:"rules_mode"`
}
```

- [ ] **步骤 2：在 Load() 中设置默认值**

在 `Apply defaults` 注释块内（`EthRPCURL` 默认值之后）添加：

```go
if cfg.Blockchain.RulesMode == "" {
    cfg.Blockchain.RulesMode = "chain"
}
```

- [ ] **步骤 3：编译检查**

```bash
cd backend && go build ./...
```

预期：无报错。

- [ ] **步骤 4：提交**

```bash
git add backend/config/config.go
git commit -m "feat(config): 新增 rules_mode 配置项，默认 chain"
```

---

## 任务 3：RulesProvider 接口 + 两个实现

**文件：**
- 新建: `backend/services/rules_provider.go`

- [ ] **步骤 1：创建文件**

新建 `backend/services/rules_provider.go`，内容如下：

```go
package services

import (
	"context"
	"errors"
	"math/big"
	"time"

	"github.com/chainpay/backend/db"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"

	"github.com/chainpay/backend/config"
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
```

- [ ] **步骤 2：编译检查**

```bash
cd backend && go build ./...
```

预期：无报错。

- [ ] **步骤 3：提交**

```bash
git add backend/services/rules_provider.go
git commit -m "feat(services): 新增 RulesProvider 接口及 Chain/DB 两个实现"
```

---

## 任务 4：PayrollService 使用 RulesProvider

**文件：**
- 修改: `backend/services/payroll.go`

- [ ] **步骤 1：PayrollService 结构体添加 provider 字段**

将 `PayrollService` 结构体改为：

```go
type PayrollService struct {
	db        *gorm.DB
	cfg       *config.Config
	ethClient *ethclient.Client
	nonceMgr  *NonceManager
	earnSvc   *EarnService
	rules     RulesProvider
}
```

- [ ] **步骤 2：更新构造函数**

```go
func NewPayrollService(database *gorm.DB, cfg *config.Config, client *ethclient.Client, nm *NonceManager, earnSvc *EarnService, rules RulesProvider) *PayrollService {
	return &PayrollService{db: database, cfg: cfg, ethClient: client, nonceMgr: nm, earnSvc: earnSvc, rules: rules}
}
```

- [ ] **步骤 3：ExecutePayout 中用 provider 替换 GetRulesFromChain**

将 `ExecutePayout` 中以下代码：

```go
// 获取员工规则，无规则则直接转 USDC（100%）
rules, err := s.GetRulesFromChain(employeeAddress)
if err != nil || len(rules) == 0 {
```

替换为：

```go
// 获取员工规则，无规则则直接转 USDC（100%）
rules, err := s.rules.GetRules(employeeAddress)
if err != nil || len(rules) == 0 {
```

- [ ] **步骤 4：删除 GetRulesFromChain 方法**

删除 `payroll.go` 中整个 `GetRulesFromChain` 函数（约 40 行）。该逻辑已迁移到 `ChainRulesProvider.GetRules`。

- [ ] **步骤 5：编译检查**

```bash
cd backend && go build ./...
```

预期：无报错（`chainPayABI` 仍在 `employee.go` 中，供 `ChainRulesProvider` 使用）。

- [ ] **步骤 6：提交**

```bash
git add backend/services/payroll.go
git commit -m "refactor(payroll): ExecutePayout 改用 RulesProvider 接口读取规则"
```

---

## 任务 5：EmployeeService 添加 SaveRules 和 RulesMode

**文件：**
- 修改: `backend/services/employee.go`

- [ ] **步骤 1：EmployeeService 添加 provider 和 rulesMode 字段**

将 `EmployeeService` 结构体改为：

```go
type EmployeeService struct {
	db        *gorm.DB
	cfg       *config.Config
	ethClient *ethclient.Client
	nonceMgr  *NonceManager
	rules     RulesProvider
}
```

- [ ] **步骤 2：更新构造函数**

```go
func NewEmployeeService(database *gorm.DB, cfg *config.Config, client *ethclient.Client, nm *NonceManager, rules RulesProvider) *EmployeeService {
	return &EmployeeService{db: database, cfg: cfg, ethClient: client, nonceMgr: nm, rules: rules}
}
```

- [ ] **步骤 3：添加 SaveRules 和 RulesMode 方法**

在 `UpdateRulesStatus` 方法之前添加：

```go
// RulesMode 返回当前配置的规则存储模式（"chain" 或 "backend"）。
func (s *EmployeeService) RulesMode() string {
	return s.cfg.Blockchain.RulesMode
}

// SaveRules 将员工规则保存到当前配置的存储后端。
// chain 模式下为空操作（链上由前端 setRules 负责）。
func (s *EmployeeService) SaveRules(employeeAddress string, rules []Rule) error {
	return s.rules.SaveRules(employeeAddress, rules)
}
```

- [ ] **步骤 4：编译检查**

```bash
cd backend && go build ./...
```

预期：无报错。

- [ ] **步骤 5：提交**

```bash
git add backend/services/employee.go
git commit -m "feat(services): EmployeeService 新增 SaveRules 和 RulesMode 方法"
```

---

## 任务 6：新增 Handler — SaveRules 和 GetRulesMode

**文件：**
- 修改: `backend/handlers/employee.go`
- 新建: `backend/handlers/config.go`

- [ ] **步骤 1：在 employee.go 中新增 SaveRules handler**

在 `UpdateAutoInvest` 方法之后添加：

```go
// POST /api/v1/employees/:wallet_address/rules
// 仅在 rules_mode: "backend" 时有效；chain 模式返回 405。
func (h *EmployeeHandler) SaveRules(c *gin.Context) {
	if h.svc.RulesMode() != "backend" {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"code": 405, "message": "rules_mode is 'chain': use setRules on the contract", "data": nil})
		return
	}

	wallet := c.Param("wallet_address")
	caller := c.GetString("wallet")

	// 只允许员工本人提交自己的规则
	emp, err := h.svc.GetByWallet(wallet)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "employee not found", "data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	if !strings.EqualFold(emp.WalletAddress, caller) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "forbidden: you are not this employee", "data": nil})
		return
	}

	var body []struct {
		ChainID      int64  `json:"chain_id"`
		TokenAddress string `json:"token_address"`
		Percentage   int64  `json:"percentage"` // 基数 10000
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}
	if len(body) == 0 || len(body) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "rules must be between 1 and 5", "data": nil})
		return
	}
	var total int64
	for _, r := range body {
		total += r.Percentage
	}
	if total != 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "percentages must sum to 10000", "data": nil})
		return
	}

	rules := make([]services.Rule, 0, len(body))
	for _, r := range body {
		rules = append(rules, services.Rule{
			ChainID:      new(big.Int).SetInt64(r.ChainID),
			TokenAddress: common.HexToAddress(r.TokenAddress),
			Percentage:   new(big.Int).SetInt64(r.Percentage),
		})
	}

	if err := h.svc.SaveRules(wallet, rules); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "rules saved", "data": nil})
}
```

在 `employee.go` 的 import 块中补充缺少的包（如果还没有）：

```go
import (
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"regexp"
	"strings"

	"github.com/chainpay/backend/services"
	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)
```

- [ ] **步骤 2：新建 handlers/config.go**

```go
package handlers

import (
	"net/http"

	"github.com/chainpay/backend/config"
	"github.com/gin-gonic/gin"
)

type ConfigHandler struct {
	cfg *config.Config
}

func NewConfigHandler(cfg *config.Config) *ConfigHandler {
	return &ConfigHandler{cfg: cfg}
}

// GET /api/v1/config/rules-mode
func (h *ConfigHandler) GetRulesMode(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    gin.H{"mode": h.cfg.Blockchain.RulesMode},
	})
}
```

- [ ] **步骤 3：编译检查**

```bash
cd backend && go build ./...
```

预期：无报错。

- [ ] **步骤 4：提交**

```bash
git add backend/handlers/employee.go backend/handlers/config.go
git commit -m "feat(handlers): 新增 SaveRules handler 和 GetRulesMode handler"
```

---

## 任务 7：更新 Router 和 main.go

**文件：**
- 修改: `backend/router/router.go`
- 修改: `backend/main.go`

- [ ] **步骤 1：router.go 新增路由**

将 `Setup` 函数签名改为接收 `configHandler`：

```go
func Setup(employeeHandler *handlers.EmployeeHandler, payrollHandler *handlers.PayrollHandler, vaultHandler *handlers.VaultHandler, configHandler *handlers.ConfigHandler) *gin.Engine {
```

在 `employees` 路由组内（`auto-invest` PATCH 之后）添加：

```go
employees.POST("/:wallet_address/rules", employeeHandler.SaveRules)
```

在 `api` 组（`vaults` GET 之后）添加：

```go
// Config (no auth)
api.GET("/config/rules-mode", configHandler.GetRulesMode)
```

- [ ] **步骤 2：main.go 构造 RulesProvider 并注入**

在 `ethClient` / `nonceMgr` 初始化之后，`employeeSvc` 构造之前，添加：

```go
// 根据配置选择规则存储实现
var rulesProvider services.RulesProvider
if cfg.Blockchain.RulesMode == "backend" {
    rulesProvider = services.NewDBRulesProvider(gormDB)
    log.Println("Rules mode: backend (PostgreSQL)")
} else {
    rulesProvider = services.NewChainRulesProvider(cfg, ethClient)
    log.Println("Rules mode: chain (contract)")
}
```

更新服务构造，注入 `rulesProvider`：

```go
employeeSvc := services.NewEmployeeService(gormDB, cfg, ethClient, nonceMgr, rulesProvider)
earnSvc := services.NewEarnService(cfg, ethClient, nonceMgr)
payrollSvc := services.NewPayrollService(gormDB, cfg, ethClient, nonceMgr, earnSvc, rulesProvider)
```

新增 `configHandler` 并传入 router：

```go
configHandler := handlers.NewConfigHandler(cfg)
r := router.Setup(employeeHandler, payrollHandler, vaultHandler, configHandler)
```

- [ ] **步骤 3：编译检查**

```bash
cd backend && go build ./...
```

预期：无报错。

- [ ] **步骤 4：提交**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat(router): 注册规则存储路由，main.go 注入 RulesProvider"
```

---

## 任务 8：前端 — useBackend 新增两个方法

**文件：**
- 修改: `frontend/src/features/shared/hooks/useBackend.ts`

- [ ] **步骤 1：新增 getRulesMode 和 saveRules**

在 `triggerPayout` 之后，`return` 语句之前，添加：

```ts
async function getRulesMode(): Promise<'chain' | 'backend'> {
  const res = await fetch(`${API_URL}/config/rules-mode`)
  const json = await res.json()
  if (json.code !== 200) return 'chain' // 默认回退到 chain
  return json.data.mode as 'chain' | 'backend'
}

async function saveRules(wallet: string, rules: { chain_id: number; token_address: string; percentage: number }[]): Promise<void> {
  const res = await fetch(`${API_URL}/employees/${wallet}/rules`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(rules),
  })
  const json = await res.json()
  if (json.code !== 200) throw new Error(json.message)
}
```

将 `return` 语句更新为：

```ts
return { getEmployees, getEmployeeByWallet, addEmployee, getPayrollLogs, getVaults, getAutoInvest, updateAutoInvest, triggerPayout, getRulesMode, saveRules }
```

- [ ] **步骤 2：类型检查**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

预期：无报错。

- [ ] **步骤 3：提交**

```bash
git add frontend/src/features/shared/hooks/useBackend.ts
git commit -m "feat(frontend): useBackend 新增 getRulesMode 和 saveRules"
```

---

## 任务 9：前端 — RulesForm 双模式

**文件：**
- 修改: `frontend/src/features/employee/components/RulesForm.tsx`

- [ ] **步骤 1：重写 RulesForm.tsx**

```tsx
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useContract } from '../../shared/hooks/useContract'
import { useBackend } from '../../shared/hooks/useBackend'
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../../../theme'

interface Rule {
  chainId: number
  tokenAddress: string
  percentage: number
}

interface Props {
  onSaved: (txHash: string) => void
}

const EMPTY_RULE: Rule = { chainId: 8453, tokenAddress: '0x0000000000000000000000000000000000000000', percentage: 0 }

export default function RulesForm({ onSaved }: Props) {
  const { address } = useAccount()
  const { setRules } = useContract()
  const { getRulesMode, saveRules } = useBackend()
  const [mode, setMode] = useState<'chain' | 'backend' | null>(null)
  const [rules, setRulesState] = useState<Rule[]>([{ ...EMPTY_RULE, percentage: 100 }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRulesMode().then(setMode)
  }, [])

  const total = rules.reduce((sum, r) => sum + Number(r.percentage), 0)
  const canSubmit = total === 100 && rules.length > 0

  function addRule() {
    if (rules.length >= 5) return
    setRulesState([...rules, { ...EMPTY_RULE, percentage: 0 }])
  }

  function removeRule(i: number) {
    setRulesState(rules.filter((_, idx) => idx !== i))
  }

  function updateRule(i: number, field: keyof Rule, value: string | number) {
    const updated = [...rules]
    updated[i] = { ...updated[i], [field]: value }
    setRulesState(updated)
  }

  async function handleSubmit() {
    if (!canSubmit || !address) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'backend') {
        // 后端模式：直接 POST API，无需钱包签名
        await saveRules(address, rules.map(r => ({
          chain_id: r.chainId,
          token_address: r.tokenAddress,
          percentage: Math.round(r.percentage * 100), // 转为基数 10000
        })))
        onSaved('') // 后端模式无 txHash
      } else {
        // 链上模式：签名并广播 setRules
        const contractRules = rules.map(r => ({
          chainId: BigInt(r.chainId),
          tokenAddress: r.tokenAddress as `0x${string}`,
          basisPoints: BigInt(Math.round(r.percentage * 100)),
        }))
        const txHash = await setRules(contractRules)
        onSaved(txHash)
      }
    } catch (e: any) {
      setError(e.shortMessage ?? e.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const selectStyle = {
    background: '#252840',
    border: '1px solid #2d3155',
    borderRadius: 6,
    color: '#fff',
    padding: '6px 10px',
    fontSize: 12,
    flex: 1,
  }

  const isBackend = mode === 'backend'

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <h2 className="text-white text-xl font-bold mb-1">设置接收规则</h2>
      {isBackend ? (
        <p className="text-sm mb-1" style={{ color: '#10b981' }}>✓ 后端模式：规则保存到服务器，可重新提交修改</p>
      ) : (
        <p className="text-sm mb-1" style={{ color: '#f59e0b' }}>⚠ 链上模式：规则写入合约后不可修改，请仔细确认</p>
      )}
      <p className="text-xs mb-6" style={{ color: '#94a3b8' }}>最多添加 5 条规则，比例总和必须等于 100%</p>

      <div className="flex flex-col gap-3 mb-4">
        {rules.map((rule, i) => {
          const tokens = SUPPORTED_TOKENS[rule.chainId] ?? []
          return (
            <div key={i} className="rounded-xl p-3" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
              <div className="flex items-center mb-2">
                <span className="text-xs" style={{ color: '#94a3b8' }}>规则 {i + 1}</span>
                {rules.length > 1 && (
                  <button onClick={() => removeRule(i)} className="ml-auto text-xs" style={{ color: '#ef4444' }}>✕</button>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  style={selectStyle}
                  value={rule.chainId}
                  onChange={e => {
                    updateRule(i, 'chainId', Number(e.target.value))
                    updateRule(i, 'tokenAddress', '0x0000000000000000000000000000000000000000')
                  }}
                >
                  {SUPPORTED_CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select style={selectStyle} value={rule.tokenAddress} onChange={e => updateRule(i, 'tokenAddress', e.target.value)}>
                  {tokens.map(t => <option key={t.symbol} value={t.address}>{t.symbol}</option>)}
                </select>
                <div className="flex items-center gap-1" style={{ flex: 1 }}>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={rule.percentage}
                    onChange={e => updateRule(i, 'percentage', Number(e.target.value))}
                    style={{ ...selectStyle, flex: 1 }}
                  />
                  <span className="text-xs" style={{ color: '#6366f1' }}>%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center mb-6">
        {rules.length < 5 && (
          <button onClick={addRule} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: '#1a1f35', color: '#6366f1', border: '1px dashed #2d3155' }}>
            + 添加规则
          </button>
        )}
        <div className="ml-auto text-sm font-semibold" style={{ color: total === 100 ? '#10b981' : '#ef4444' }}>
          总计 {total}% {total === 100 ? '✓' : '≠ 100%'}
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting || mode === null}
        className="w-full py-3 rounded-xl text-sm font-semibold"
        style={{ background: canSubmit && !submitting ? '#6366f1' : '#252840', color: canSubmit && !submitting ? '#fff' : '#4b5563' }}
      >
        {submitting
          ? (isBackend ? '保存中...' : '写入合约中...')
          : (isBackend ? '保存规则 →' : '写入链上 →')}
      </button>
    </div>
  )
}
```

- [ ] **步骤 2：类型检查**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

预期：无报错。

- [ ] **步骤 3：提交**

```bash
git add frontend/src/features/employee/components/RulesForm.tsx
git commit -m "feat(frontend): RulesForm 支持 chain/backend 双模式提交"
```

---

## 任务 10：前端 — RulesDone 文案按模式切换

**文件：**
- 修改: `frontend/src/features/employee/components/RulesDone.tsx`
- 修改: `frontend/src/features/employee/pages/EmployeePage.tsx`

- [ ] **步骤 1：RulesDone 接收 mode prop**

将 `RulesDone.tsx` 的 `Props` 接口改为：

```tsx
interface Props {
  txHash?: string
  mode?: 'chain' | 'backend'
}
```

将组件签名和规则配置文案改为：

```tsx
export default function RulesDone({ txHash, mode }: Props) {
```

将 `<p className="text-sm" style={{ color: '#10b981' }}>已在链上配置 ✓</p>` 改为：

```tsx
<p className="text-sm" style={{ color: '#10b981' }}>
  {mode === 'backend' ? '已在后端配置 ✓' : '已在链上配置 ✓'}
</p>
```

- [ ] **步骤 2：EmployeePage 传入 mode**

在 `EmployeePage.tsx` 中，新增对 `getRulesMode` 的调用和状态：

在 `import { useBackend }` 引入中解构 `getRulesMode`：

```ts
const { getEmployeeByWallet, getRulesMode } = useBackend()
```

在已有 `useState` 之后添加：

```ts
const [rulesMode, setRulesMode] = useState<'chain' | 'backend'>('chain')

useEffect(() => {
  getRulesMode().then(setRulesMode)
}, [])
```

将 `<RulesDone txHash={savedTxHash} />` 改为：

```tsx
<RulesDone txHash={savedTxHash} mode={rulesMode} />
```

- [ ] **步骤 3：类型检查**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

预期：无报错。

- [ ] **步骤 4：提交**

```bash
git add frontend/src/features/employee/components/RulesDone.tsx frontend/src/features/employee/pages/EmployeePage.tsx
git commit -m "feat(frontend): RulesDone 根据 rules_mode 切换配置文案"
```

---

## 最终验证

- [ ] **后端编译**

```bash
cd backend && go build ./...
```

预期：无报错。

- [ ] **前端类型检查**

```bash
cd frontend && npx tsc --noEmit
```

预期：无报错。

- [ ] **自检清单（对照 spec）**

- [ ] `RulesProvider` 接口有 `GetRules` 和 `SaveRules` 两个方法
- [ ] `ChainRulesProvider.SaveRules` 是空操作
- [ ] `DBRulesProvider.SaveRules` 先删后插，并更新 `has_rules = true`
- [ ] `POST /employees/:wallet/rules` 在 chain 模式返回 405
- [ ] `GET /config/rules-mode` 无需鉴权
- [ ] `RulesForm` 按钮：chain 模式显示"写入链上 →"，backend 模式显示"保存规则 →"
- [ ] backend 模式警告文案变为绿色"✓ 后端模式：规则可重新提交修改"
- [ ] `config.yaml` 不设 `rules_mode` 时默认为 `"chain"`
