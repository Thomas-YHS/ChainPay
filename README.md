# ChainPay

> Web3 跨链薪资路由协议 — 雇主单链发 USDC，员工多链多 Token 收款

## 产品简介

ChainPay 解决了 Web3 团队的发薪痛点：员工分散在不同链上，偏好不同的 Token，雇主却只能从单一链手动转账。

**核心流程：**
1. 雇主添加员工档案（姓名、钱包、薪资、发薪频率）
2. 员工设置接收规则（指定链、Token 和比例，总计 100%）
3. 雇主一键发薪 → Li.Fi 自动路由，USDC 精准到达员工的每条链

**例子：** 员工设置 50% USDC 到 Base、30% ETH 到 Arbitrum、20% USDC 到 Gnosis，雇主只需发一笔 USDC，ChainPay 自动完成拆分路由。

## 功能

- **雇主端**：员工档案管理、一键发薪（手动 + 定时 Cron）、发薪历史
- **员工端**：多链多 Token 接收规则设置（支持链上合约或后端双模式）
- **Earn Dashboard**：员工可将 USDC 存入 Li.Fi Earn vault 赚取链上利息
- **跨链路由**：由 Li.Fi Pure Composer 驱动，支持 Base、Arbitrum、Gnosis、Optimism

## 技术架构

```
前端 (React + wagmi)
  ├── 雇主端：员工管理、发薪操作
  └── 员工端：规则配置、Earn Dashboard

后端 (Go + Gin)
  ├── 员工档案 API
  ├── 发薪执行（Pure Composer：approve → quote → broadcast）
  ├── Cron 定时发薪
  └── RulesProvider（chain / backend 双模式）

链上 (Solidity + Base Mainnet)
  └── ChainPay.sol：员工注册、规则存储（chain 模式）

Li.Fi
  ├── Composer API (li.quest)：跨链路由报价 + 执行
  └── Earn API (earn.li.fi)：yield vault 发现
```

## 快速开始

### 环境要求

- Node.js 20+
- Go 1.21+
- PostgreSQL 15+

### 前端

```bash
cd frontend
cp .env.example .env.local   # 填入 VITE_API_URL 等变量
npm install
npm run dev                   # http://localhost:5173
```

### 后端

```bash
cd backend
cp config.yaml.example config.yaml   # 填入数据库密码、私钥等
go run main.go                        # http://localhost:8080
```

### 合约

```bash
cd contracts
cp .env.example .env   # 填入部署私钥
npm install
npx hardhat test                                    # 运行测试（26个）
npx hardhat run scripts/deploy.js --network base    # 部署到 Base Mainnet
```

## 环境变量

### `frontend/.env.local`

```
VITE_API_URL=http://localhost:8080/api/v1
VITE_WALLETCONNECT_PROJECT_ID=<your_project_id>
VITE_CHAIN_PAY_CONTRACT=<deployed_contract_address>
VITE_LIFI_API_KEY=<lifi_api_key>              # Earn Dashboard 使用
```

### `backend/config.yaml`

```yaml
server:
  port: "8080"
database:
  host: "localhost"
  port: "5432"
  user: "chainpay"
  password: "<required>"
  name: "chainpay_db"
  sslmode: "disable"
blockchain:
  chain_pay_contract: "<deployed_contract_address>"
  executor_private_key: "<executor_wallet_private_key>"
  lifi_api_key: "<lifi_api_key>"
  eth_rpc_url: "https://mainnet.base.org"
  cron_enabled: false
  rules_mode: "backend"    # "backend" 或 "chain"
```

## 关键地址（Base Mainnet）

| 合约 | 地址 |
|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Li.Fi Diamond | `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` |
| ChainPay | 待部署 |

## 项目结构

```
ChainPay/
├── frontend/          # React 19 + Vite + wagmi v2 + RainbowKit
├── backend/           # Go + Gin + GORM + go-ethereum
├── contracts/         # Solidity 0.8.20 + Hardhat + OpenZeppelin v5
└── docs/              # 产品、技术、审计文档
```

## 安全说明

- 执行者私钥存于 `config.yaml`（已加入 `.gitignore`，勿提交）
- 每次发薪 approve 精确金额，执行后不留多余 allowance
- 后端钱包为单点，生产环境建议迁移至 Gnosis Safe

## 开发文档

| 文档 | 路径 |
|---|---|
| 产品概述 | `docs/product/ChainPay_Product_Summary.md` |
| API 接口 | `docs/technical/ChainPay_API_Summary.md` |
| 合约设计 | `docs/technical/ChainPay_Contract_Summary.md` |
| 数据库设计 | `docs/technical/ChainPay_DB_Summary.md` |
| 系统架构 | `docs/technical/ChainPay_Architecture_Summary.md` |
| 审计报告 | `docs/technical/audit/ChainPay_Audit_Summary.md` |

## License

MIT
