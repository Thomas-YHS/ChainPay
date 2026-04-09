# ChainPay 代码审计总览

> 当前版本：v0.4（LiFi Earn 集成）
> 总览更新：2026-04-09

---

## 风险评级总表

| 层级 | 风险 | 详情 | 状态 |
|---|---|---|---|
| 智能合约 ChainPay.sol | 🟢 Low | 26/26 测试全绿 | 可部署 |
| Go 后端 Handler 层 | 🟢 Low | 鉴权/校验已全部修复 | 可部署 |
| Go 后端 Service 层 | 🟢 Low | EarnService + 所有 Review 问题已修复 | 可部署 |
| Go 后端 Config/DB 层 | 🟢 Low | YAML 配置 + decimal + cron_enabled + earn_enabled 开关 | 可部署 |
| Go 后端 Cron | 🟢 Low | 全局 + 员工级双重开关 | 可部署 |
| LiFi Earn 集成 | 🟡 Medium | Code Review 发现 5 个问题，已全部修复 | 可部署 |

---

## v0.4 Code Review（LiFi Earn 集成）

### 🔴 Critical — 已全部修复

| ID | 问题 | 位置 | 影响 | 修复 |
|---|---|---|---|---|
| **E-C1** | `GetAutoInvest` 错误使用 `Shift(-6)`，员工重新打开配置时数值损坏 | `services/employee.go:159` | 百分比显示为 0.001% 等错误值 | 移除 Shift(-6)，直接返回存储值 |
| **E-C2** | `ExecuteDeposit` ethClient 调用无 context 超时，RPC 无响应时 goroutine 泄漏 | `services/earn.go:217-236` | 后台 goroutine 挂起 | 添加 60s `context.WithTimeout` |

### 🟡 Important — 已全部修复

| ID | 问题 | 位置 | 影响 | 修复 |
|---|---|---|---|---|
| **E-I1** | TypeScript `Vault` 接口字段名为 snake_case，与 Go camelCase API 响应不匹配 | `store.ts:22-31` | `chain_id`、`tvl_usd` 等字段运行时为 undefined | 改为 `chainId`、`tvlUsd` 等 camelCase |
| **E-I2** | `triggerAutoInvest` 未检查 `HasRules`，未配置规则的员工也会触发 deposit | `services/payroll.go:313-345` | deposit 交易可能失败或路由错误 | 添加 `if !emp.HasRules` 检查 |
| **E-I3** | `UpdateAutoInvest` 缺少输入校验，可传入超出范围的值 | `handlers/employee.go:224-231` | 传入 50000（500%）可被存储和执行 | 添加 percentage(0-10000)和 fixed(正数)校验 |

### ⚪ Minor — 已知，暂未修复

| ID | 问题 | 位置 | 影响 |
|---|---|---|---|
| **E-m1** | `parseAPY` 解析失败时静默返回 0，可能选错 vault | `services/earn.go:101-110` | APY 格式异常时排序错误 |
| **E-m2** | `triggerAutoInvest` 失败时无重试、无记录 | `services/payroll.go:313-345` | 失败静默，仅打印日志 |
| **E-m3** | `AutoInvestModal` 中 `getVaults()` 无 error handling | `AutoInvestModal.tsx:37-40` | API 失败时用户看到"暂无可用"而非错误提示 |
| **E-m4** | 场景1（雇主闲置资金自动理财）未实现 | 计划 vs 代码 | 黑客松优先实现员工定投，雇主端降级 |
| **E-m5** | `EmployerDashboard` 未展示 Yield 收益 UI | 计划 vs 代码 | 黑客松优先实现员工端 UI |

---

## 待修复问题

### 🔴 必须修复（部署前）

| ID | 问题 | 位置 | 影响 |
|---|---|---|---|
| **3.7** | Li.Fi calldata 为空时静默跳过，导致 `executePayout` revert | `services/payroll.go:167-169` | 发薪交易失败 |

```go
// 当前：静默跳过
if len(lifiResp.Steps) == 0 {
    continue  // ❌ 不报错，导致 calldata 数量不匹配
}

// 应改为：
if len(lifiResp.Steps) == 0 {
    return nil, fmt.Errorf("Li.Fi returned no steps for rule: chain=%d, token=%s", rule.ChainID, rule.TokenAddress)
}
```

### 🟡 建议修复（部署后）

| ID | 问题 | 位置 | 修复方案 |
|---|---|---|---|
| **M-5** | `next_pay_date` 失败后不回退 | `services/payroll.go` `awaitReceipt` | 结束时若 status=failed，回写 `next_pay_date` |
| **2.3** | `ListLogs` 无细粒度过滤 | `handlers/payroll.go` | 生产加 EIP-191 签名验证 |
| **5.2** | 多实例重复发薪 | `services/cron.go` | Redis 分布式锁 |
| **E-m1** | `parseAPY` 静默返回 0 | `services/earn.go:101-110` | 解析失败时返回错误 |
| **E-m2** | auto-invest 失败无重试 | `services/payroll.go` | 记录到数据库或发送告警 |

---

## 已知架构级限制（黑客松范围内不可改变）

| 限制 | 说明 | 生产方案 |
|---|---|---|
| 钱包认证无签名 | `X-Wallet-Address` 仅格式校验 | EIP-191 Sign-In With Ethereum |
| Cron 无分布式锁 | 单实例才安全 | Redis 分布式锁 |
| Li.Fi API Key 明文 | 存 `config.yaml` | Vault / Doppler |
| GORM AutoMigrate | 开发阶段够用 | sql-migrate / flyway |
| 执行者私钥明文配置 | 必须在 config.yaml | 硬件钱包 / MPC |

---

## 修复历史

| 版本 | 日期 | 变更 |
|---|---|---|
| **v0.1** | 2026-04-07 | 初始审计：24 个问题，发现即修复 17 个 |
| **v0.2** | 2026-04-08 | Config 层 YAML 重构；审计文档版本化；剩余 7 项为架构限制 |
| **v0.3** | 2026-04-08 | 全局 cron_enabled + 员工级 CronEnabled 双重开关 |
| **v0.4** | 2026-04-09 | LiFi Earn 集成；Code Review 5 个问题全部修复（Critical 2 + Important 3）；Minor 5 已知待后续处理 |

---

## 各模块详细报告

| 文件 | 覆盖内容 |
|---|---|
| [v0.1-baseline.md](./v0.1-baseline.md) | 初始审计完整报告（含所有问题详情和代码示例） |

---

## 部署前必检清单

| 检查项 | 状态 |
|---|---|
| PostgreSQL 已创建（Railway 或本地）| ❌ |
| `backend/config.yaml` 中 `database.password` 已填写 | ❌ |
| `database.sslmode: require`（如用 Railway）| ❌ |
| `blockchain.executor_private_key` 已填写 | ❌ |
| `blockchain.chain_pay_contract` 已填写（合约部署后）| ❌ |
| `blockchain.lifi_api_key` 已填写 | ❌ |
| `blockchain.earn_enabled: true`（如需开启自动定投理财）| ❌ |
| 合约已部署到 Base Mainnet | ❌ |
| 前端 `VITE_CHAIN_PAY_CONTRACT` 已填 | ❌ |
| **v0.3 问题 3.7 已修复**（Li.Fi calldata 空跳过）| ❌ |
| `blockchain.cron_enabled: true`（如需开启定时发薪）| ❌ |

---

*生产部署前建议加做：foundry forge 模糊测试 + Certora 形式化验证合约*
