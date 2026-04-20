# ChainPay — AI 开发上下文

> 每次对话开始前请先读完本文件

---

## 项目一句话

**ChainPay** 是一个 Web3 跨链薪资路由工具：雇主单链发 USDC，Li.Fi 自动路由到员工指定的多链多 Token 组合。规则可存链上合约或后端数据库，定时发薪由 Go 后端触发。

---

## 开发者信息（给 AI 的重要提示）

- **语言背景**：Java 开发者，Go 初学者，无 Solidity 经验
- **开发方式**：Vibe Coding，AI 辅助开发
- **节奏**：单人，约 1 周完成黑客松 MVP
- **当前状态**：前端 ✅、合约 ✅（26测试全绿，审计通过）、后端 ✅（Pure Composer 发薪 + 双模式规则存储）、待端到端联调部署

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
| 前端 | React 19 (Vite 6) + Tailwind v4 + wagmi v2 + RainbowKit | 钱包连接、路由预览 |
| 链上路由 | Li.Fi Composer API（`li.quest/v1/quote`）| 核心执行引擎，后端调用 |
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
│       ├── features/
│       │   ├── employer/  ← 雇主端（员工管理、发薪、历史）
│       │   ├── employee/  ← 员工端（规则设置、Earn Dashboard）
│       │   └── shared/    ← 公共组件和 hooks
│       ├── pages/         ← LandingPage.tsx
│       ├── store.ts       ← Zustand 全局状态
│       └── theme.ts       ← 颜色/主题/常量集中定义（含链、Token、LiFi 地址）
├── backend/               ← Go + Gin
│   ├── main.go
│   ├── config/            ← config.go（YAML 加载）
│   ├── db/                ← GORM 连接 + 迁移
│   ├── handlers/          ← employee.go, payroll.go, rules_provider.go
│   ├── services/          ← employee.go, payroll.go, cron.go, rules_provider.go
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
    │   ├── specs/                    ← 设计规范（含 Earn Dashboard）
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

员工 → 连接钱包 → 验证身份（Go API）
     → 设置接收规则（链、Token、比例）
       - chain 模式：写入链上合约（setRules，仅一次）
       - backend 模式：存储到 PostgreSQL（可修改）

发薪触发（手动 或 Go Cron 定时）— Pure Composer 模式
     → 后端钱包 approve USDC 给 LiFi Diamond（等待上链）
     → 后端调用 GET https://li.quest/v1/quote（fromAddress = 后端钱包）
     → 后端签名并广播 transactionRequest
     → LiFi 从后端钱包拉取 USDC → 路由到员工多链钱包
     ⚠️ 不调用 ChainPay 合约执行发薪（合约仅用于 chain 模式的 setRules）
```

### 规则存储双模式（rules_mode）

| 模式 | 配置值 | 规则存储位置 | 特点 |
|---|---|---|---|
| backend 模式 | `rules_mode: "backend"` | PostgreSQL | 可修改，无 Gas，默认 |
| chain 模式 | `rules_mode: "chain"` | 链上合约 | 不可修改，需 Gas，去中心化 |

后端通过 `RulesProvider` 接口屏蔽两种模式差异，发薪逻辑无需关心规则来源。

### 数据存储边界

| 数据 | 存储位置 |
|---|---|
| 员工姓名、昵称、合约金额、发薪频率 | PostgreSQL |
| 发薪记录、tx hash、状态 | PostgreSQL |
| 员工接收规则（backend 模式）| PostgreSQL |
| 员工接收规则（chain 模式）| 链上合约 |

---

## 关键合约 & 地址

| 项目 | 值 |
|---|---|
| 部署链 | Base Mainnet（Chain ID: 8453）|
| USDC（Base）| `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Li.Fi Diamond（Base）| `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` |
| ChainPay 合约地址 | **待部署后填入** |
| 比例精度 | 10000 为基数（40% = 4000）|
| 每员工最多规则数 | 5 条 |

### 合约核心函数（chain 模式使用）
```solidity
registerEmployee(address employee)     // 雇主注册员工
setRules(Rule[] rules)                 // 员工设置规则（仅一次，总比例必须 = 10000）
getRules(address employee)             // 查询规则
updateExecutor(address newExecutor)    // Owner 更换执行者
```

---

## 执行者钱包安全规则（必须遵守）

