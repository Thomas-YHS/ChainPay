# Pure Composer 发薪 — 实现计划

> **AI 执行者注意**：请使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐任务执行。步骤使用复选框（`- [ ]`）语法。

**目标：** 用纯 LiFi Composer API 替代 ChainPay 合约执行发薪。后端钱包持有 USDC，直接调用 Composer，签名并广播交易。Cron 定时发薪无需 ChainPay 合约。

**架构：**
- Employer 转 USDC 到后端钱包（一次性或按需）
- 后端调用 `GET /v1/quote`，`fromAddress = 后端钱包地址`
- 后端对 `transactionRequest` 签名并通过 go-ethereum 提交
- LiFi 从后端钱包拉取 USDC，路由到员工
- 发薪执行不再需要 ChainPay 合约

**技术栈：** Go (Gin), go-ethereum, LiFi Composer API (`li.quest/v1/quote`), Base Mainnet

---

## 文件变更概览

```
backend/
├── services/payroll.go      — 重写：移除合约调用，改用 Composer GET /v1/quote
├── services/employee.go     — 移除 getRulesFromChain 和 chainPayABI（如果只用于发薪）
├── handlers/payroll.go       — 调整响应格式
├── config/config.go           — 验证 ExecutorPrivateKey 为必填
└── db/models.go              — PayrollLog 结构不变

frontend/
└── src/features/employee/    — 改从 API 读取规则，而非调用合约
```

---

## 常量定义

```go
const (
    USDC_BASE         = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    LIFI_DIAMOND_BASE = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"
    BASE_CHAIN_ID     = 8453
)
```

---

## Composer API 响应结构（新增）

```go
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
        FromAmount string `json:"fromAmount"`
        FromAddress string `json:"fromAddress"`
        ToAddress   string `json:"toAddress"`
    } `json:"action"`
    Estimate struct {
        ApprovalAddress string `json:"approvalAddress"` // LiFi Diamond 地址
        ToAmount        string `json:"toAmount"`
        ToAmountMin     string `json:"toAmountMin"`
        FromAmount      string `json:"fromAmount"`
        FeeCosts        []struct {
            Token  struct{ Symbol string `json:"symbol"` } `json:"token"`
            Amount string `json:"amount"`
        } `json:"feeCosts"`
        GasCosts []struct {
            Amount string `json:"amount"`
        } `json:"gasCosts"`
    } `json:"estimate"`
    TransactionRequest struct {
        To       string `json:"to"`       // LiFi Diamond
        Data     string `json:"data"`     // VM bytecode
        Value    string `json:"value"`    // ETH 金额（hex）
        GasLimit string `json:"gasLimit"` // hex
        GasPrice string `json:"gasPrice"` // hex
        ChainID  int64  `json:"chainId"`
        From     string `json:"from"`     // 后端钱包地址
    } `json:"transactionRequest"`
}
```

---

## 任务 1：重写 BuildLiFiCalldata → BuildComposerQuote

**文件：**
- 修改: `backend/services/payroll.go:102-175`

### 步骤

- [ ] **步骤 1：编写测试框架**

```go
// backend/services/payroll_test.go
package services

func TestBuildComposerQuote_ValidResponse(t *testing.T) {
    // 跳过 CI — 需要真实的 LIFI_API_KEY
    t.Skip("集成测试：需要配置 LIFI_API_KEY")
}
```

- [ ] **步骤 2：实现新的 BuildComposerQuote 函数**

用以下代码替换 `BuildLiFiCalldata`：

