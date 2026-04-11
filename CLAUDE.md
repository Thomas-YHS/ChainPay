# ChainPay — AI 开发上下文

> 每次对话开始前请先读完本文件

---

## 项目一句话

**ChainPay** 是一个 Web3 跨链薪资路由工具：雇主单链发 USDC，Li.Fi 自动路由到员工指定的多链多 Token 组合。规则存链上合约，定时发薪由 Go 后端触发。

---

## 开发者信息（给 AI 的重要提示）

- **语言背景**：Java 开发者，Go 初学者，无 Solidity 经验
- **开发方式**：Vibe Coding，AI 辅助开发
- **节奏**：单人，约 1 周完成黑客松 MVP
- **当前状态**：前端 ✅、合约 ✅（26测试全绿，审计通过，rescueTokens已加）、后端 ✅（Gin+GORM+Cron，17项审计问题已修复），待部署

### AI 辅助原则
- 代码示例优先用**完整可运行**的片段，不要省略 import
- Go 代码注意：用 `if err != nil` 处理错误，没有 try/catch
- Solidity 代码优先使用 OpenZeppelin 现成库，不要手写安全逻辑
- 遇到新概念先给**类比**（如"这相当于 Java 的 X"），再给代码
- 每次改动说明**为什么**，不只是说"改成这样"

### Git 提交规范
- **提交消息使用中文**，便于项目历史追溯和团队阅读
- 格式：`type(scope): 描述`，type 使用英文（如 feat、fix、docs、refactor）

---

## 技术栈

| 层级 | 技术 | 备注 |
|---|---|---|
| 前端 | React 19 (Vite 8) + Tailwind v4 + wagmi v2 + RainbowKit | 钱包连接、路由预览 |
| 链上路由 | Li.Fi SDK `@lifi/sdk` v3 | 核心执行引擎，前端调用 |
| 智能合约 | Solidity 0.8.20 + **Hardhat** + OpenZeppelin v5 | 部署在 Base Mainnet |
| 后端 | Go + Gin + GORM + robfig/cron + go-ethereum | 档案管理、定时发薪 |
| 数据库 | PostgreSQL | 链下数据 |
| 部署 | Railway | Go 后端 + DB |

---

## 项目结构

```
ChainPay/
├── CLAUDE.md              ← 本文件，每次必读
├── frontend/              ← React (Vite)
│   └── src/
│       ├── features/      ← employer/ + employee/ + shared/
│       ├── pages/         ← LandingPage.tsx
│       ├── store.ts       ← Zustand 全局状态
│       └── theme.ts       ← 颜色/主题集中定义
├── backend/               ← Go + Gin
│   ├── main.go
│   ├── config/            ← 环境变量加载
│   ├── db/                ← GORM 连接 + 迁移
│   ├── handlers/          ← employee.go, payroll.go
│   ├── services/          ← employee.go, payroll.go, cron.go
│   ├── models/            ← GORM 模型
│   ├── middleware/        ← 认证中间件
│   └── router/            ← 路由注册
├── contracts/             ← Solidity + Hardhat
│   ├── contracts/ChainPay.sol
│   ├── scripts/deploy.js
│   ├── test/
│   └── hardhat.config.js
└── docs/
    ├── audit/                         ← 版本化审计报告
    │   ├── ChainPay_Audit_Summary.md  ← 汇总入口（必读）
    │   └── v0.1-baseline.md
    ├── decisions/                      ← ADR 决策记录
    ├── product/                       ← 产品文档（版本化）
    │   ├── ChainPay_Product_Summary.md ← 汇总入口（必读）
    │   └── v1.0-*.md
    ├── standups/                      ← 每日站会记录
    ├── superpowers/                   ← 规划与设计
    │   ├── specs/                    ← UI 设计规范
    │   └── plans/                    ← 实现计划
    └── technical/                     ← 技术文档（版本化）
        ├── ChainPay_*_Summary.md       ← 各模块汇总入口（必读）
        ├── v1.0-*.md                  ← 各版本完整内容
        └── ChainPay_*.md              ← 重定向 stub（勿直接编辑）
```

**文档版本化规范**：所有技术/产品文档均按版本迭代，旧内容归档到 `vX.Y-*.md`，通过 Summary 汇总文件统一入口。更新文档时新建版本文件，不要直接覆盖。

---

## 核心业务流程

```
雇主 → 添加员工档案（Go API → PostgreSQL）
     → Approve USDC 给 ChainPay 合约

员工 → 连接钱包 → 验证身份（Go API）
     → 设置接收规则 → 写入链上合约（setRules，只能一次）

发薪触发（手动 或 Go Cron 定时）— Pure Composer 模式
     → 后端钱包 approve USDC 给 LiFi Diamond（等待上链）
     → 后端调用 GET https://li.quest/v1/quote（fromAddress = 后端钱包）
     → 后端签名并广播 transactionRequest
     → LiFi 从后端钱包拉取 USDC → 路由到员工多链钱包
     ⚠️ 不再调用 ChainPay 合约（合约仅用于员工 setRules）
```

### 数据存储边界
| 数据 | 存储位置 |
|---|---|
| 员工姓名、昵称、合约金额、发薪频率 | PostgreSQL |
| 发薪记录、tx hash、状态 | PostgreSQL |
| 员工接收规则（链、Token、比例）| 链上合约 |

---

## 关键合约信息

