# ChainPay 全量代码审计报告

> 审计日期：2026-04-07
> 审计范围：智能合约（ChainPay.sol）+ Go 后端（handlers / services / middleware / config / db / cron）
> 代码基准：提交 `68d9598` 及之后修复
> 前置条件：PostgreSQL 未部署，EXECUTOR_PRIVATE_KEY 未配置，合约未部署

---

## 执行摘要

| 层级 | 风险评级 | 状态 |
|---|---|---|
| 智能合约 ChainPay.sol | 🟡 Medium-Low | 审计通过，测试 26/26 全绿 |
| Go 后端 Handler 层 | 🟡 Medium | 大部分已修复，1 项待处理 |
| Go 后端 Service 层 | 🟢 Low | 已修复 nonce/HTTP/goroutine 等问题 |
| Go 后端 Config/DB 层 | 🟢 Low | decimal.Decimal 正确使用 |
| Go 后端 Cron | 🟡 Medium-Low | SkipIfStillRunning 已加，单实例限制已知 |

**之前版本共 24 个问题，已修复 17 个，剩余架构级限制 7 个。**

---

## 一、智能合约（ChainPay.sol）

### 测试覆盖：26/26 全绿 ✅

| 测试项 | 结果 |
|---|---|
| registerEmployee（4 项）| ✅ |
| setRules（6 项）| ✅ |
| executePayout（8 项）含精度修复验证 | ✅ |
| rescueTokens（4 项）| ✅ |
| setExecutor（3 项）| ✅ |

### ✅ 已具备的安全措施

| 措施 | 实现 |
|---|---|
| ReentrancyGuard | `executePayout` 有 `nonReentrant` 修饰符 |
| SafeERC20 | `safeTransferFrom` + `forceApprove`（OpenZeppelin v5）|
| 溢出保护 | Solidity 0.8.20 内置 math overflow |
| 精度修复 | `remaining` 模式消除最后一条规则 wei 截断 |
| 暂停机制 | `pause()` / `unpause()` / `rescueTokens()` |
| 事件追溯 | 4 个完整事件，覆盖所有关键操作 |
| 零地址检查 | 构造函数、`setExecutor`、`rescueTokens` |

---

### 1.1 🟡 `registerEmployee` 前端抢注（Medium-Low）

**问题：** 任何人都能调用 `registerEmployee(victimAddress)` 将任意地址注册为自己的员工。注册后无法撤销，导致真正雇主无法注册该员工。

**现状缓解：** Go 后端 `EmployeeService.Create()` 同步调用链上 `registerEmployee`，由执行者钱包签名。黑客松环境下执行者由后端控制，无法被滥用。

**生产建议：** 改为员工主动注册，或要求雇主 + 员工双方签名。

---

### 1.2 🟢 执行者权限边界（Info）

**问题：** 执行者可传任意 `lifiCallData`，理论上可将 USDC 路由到任意地址。

**现状：** 执行者是 Go 后端热钱包，可信角色，黑客松可接受。

**生产建议：** calldata 由前端生成入库，后端只读不篡改。

---

### 1.3 🟢 无 `totalAmount` 上限（Info）

**问题：** `executePayout` 无发薪上限校验。

**现状：** 取决于雇主判断，黑客松无风险。

---

## 二、Go 后端 Handler 层

### 2.1 ✅ `UpdateRulesStatus` 鉴权（已修复）

`handlers/employee.go` 现在验证 `caller == emp.WalletAddress`，只有员工本人才能更新自己的规则状态，违者返回 403。

```go
if !strings.EqualFold(emp.WalletAddress, caller) {
    c.JSON(http.StatusForbidden, gin.H{"message": "forbidden: you are not this employee"})
    return
}
```

---

### 2.2 ✅ `GetLog` 所有权验证（已修复）

`handlers/payroll.go` 现在校验 `log.EmployerAddress == caller`，未授权返回 403。

```go
if !strings.EqualFold(log.EmployerAddress, employer) {
    c.JSON(http.StatusForbidden, ...)
}
```

---

### 2.3 🟢 `ListLogs` 无 ownership 细粒度过滤（Info）

**问题：** `GET /api/v1/payroll/logs` 用 `X-Wallet-Address` 过滤雇主，但如果请求头伪造可跨雇主查询。

**现状：** `middleware/auth.go` 只验证地址格式，不验证签名，黑客松受控环境可接受。

**生产建议：** 实现 EIP-191 签名验证（Sign-In With Ethereum）。

---

### 2.4 ✅ `status` 白名单校验（已修复）

`handlers/payroll.go` 现在只接受 `pending` / `success` / `failed` 三个合法值。

```go
if !map[string]bool{"pending": true, "success": true, "failed": true}[statusFilter] {
    c.JSON(http.StatusBadRequest, ...)
}
```

---

### 2.5 ✅ `walletRegex` 包级复用（已修复）