```go
// BuildComposerQuote 调用 GET /v1/quote，返回解析后的 transactionRequest。
// fromAddress = 后端钱包地址（来自 ExecutorPrivateKey）
func (s *PayrollService) BuildComposerQuote(
    fromAddress string,   // 后端钱包地址
    toAddress string,     // 员工钱包地址
    fromToken string,     // USDC 地址
    toToken string,       // 员工接收代币地址
    fromAmount string,    // 最小单位金额（如 1000000 = 1 USDC）
) (to, data, value, gasLimit, chainId, fromAddr string, err error) {
    if s.cfg.Blockchain.LiFiAPIKey == "" {
        return "", "", "", "", "", "", errors.New("LIFI_API_KEY not configured")
    }

    url := "https://li.quest/v1/quote?" +
        "fromChain=" + fmt.Sprintf("%d", BASE_CHAIN_ID) +
        "&toChain=" + fmt.Sprintf("%d", BASE_CHAIN_ID) +
        "&fromToken=" + fromToken +
        "&toToken=" + toToken +
        "&fromAddress=" + fromAddress +
        "&toAddress=" + toAddress +
        "&fromAmount=" + fromAmount

    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return "", "", "", "", "", "", err
    }
    req.Header.Set("Authorization", "Bearer "+s.cfg.Blockchain.LiFiAPIKey)
    req.Header.Set("Accept", "application/json")

    resp, err := lifiHTTPClient.Do(req)
    if err != nil {
        return "", "", "", "", "", "", fmt.Errorf("li.quest request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return "", "", "", "", "", "", fmt.Errorf("LiFi API error %d: %s", resp.StatusCode, string(body))
    }

    var quote composerQuoteAPIResponse
    if err := json.NewDecoder(resp.Body).Decode(&quote); err != nil {
        return "", "", "", "", "", "", fmt.Errorf("failed to decode quote response: %w", err)
    }

    txReq := quote.TransactionRequest
    return txReq.To, txReq.Data, txReq.Value, txReq.GasLimit,
        fmt.Sprintf("%d", txReq.ChainID), txReq.From, nil
}
```

- [ ] **步骤 3：运行编译检查**

```bash
cd backend && go build ./...
```

- [ ] **步骤 4：提交**

```bash
git add backend/services/payroll.go
git commit -m "feat(payroll): 新增 BuildComposerQuote 使用 GET /v1/quote"
```

---

## 任务 2：重写 ExecutePayout — 纯 Composer + 后端钱包

**文件：**
- 修改: `backend/services/payroll.go:195-310`

**核心变化：**
- 移除 `ChainPayContract` 依赖
- 移除 `chainPayABI.Pack("executePayout", ...)`
- 新增 `approveUSDC(LiFi, amount)` 步骤
- 从 `ExecutorPrivateKey` 推导 `fromAddress`（后端钱包）
- 每条规则调用一次 `BuildComposerQuote`（每条规则一个交易）
- 对每个 `transactionRequest` 签名并提交

### 步骤

- [ ] **步骤 1：实现 approveUSDC 函数**

```go
// approveUSDC 授权 LiFi Diamond 支配后端钱包的 USDC。
// 返回 approve 交易的哈希。
func (s *PayrollService) approveUSDC(amount *big.Int) (string, error) {
    privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.Blockchain.ExecutorPrivateKey, "0x"))
    if err != nil {
        return "", err
    }
    backendWallet := crypto.PubkeyToAddress(privateKey.PublicKey)

    auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(BASE_CHAIN_ID))
    if err != nil {
        return "", err
    }

    usdcAddr := common.HexToAddress(USDC_BASE)
    lifiAddr := common.HexToAddress(LIFI_DIAMOND_BASE)

    // 构造 ERC20 approve calldata
    // selector: 0x095ea7b3 = approve(address, uint256)
    data := common.Hex2Bytes("0x095ea7b3")
    data = append(data, common.LeftPadBytes(lifiAddr.Bytes(), 32)...)  // spender
    data = append(data, common.LeftPadBytes(amount.Bytes(), 32)...)    // amount

    ctx := context.Background()
    msg := ethereum.CallMsg{From: backendWallet, To: &usdcAddr, Data: data}
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

    return signedTx.Hash().Hex(), nil
}
```

