# Earn Dashboard 设计文档

**日期：** 2026-04-14  
**状态：** 已批准，待实现  
**方案：** A（纯前端） — 后续升级路径见技术债章节  
**UI 实现：** 使用 `frontend-design:frontend-design` skill 生成生产级界面

---

## 背景

ChainPay 员工端目前支持设置多链多 Token 接收规则，但没有收益管理入口。Li.Fi Earn API 提供 vault 发现（`earn.li.fi`）和 Composer 存入（`li.quest`）能力，可在不改变现有发薪流程的前提下，为员工增加主动存入收益 vault 的功能。

---

## 目标

在员工页面新增"Earn 收益"入口，员工进入 Dashboard 后可以：

1. 查看与自身规则链相关的 USDC yield vault 列表（APY、TVL、协议）
2. 选择某个 vault，输入金额，直接用自己的钱包存入

---

## 架构

```
EmployeePage
  └── [Earn 收益 按钮] → 跳转 /employee/earn

EarnDashboard（新页面）
  ├── 读取员工规则 → 提取所有 chainId
  ├── 并发调 earn.li.fi/v1/earn/vaults（每个 chainId 一次）
  │     参数：chainId, asset=USDC, sortBy=apy, isTransactional=true
  ├── 展示 VaultCard 列表
  └── 点击 vault → 展开存入流程
        ① useEnsureAllowance（approve USDC 给 Li.Fi Diamond）
        ② GET li.quest/v1/quote（fromToken=USDC, toToken=vault地址）
        ③ wagmi sendTransactionAsync（完整透传 transactionRequest）
        ④ 展示 tx hash
```

**新增文件：**
- `frontend/src/features/employee/pages/EarnDashboard.tsx`
- `frontend/src/features/shared/hooks/useEnsureAllowance.ts`

**改动文件：**
- `frontend/src/features/employee/pages/EmployeePage.tsx`（加入口按钮）
- 路由文件（注册 `/employee/earn`）

---

## 数据流

### Vault 列表加载

1. 员工进入 Dashboard，读取其规则中所有唯一 `chainId`
2. 并发请求 `earn.li.fi/v1/earn/vaults?chainId=<id>&asset=USDC&sortBy=apy`
   - Header：`x-lifi-api-key: <VITE_LIFI_API_KEY>`
3. 合并结果，过滤 `isTransactional: true` 的 vault
4. 按 APY 降序展示

### VaultCard 展示字段

| 字段 | 来源 |
|------|------|
| 协议名 | `vault.protocol` |
| vault 名称 | `vault.name` |
| APY | `vault.apy`（统一转为百分比显示） |
| TVL | `vault.tvlUsd`（格式化为 `$XXM`）|
| 链 | `vault.chainId`（映射为链名）|

### 存入流程

```
用户输入 USDC 金额（UI 单位：美元）
  ↓
转换：amount_raw = Math.floor(amount * 1e6)   // USDC 精度 6 位
  ↓
useEnsureAllowance(Li.Fi Diamond 地址, amount_raw)
  检查 allowance → 不足则 approve + waitForReceipt
  ↓
GET li.quest/v1/quote
  fromChain / toChain = vault.chainId
  fromToken = USDC 地址（对应链）
  toToken   = vault.address（vault 合约地址）
  fromAmount = amount_raw
  fromAddress = toAddress = 员工钱包地址
  ↓
sendTransactionAsync（完整透传 transactionRequest）
  ↓
展示 tx hash + Basescan 链接
```

---

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| vault 列表加载失败 | 展示错误提示 + 重试按钮 |
| vault `isTransactional: false` | 灰显，提示"暂不支持直接存入" |
| quote 请求失败 | 提示错误信息，回到输入状态 |
| 用户拒绝签名 | 捕获错误，回到输入状态，不展示错误 |
| approve 失败 | 展示错误信息，停止流程 |

---

## 环境变量

```
VITE_LIFI_API_KEY=<your_key>   # 用于 earn.li.fi 请求的认证
```

---

## 技术债 ⚠️

**当前方案（A）将 `x-lifi-api-key` 暴露在前端环境变量中，存在安全风险。**

升级路径（方案 B）：
1. 后端新增 `GET /api/v1/vaults?chain_ids=8453,100` 接口
2. 后端代理 `earn.li.fi` 请求，API key 存于 `config.yaml`
3. 前端改为调后端接口，移除 `VITE_LIFI_API_KEY`
4. Composer quote（`li.quest`）保持在前端（需要用户钱包地址，无需 key）

优先级：黑客松后、生产部署前完成升级。

---

## 不在范围内

- 员工持仓查看（portfolio endpoint）— 后续迭代
- withdraw 流程 — 后续迭代
- 自动定投（发薪时直接路由到 vault）— 后续迭代