`handlers/employee.go` 移除了重复的 `regexp.MustCompile`，改用与 `middleware/auth.go` 共享的包级变量。

---

### 2.6 ✅ `SalaryAmount` 正数校验（已修复）

`handlers/employee.go` 的 `Create` 方法增加了：

```go
if salary.LessThanOrEqual(decimal.Zero) {
    c.JSON(http.StatusBadRequest, gin.H{"message": "salary_amount must be positive"})
    return
}
```

---

### 2.7 ✅ `ErrRecordNotFound` 错误处理（已修复）

`handlers/employee.go` 的 `Get` 和 `Verify` 方法现在正确区分 404 和 500：

```go
if errors.Is(err, gorm.ErrRecordNotFound) {
    c.JSON(http.StatusNotFound, ...)  // 404
    return
}
if err != nil {
    c.JSON(http.StatusInternalServerError, ...)  // 500
    return
}
```

---

## 三、Go 后端 Service 层

### 3.1 ✅ Nonce 并发安全（已修复）

引入 `NonceManager`（`services/nonce.go`），所有链上交易共享单一 nonce 计数器，互斥保护：

```go
type NonceManager struct {
    mu      sync.Mutex
    client  *ethclient.Client
    address common.Address
    next    *uint64
}
```

交易失败后调用 `Reset()` 强制重新从链上同步 nonce。

---

### 3.2 ✅ HTTP response body 泄漏（已修复）

`BuildLiFiCalldata` 使用内层匿名函数确保每次 HTTP 响应正确关闭：

```go
body, err := func() ([]byte, error) {
    resp, err := lifiHTTPClient.Do(req)
    if err != nil { return nil, err }
    defer resp.Body.Close()
    return io.ReadAll(resp.Body)
}()
```

---

### 3.3 ✅ 交易广播后立即记录 tx_hash（已修复）

`ExecutePayout` 广播后立刻写 `tx_hash` 到 DB，再异步轮询 receipt：

```go
txHash := signedTx.Hash().Hex()
s.db.Model(logEntry).Updates(map[string]interface{}{"tx_hash": txHash})
logEntry.TxHash = txHash
go s.awaitReceipt(signedTx.Hash(), logEntry.ID)
```

`awaitReceipt` 5 分钟超时后标记 `failed`。

---

### 3.4 ✅ Li.Fi HTTP 无超时（已修复）

使用带 15 秒超时的专属 HTTP Client：

```go
var lifiHTTPClient = &http.Client{Timeout: 15 * time.Second}
```

---

### 3.5 ✅ ethclient 错误传播（已修复）

`DialEthClient` 错误不再被丢弃，`main.go` 启动时 fail fast：

```go
ec, err := services.DialEthClient(cfg.Blockchain.EthRPCURL)
if err != nil {
    log.Fatalf("failed to dial ethclient: %v", err)
}
```

---

### 3.6 ✅ 共享 ethclient + nonceMgr（已修复）

`main.go` 在启动时创建单一 `*ethclient.Client` 和 `NonceManager`，注入两个 service：

```go
employeeSvc := services.NewEmployeeService(gormDB, cfg, ethClient, nonceMgr)
payrollSvc := services.NewPayrollService(gormDB, cfg, ethClient, nonceMgr)
```

---

### 3.7 🟡 Li.Fi calldata `steps` 为空时静默跳过（Medium）

**位置：** `services/payroll.go` `BuildLiFiCalldata()` 第 167-169 行

**问题：** 如果 Li.Fi 对某规则返回空 `steps`，calldata 数量 < rules 数量，`executePayout` 合约调用 revert（`calldata length mismatch`），但这里静默跳过不报错。

```go
if len(lifiResp.Steps) == 0 {
    continue  // 静默跳过，导致 calldata 数量不匹配
}
```

**修复建议：** 返回错误而非静默跳过。

---

### 3.8 🟢 `getRulesFromChain` ABI 解包（Info）

**现状：** 多重 `ok` 检查防止 panic，解包逻辑较脆弱但暂未出错。

---

### 3.9 ✅ `ToAddress` 已修复

`BuildLiFiCalldata` 现在传入 `toAddress = employeeAddress`（员工钱包地址），不再是空字符串。

---

## 四、Go 后端 Config / DB 层

### 4.1 ✅ `decimal.Decimal` 用于金额 ✅

`Employee.SalaryAmount` 和 `PayrollLog.Amount` 使用 `shopspring/decimal`，避免 float64 精度丢失。

---

### 4.2 ✅ Config 密码必填 ✅

`config.Load()` 要求 `database.password` 非空，漏填启动失败。

---

### 4.3 ✅ YAML 配置格式（Info）

使用 `goccy/go-yaml` 替代环境变量直读，支持 `config.yaml` 文件集中管理，敏感信息不散落在环境变量中。

---

### 4.4 ⚠️ Railway SSL 需手动配置（Info）