- [ ] **步骤 2：重写 ExecutePayout 函数**

```go
// ExecutePayout 使用纯 Composer 触发发薪（无需 ChainPay 合约）。
// 每条规则执行流程：
//   1. 后端approve USDC 给 LiFi Diamond
//   2. 后端调用 GET /v1/quote（fromAddress = 后端钱包）
//   3. 后端签名并提交 transactionRequest
//   4. LiFi 从后端钱包拉取 USDC → 路由到员工
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

    // 从私钥推导后端钱包地址
    privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.cfg.Blockchain.ExecutorPrivateKey, "0x"))
    if err != nil {
        return nil, err
    }
    backendWallet := crypto.PubkeyToAddress(privateKey.PublicKey)
    salaryStr := salaryAmount.Shift(6).String() // USDC 精度 6 位

    // 获取员工规则，无规则则直接转 USDC
    rules, err := s.GetRulesFromChain(employeeAddress)
    if err != nil || len(rules) == 0 {
        rules = []Rule{{
            ChainID:      big.NewInt(BASE_CHAIN_ID),
            TokenAddress: common.HexToAddress(USDC_BASE),
            Percentage:   big.NewInt(10000), // 100%
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

        // 步骤 1: Approve USDC 给 LiFi
        approveTxHash, err := s.approveUSDC(ruleAmount)
        if err != nil {
            return nil, fmt.Errorf("approve failed: %w", err)
        }
        s.ethClient.WaitForTransaction(ctx, common.HexToHash(approveTxHash))
        log.Printf("ExecutePayout: approved %s USDC (tx=%s)", ruleAmountStr, approveTxHash)

        // 步骤 2: 获取 Composer quote
        to, data, value, gasLimit, _, from, err := s.BuildComposerQuote(
            backendWallet.Hex(),                 // fromAddress = 后端钱包
            employeeAddress,                      // toAddress = 员工
            USDC_BASE,                           // fromToken = USDC
            rule.TokenAddress.Hex(),             // toToken
            ruleAmountStr,                      // fromAmount
        )
        if err != nil {
            return nil, fmt.Errorf("composer quote failed: %w", err)
        }

        // 步骤 3: 签名并提交交易
        toAddr := common.HexToAddress(to)
        txData, _ := hex.DecodeString(strings.TrimPrefix(data, "0x"))
        txValue, _ := new(big.Int).SetString(strings.TrimPrefix(value, "0x"), 16)
        txGasLimit, _ := new(big.Int).SetString(strings.TrimPrefix(gasLimit, "0x"), 16)
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

        tx := types.NewTransaction(nonce, toAddr, txValue, txGasLimit, gasPrice, txData)
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
```

- [ ] **步骤 3：新增 triggerAutoInvestPureComposer**

```go
// triggerAutoInvestPureComposer 将部分薪资存入 LiFi Earn 理财。
// 对于纯 Composer 架构，资金来自后端钱包。
func (s *PayrollService) triggerAutoInvestPureComposer(
    employeeAddress string,
    salaryAmount decimal.Decimal,
    fromAddress string, // 后端钱包地址
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

    // 使用已有的 EarnService（它已经用后端钱包签名）
    txHash, err := s.earnSvc.ExecuteDeposit(
        emp.AutoInvestVaultID,
        fromAddress,                           // 后端钱包
        emp.WalletAddress,                    // 员工
        investAmount.Shift(6).String(),      // USDC 精度
        USDC_BASE,
    )
    if err != nil {
        log.Printf("triggerAutoInvestPureComposer: deposit failed for %s: %v", employeeAddress, err)
        return
    }
    log.Printf("triggerAutoInvestPureComposer: deposited %s USDC for %s (tx=%s)", investAmount.String(), employeeAddress, txHash)
}
```

- [ ] **步骤 4：编译检查**

```bash
cd backend && go build ./...
```

- [ ] **步骤 5：提交**