```
❌ 绝对不能 hardcode 私钥
❌ 绝对不能把 config.yaml 提交到 Git
✅ 敏感信息（私钥、数据库密码）只存 config.yaml，config.yaml 已加入 .gitignore
✅ 执行者钱包需持有 USDC（发薪资金来源）+ 少量 ETH（Gas 费）
✅ approve 精确金额，approve 后立即执行，不留多余 allowance
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
VITE_CHAIN_PAY_CONTRACT=          # 合约部署后填入，留空则合约调用失败（chain 模式）
VITE_LIFI_API_KEY=                # Li.Fi API Key，Earn Dashboard 使用（暂隐藏入口）
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
  chain_pay_contract: ""     # 合约部署后填入（chain 模式必须）
  executor_private_key: ""   # 执行者私钥（Pure Composer 发薪必须）
  lifi_api_key: ""           # Li.Fi API Key（BuildComposerQuote 必须）
  eth_rpc_url: "https://mainnet.base.org"
  cron_enabled: false        # 启用定时发薪
  rules_mode: "backend"      # "backend"（默认）或 "chain"
```
环境变量 `CONFIG_PATH` 可覆盖默认路径（默认 `config.yaml`）。

### Tailwind v4 注意
无 `tailwind.config.js`，通过 `@tailwindcss/vite` 插件自动处理，颜色/主题/地址常量在 `src/theme.ts` 集中定义。

---

## Li.Fi 使用注意

```
⚠️  Li.Fi 不支持测试网
✅  使用 Base 或 Gnosis Chain 主网测试（Gas 极低）
✅  发薪：每条规则调用一次 GET li.quest/v1/quote，分别广播
✅  发薪 quote 需传 fromAddress（后端钱包）、toAddress（员工）
✅  Earn：GET earn.li.fi/v1/earn/vaults 发现 vault，需 x-lifi-api-key 请求头
✅  Earn 存入：fromToken=USDC, toToken=vault地址，fromAddress=员工钱包
```

---

## 当前进度

| 模块 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ 完成 | 落地页 + 雇主端 + 员工端 + Earn Dashboard（入口已开放）|
| 合约 | ✅ 代码完成 | ChainPay.sol，待部署到 Base |
| 后端 | ✅ 完成 | Pure Composer 发薪 + 双模式规则存储（RulesProvider）|
| 联调 | ✅ 基本跑通 | 前后端流程可端到端执行，Earn 存入流程跑通 |

### 已知问题（审计发现，黑客松后修复）

| 位置 | 问题 | 严重度 |
|---|---|---|
| `services/payroll.go:74` | `big.Int.SetString` 忽略解析失败，金额可能算错 | 严重 |
| `services/cron.go:74` | `next_pay_date` 更新失败后继续运行，有重复发薪风险 | 严重 |
| `services/payroll.go:101` | `AwaitReceipt` 未实现，PayrollLog 永远 pending | 严重 |
| `handlers/payroll.go:82` | `ParseUint` 忽略错误，ID 无效时查询 id=0 | 严重 |
| `handlers/employee.go:318` | `HexToAddress` 不验证格式，无效地址变零地址 | 严重 |
| `handlers/employee.go:235` | `fmt.Sscanf` 忽略返回值，无效百分比静默置为 0 | 中等 |
| 前端 4 处 | `catch (e: any)` 应改为 `e instanceof Error` | 轻微 |

### 开发中 / 暂缓功能

| 功能 | 状态 | 说明 |
|---|---|---|
| Earn Dashboard | ✅ 已上线 | 员工存 USDC 到 Li.Fi Earn vault，支持 Base/Arbitrum/Gnosis/Optimism |
| Earn API Key 安全化 | ⏳ 待做 | 当前 API Key 在前端 env，需迁移到后端代理 |
| 员工持仓查看 | ⏳ 待做 | Earn portfolio endpoint |
| Earn 提款流程 | ⏳ 待做 | withdraw |

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
| 代码审计（最新）| `docs/audit/ChainPay_Audit_Summary.md` |
| 为什么选 Hardhat | `docs/decisions/ADR-001-Hardhat-vs-Foundry.md` |
| Earn Dashboard 设计 | `docs/superpowers/specs/2026-04-14-earn-dashboard-design.md` |
| 每日站会记录 | `docs/standups/` |

**文档更新规范**：新建 `vX.Y-*.md` 版本文件，不要直接覆盖旧文档。