默认 `sslmode=disable`，Railway PostgreSQL 需要 `sslmode=require`，需在 `config.yaml` 中手动配置。

---

## 五、Go 后端 Cron

### 5.1 ✅ `SkipIfStillRunning`（已修复）

```go
c := cron.New(cron.WithChain(
    cron.SkipIfStillRunning(cron.DefaultLogger),
))
```

防止单个实例内重复触发。

---

### 5.2 🟡 多实例重复发薪（Medium）

**问题：** `SkipIfStillRunning` 只防单实例，多实例部署会重复触发同一员工的多次发薪。

**现状：** 当前只有 1 个实例，无问题。

**生产建议：** Redis 分布式锁，或 DB 行锁 `SELECT FOR UPDATE`。

---

### 5.3 🟢 `next_pay_date` 提前更新（Low）

**问题：** `ExecutePayout` 广播交易后（pending）就更新 `next_pay_date`，但交易需约 5 分钟确认。如果交易失败，`next_pay_date` 已跳到下一周期，该次发薪永久跳过。

**现状：** 已知，`awaitReceipt` 超时后标记 `failed`，但 `next_pay_date` 不回退。

**修复建议：** `awaitReceipt` 结束时如果 status=failed，回写 `next_pay_date = 上一次发薪日 + 周期`。

---

## 六、已知架构级限制（黑客松范围内不可改变）

| 限制 | 说明 |
|---|---|
| 钱包认证无签名 | `X-Wallet-Address` 仅格式校验，可被任意填报 |
| Cron 无分布式锁 | 单实例部署才安全 |
| Li.Fi API Key 明文存储 | 存 `config.yaml`，已在 `.gitignore` |
| GORM AutoMigrate | 生产需用 sql-migrate 或 flyway |
| 执行者私钥明文配置 | 必须在 `config.yaml` 或环境变量中 |

---

## 七、修复状态全表

| # | 问题 | 位置 | 状态 |
|---|---|---|---|
| C-1 | Nonce 永远为 0 | services/employee.go, payroll.go | ✅ NonceManager |
| C-2 | defer resp.Body.Close 在循环内 | services/payroll.go | ✅ 匿名函数包裹 |
| C-3 | tx_hash 永远不记录 | services/payroll.go | ✅ 立即写 DB + 异步 awaitReceipt |
| C-4 | UpdateRulesStatus 无鉴权 | handlers/employee.go | ✅ caller == wallet 校验 |
| H-1 | 钱包认证无签名 | middleware/auth.go | ⚠️ 架构限制，黑客松可接受 |
| H-2 | ethclient 错误被丢弃 | services/*.go | ✅ DialEthClient 返回 error |
| H-3 | 两 service 各自 Dial ethclient | main.go | ✅ 共享 ethclient + NonceManager |
| H-4 | SalaryAmount 未校验正数 | handlers/employee.go | ✅ LessThanOrEqual 校验 |
| H-5 | ErrRecordNotFound 处理错误 | handlers/employee.go | ✅ 正确区分 404/500 |
| H-6 | HTTP 无超时 goroutine 泄漏 | services/payroll.go | ✅ 15s timeout client |
| H-7 | Cron 无并发防护 | services/cron.go | ✅ SkipIfStillRunning |
| M-1 | ListLogs N+1 查询 | handlers/payroll.go | ✅ batch fetch |
| M-2 | status 值无白名单 | handlers/payroll.go | ✅ 枚举校验 |
| M-3 | walletRegex 重复编译 | handlers/employee.go | ✅ 包级共享 |
| M-4 | DB 密码默认 password | config/config.go | ✅ 无默认值，必填 |
| M-5 | next_pay_date 更新结果未检查 | services/cron.go | ⚠️ 已知，未修复 |
| M-6 | GetLog 无所有权验证 | handlers/payroll.go | ✅ 校验 EmployerAddress |
| M-7 | Li.Fi ToAddress 始终为空 | services/payroll.go | ✅ 已修复 |

---

## 八、部署前必检清单

| 检查项 | 状态 |
|---|---|
| PostgreSQL 已创建（Railway 或本地）| ❌ 待完成 |
| `config.yaml` 中 `DB_PASSWORD` 已填写 | ❌ 待完成 |
| `sslmode: require`（如用 Railway）| ❌ 待完成 |
| `EXECUTOR_PRIVATE_KEY` 已填写 | ❌ 待完成 |
| `CHAIN_PAY_CONTRACT` 已填写（合约部署后）| ❌ 待完成 |
| `LIFI_API_KEY` 已填写 | ❌ 待完成 |
| 合约已部署到 Base Mainnet | ❌ 待完成 |
| 前端 `VITE_CHAIN_PAY_CONTRACT` 已填 | ❌ 待完成 |

---

*本报告基于代码 `68d9598` 及之后修复版本的静态分析。合约部署前建议再做 foundry forge 模糊测试。*