```bash
git add backend/services/payroll.go
git commit -m "feat(payroll): 重写 ExecutePayout 为 Pure Composer — 无合约调用"
```

---

## 任务 3：更新配置文件验证

**文件：**
- 修改: `backend/config/config.go`

ExecutorPrivateKey 现在是必填（没有合约可以兜底）。

- [ ] **步骤 1：添加必填验证**

```go
// 在 Load() 函数中，现有验证之后添加：
if cfg.Blockchain.ExecutorPrivateKey == "" {
    return nil, fmt.Errorf("blockchain.executor_private_key is required for Pure Composer payroll")
}
```

- [ ] **步骤 2：提交**

```bash
git add backend/config/config.go
git commit -m "fix(config): ExecutorPrivateKey 改为必填（Pure Composer 架构）"
```

---

## 任务 4：前端适配 — 从 API 而非合约读取规则

**文件：**
- 修改: `frontend/src/features/employee/` 相关文件

- [ ] **步骤 1：搜索前端规则读取代码**

```bash
grep -rn "getRules\|ChainPay\|contract" frontend/src/features/employee/
```

- [ ] **步骤 2：用 API 调用替代合约调用**

前端原来调用合约的 `getRules()`，改为调用后端 API（如 `GET /api/v1/employees/:wallet/rules`）。

- [ ] **步骤 3：提交**

```bash
git add frontend/src/features/employee/
git commit -m "feat(frontend): 员工规则改从 API 读取，不再依赖合约"
```

---

## 任务 5：端到端手动测试

**前提条件：**
1. 后端钱包有 ETH（Gas）+ USDC
2. 员工已在数据库注册
3. `config.yaml` 中配置了 `lifi_api_key` 和 `executor_private_key`

- [ ] **步骤 1：给后端钱包充值**

从 Employer 测试钱包转 10 USDC + 0.01 ETH 到后端钱包地址（由 `executor_private_key` 推导）

- [ ] **步骤 2：触发手动发薪**

```bash
curl -X POST http://localhost:8080/api/v1/payroll/execute \
  -H "Content-Type: application/json" \
  -H "X-Wallet: 0xEMPLOYER_WALLET" \
  -d '{"employee_wallet": "0xEMPLOYEE_WALLET"}'
```

预期：返回 `"status": "pending"` 和 `"tx_hash"`

- [ ] **步骤 3：在 Basescan 上验证**

检查：
1. Approval 交易：USDC approve 给 LiFi Diamond
2. Composer 交易：后端钱包 → LiFi → 员工钱包
3. 员工收到了预期代币

---

## 任务 6：更新审计文档

**文件：**
- 新建: `docs/technical/audit/v0.5-pure-composer.md`

记录架构变更：
- Pure Composer 替代 ChainPay 合约发薪
- 风险提示：后端钱包是单点故障
- 移除发薪路径中的 ChainPay 合约引用

---

## 自检清单

- [ ] `go build ./...` 编译通过
- [ ] 使用 `GET /v1/quote`（而非旧的 `POST /v1/advanced/swap-and-execute`）
- [ ] `ExecutePayout` 不再调用 `chainPayABI.Pack`
- [ ] 包含 USDC approve 步骤（在调用 Composer 之前）
- [ ] `ExecutorPrivateKey` 验证为必填
- [ ] `triggerAutoInvestPureComposer` 正确传递后端钱包地址
- [ ] 前端不再依赖 `getRules` 合约调用

---

## 未来待办（不在本计划范围内）

| 项目 | 说明 |
|---|---|
| 多链发薪 | 当前只支持 Base，扩展 `fromChain`/`toChain` 参数 |
| Safe/钱包委托 | 生产环境应使用 Gnosis Safe 替代后端钱包 |
| USDC→USDT 变更 | 之前讨论过，暂缓 |
| PayrollVault 合约 | 如果 Employer 不信任后端钱包，可改用合约托管 |

---

**计划完成。**