| 项目 | 值 |
|---|---|
| 部署链 | Base Mainnet（Chain ID: 8453）|
| USDC（Base）| `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Li.Fi Diamond（Base）| `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` |
| ChainPay 合约地址 | **待部署后填入** |
| 比例精度 | 10000 为基数（40% = 4000）|
| 每员工最多规则数 | 5 条 |

### 合约核心函数
```solidity
registerEmployee(address employee)          // 雇主注册员工
setRules(Rule[] rules)                      // 员工设置规则（仅一次，总比例必须 = 10000）
executePayout(employer, employee,           // 执行者触发发薪
    totalAmount, bytes[] lifiCallData)
getRules(address employee)                  // 查询规则
updateExecutor(address newExecutor)         // Owner 更换执行者
```

---

## 执行者钱包安全规则（必须遵守）

```
❌ 绝对不能 hardcode 私钥
❌ 绝对不能把 config.yaml 提交到 Git
✅ 敏感信息（私钥、数据库密码）只存 config.yaml，config.yaml 已加入 .gitignore
✅ 执行者钱包需持有 USDC（发薪资金来源）+ 少量 ETH（Gas 费）
✅ 每条规则 approve 精确金额，approve 后立即执行，不留多余 allowance
⚠️ 后端钱包是单点故障，生产环境须迁移 Gnosis Safe
```

---

## 快速启动

### 前端
```bash
cd frontend && npm run dev        # http://localhost:5173
cd frontend && npx tsc --noEmit   # 类型检查
cd frontend && npm run build      # 构建检查
```

### 合约
```bash
cd contracts && npx hardhat test                                      # 跑测试
cd contracts && npx hardhat run scripts/deploy.js --network base      # 部署到 Base
cd contracts && npx hardhat run scripts/deploy.js --network gnosis    # 部署到 Gnosis（Gas 更低）
```

### 后端
```bash
cd backend && go run main.go      # 启动服务 :8080（需先有 PostgreSQL）
cd backend && go build ./...      # 编译检查
cd backend && go test ./...       # 跑测试
```

---

## 环境变量

### `frontend/.env.local`
```
VITE_API_URL=http://localhost:8080/api/v1
VITE_CHAIN_PAY_CONTRACT=          # 合约部署后填入，留空则合约调用失败
```

### `contracts/.env`
```
DEPLOYER_PRIVATE_KEY=0x...        # 部署者私钥
EXECUTOR_ADDRESS=0x...            # 执行者钱包地址（Go 后端）
BASESCAN_API_KEY=...              # 合约验证用（可选）
```

### 后端配置（`backend/config.yaml`，基于 `config.yaml.example`）
```yaml
server:
  port: "8080"
database:
  host: "localhost"
  port: "5432"
  user: "chainpay"
  password: ""       # 必须填写，无默认值
  name: "chainpay_db"
  sslmode: "disable"
blockchain:
  chain_pay_contract: ""     # 合约部署后填入
  executor_private_key: ""   # 必填！不填则后端启动报错（Pure Composer 必须）
  chain_pay_contract: ""     # 可选，不填则发薪回退为 100% USDC 直转
  lifi_api_key: ""           # Li.Fi API Key（必填，否则 BuildComposerQuote 报错）
  eth_rpc_url: "https://mainnet.base.org"
```
环境变量 `CONFIG_PATH` 可覆盖默认路径（默认 `config.yaml`）。

### Tailwind v4 注意
无 `tailwind.config.js`，通过 `@tailwindcss/vite` 插件自动处理，颜色/主题在 `src/theme.ts` 集中定义。

---

## Li.Fi 使用注意

```
⚠️  Li.Fi 不支持测试网
✅  使用 Base 或 Gnosis Chain 主网测试（Gas 极低）
✅  按比例拆分 = 每条规则调用一次 GET /v1/quote，分别广播
✅  lifiCallData 由后端生成并直接签名广播（前端不再参与发薪执行）
✅  GET li.quest/v1/quote 需传 fromAddress（后端钱包）、toAddress（员工）
```

---

## 当前进度

| 模块 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ 完成 | 落地页 + 雇主端 + 员工端 + Li.Fi 路由 + Zustand |
| 合约 | ✅ 代码完成 | ChainPay.sol 277 行，待部署到 Base |
| 后端 | ✅ 完成 | Pure Composer 发薪，config.yaml 已配置 |
| 联调 | 🔄 进行中 | 端到端测试：充值后端钱包 → curl 发薪 → Basescan 验证 |

---

## 文档索引

| 需要了解什么 | 看哪里 |
|---|---|
| **所有文档起点** | `docs/` — 每个子目录均有 `Summary` 汇总入口 |
| 产品定位和差异化 | `docs/product/ChainPay_Product_Summary.md` |
| 黑客松功能范围 | `docs/product/ChainPay_Product_Summary.md` |
| 合约函数和安全设计 | `docs/technical/ChainPay_Contract_Summary.md` |
| 后端 API 接口 | `docs/technical/ChainPay_API_Summary.md` |
| 数据库表结构 | `docs/technical/ChainPay_DB_Summary.md` |
| 系统架构图 | `docs/technical/ChainPay_Architecture_Summary.md` |
| 代码审计（最新）| `docs/technical/audit/ChainPay_Audit_Summary.md` |
| 为什么选 Hardhat | `docs/decisions/ADR-001-Hardhat-vs-Foundry.md` |
| 每日站会记录 | `docs/standups/` |

**文档更新规范**：新建 `vX.Y-*.md` 版本文件，不要直接覆盖旧文档。
