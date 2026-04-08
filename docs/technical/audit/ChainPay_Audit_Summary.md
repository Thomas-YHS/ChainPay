# ChainPay 代码审计总览

> 当前版本：v0.2（config-yaml-refactor）
> 总览更新：2026-04-08

---

## 风险评级总表

| 层级 | 风险 | 详情 | 状态 |
|---|---|---|---|
| 智能合约 ChainPay.sol | 🟢 Low | 26/26 测试全绿 | 可部署 |
| Go 后端 Handler 层 | 🟢 Low | 鉴权/校验已全部修复 | 可部署 |
| Go 后端 Service 层 | 🟡 Medium-Low | 1 项待修复 | 部分就绪 |
| Go 后端 Config/DB 层 | 🟢 Low | YAML 配置 + decimal + cron_enabled 开关 | 可部署 |
| Go 后端 Cron | 🟢 Low | 全局 + 员工级双重开关 | 可部署 |

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
| 合约已部署到 Base Mainnet | ❌ |
| 前端 `VITE_CHAIN_PAY_CONTRACT` 已填 | ❌ |
| **v0.3 问题 3.7 已修复**（Li.Fi calldata 空跳过）| ❌ |
| `blockchain.cron_enabled: true`（如需开启定时发薪）| ❌ |

---

*生产部署前建议加做：foundry forge 模糊测试 + Certora 形式化验证合约*
