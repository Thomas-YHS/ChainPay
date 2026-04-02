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
- **当前状态**：文档阶段完成，准备开始写代码

### AI 辅助原则
- 代码示例优先用**完整可运行**的片段，不要省略 import
- Go 代码注意：用 `if err != nil` 处理错误，没有 try/catch
- Solidity 代码优先使用 OpenZeppelin 现成库，不要手写安全逻辑
- 遇到新概念先给**类比**（如"这相当于 Java 的 X"），再给代码
- 每次改动说明**为什么**，不只是说"改成这样"

---

## 技术栈

| 层级 | 技术 | 备注 |
|---|---|---|
| 前端 | React (Vite) + Tailwind + wagmi + RainbowKit | 钱包连接、路由预览 |
| 链上路由 | Li.Fi SDK `@lifi/sdk` | 核心执行引擎，前端调用 |
| 智能合约 | Solidity + **Hardhat** + OpenZeppelin | 部署在 Base Mainnet |
| 后端 | Go + Gin + GORM + robfig/cron | 档案管理、定时发薪 |
| 数据库 | PostgreSQL | 链下数据 |
| 部署 | Railway | Go 后端 + DB |

---

## 项目结构

```
SalaryLiFiProject/
├── CLAUDE.md              ← 本文件，每次必读
├── frontend/              ← React (Vite)
├── backend/               ← Go + Gin
├── contracts/             ← Solidity + Hardhat
└── docs/
    ├── product/
    │   ├── ChainPay_产品概述.md
    │   └── ChainPay_MVP.md
    ├── technical/
    │   ├── ChainPay_Contract.md
    │   ├── ChainPay_API.md
    │   ├── ChainPay_DB.md
    │   └── ChainPay_Architecture.md
    └── decisions/
        └── ADR-001-Hardhat-vs-Foundry.md
```

---

## 核心业务流程

### 完整链路
```
雇主 → 添加员工档案（Go API → PostgreSQL）
     → Approve USDC 给 ChainPay 合约

员工 → 连接钱包 → 验证身份（Go API）
     → 设置接收规则 → 写入链上合约

发薪触发（手动 或 Go Cron 定时）
     → 前端生成 Li.Fi calldata
     → 执行者钱包调用 ChainPay 合约
     → 合约从雇主钱包拉取 USDC
     → 合约调用 Li.Fi 合约
     → Li.Fi 路由到员工多链钱包
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
| ChainPay 合约地址 | 待部署后填入 |
| 比例精度 | 10000 为基数（40% = 4000）|

### 合约核心函数
```solidity
registerEmployee(address employee)          // 雇主注册员工
setRules(Rule[] rules)                      // 员工设置规则（仅一次）
executePayout(employer, employee,           // 执行者触发发薪
    totalAmount, bytes[] lifiCallData)
getRules(address employee)                  // 查询规则
```

---

## 执行者钱包安全规则（必须遵守）

```
❌ 绝对不能 hardcode 私钥
❌ 绝对不能把 .env 提交到 Git
✅ 私钥只存 Railway 环境变量
✅ 代码中用 os.Getenv("EXECUTOR_PRIVATE_KEY")
✅ 执行者钱包不持有 USDC，只持有少量 ETH（Gas 费）
✅ 雇主每次发薪 Approve 精确金额，不用无限授权
```

---

## Li.Fi 使用注意

```
⚠️  Li.Fi 不支持测试网
✅  使用 Base 或 Gnosis Chain 主网测试（Gas 极低）
✅  按比例拆分 = 多次调用 getRoutes，每次传对应金额
✅  lifiCallData 由前端发薪前生成，传给合约执行
```

---

## 7 天开发计划

| 天 | 任务 |
|---|---|
| Day 1 | 前端初始化 + wagmi 钱包连接 + Li.Fi SDK 跑通第一条路由 |
| Day 2 | Hardhat 初始化 + ChainPay 合约开发 + 部署到 Base |
| Day 3 | 员工配置页：钱包验证 + 规则配置 + 写入合约 |
| Day 4 | 雇主管理端：员工档案 + USDC Approve + 手动发薪 |
| Day 5 | Go 后端：Gin API + GORM + Cron 定时任务 |
| Day 6 | 路由执行状态展示 + 路由可视化 |
| Day 7 | UI 打磨 + Demo 演练 + 提交 |

---

## 文档索引

| 需要了解什么 | 看哪里 |
|---|---|
| 产品定位和差异化 | `docs/product/ChainPay_产品概述.md` |
| 黑客松功能范围 | `docs/product/ChainPay_MVP.md` |
| 合约函数和安全设计 | `docs/technical/ChainPay_Contract.md` |
| 后端 API 接口 | `docs/technical/ChainPay_API.md` |
| 数据库表结构 | `docs/technical/ChainPay_DB.md` |
| 系统架构图 | `docs/technical/ChainPay_Architecture.md` |
| 为什么选 Hardhat | `docs/decisions/ADR-001-Hardhat-vs-Foundry.md` |
