# ChainPay 系统架构图

> 复制下方 Mermaid 代码 → 粘贴到 [mermaid.live](https://mermaid.live) 或导入 Excalidraw

---

## 导入 Excalidraw 步骤

1. 打开 [excalidraw.com](https://excalidraw.com)
2. 点击左上角 `≡` 菜单
3. 选择 **"Import from Mermaid"**
4. 粘贴下方代码，点击 Insert

---

## Mermaid 代码

```mermaid
flowchart TD
  subgraph FE["前端 React + wagmi"]
    A1["雇主管理端\n/employer"]
    A2["员工配置端\n/employee"]
    A3["Li.Fi SDK\n路由预览 / 状态展示"]
  end

  subgraph BE["后端 Go + Gin"]
    B1["员工档案 API\nCRUD"]
    B2["发薪记录 API"]
    B3["robfig/cron\n定时任务"]
    B4["执行者钱包\n私钥存环境变量"]
  end

  subgraph DB["数据库 PostgreSQL"]
    D1["employees\n姓名 昵称 钱包地址\n合约金额 发薪频率"]
    D2["payroll_logs\n金额 时间 tx hash 状态"]
  end

  subgraph CONTRACT["ChainPay 合约 Solidity · Base"]
    C1["registerEmployee\n雇主注册员工"]
    C2["setRules\n员工设置规则 链上存储"]
    C3["executePayout\n验证规则 拆分金额 onlyExecutor"]
  end

  subgraph LIFI["Li.Fi 合约 Base"]
    L1["跨链路由 Bridge + Swap"]
    L2["Stargate / Across / Uniswap / Curve"]
  end

  subgraph WALLETS["员工钱包"]
    W1["40% ETH on Base"]
    W2["60% USDC on Arbitrum"]
  end

  A1 -->|"添加员工档案"| B1
  A1 -->|"USDC Approve"| C1
  A1 -->|"手动触发发薪"| A3
  A2 -->|"验证钱包身份"| B1
  A2 -->|"写入接收规则"| C2
  A3 -->|"getRoutes + generateCalldata"| LIFI

  B1 <-->|"CRUD"| D1
  B2 <-->|"读写记录"| D2
  B3 -->|"Cron 到期触发"| B4
  B4 -->|"调用 executePayout"| C3

  C3 -->|"从雇主钱包拉取 USDC"| A1
  C3 -->|"读取员工规则"| C2
  C3 -->|"按比例调用"| L1
  L1 --> L2
  L2 --> W1
  L2 --> W2
```

---

## 文字版架构说明

### 层级划分

| 层级 | 组件 | 职责 |
|---|---|---|
| 前端 | React + wagmi + Li.Fi SDK | 用户交互、钱包连接、路由预览 |
| 链上 | ChainPay 合约（Solidity） | 规则存储、身份验证、发薪执行 |
| 链上 | Li.Fi 合约 | 跨链路由、Bridge、Swap |
| 后端 | Go + Gin + Cron | 档案管理、定时触发、发薪记录 |
| 存储 | PostgreSQL | 链下数据（档案、记录）|

### 核心数据流

```
【员工设置规则】
员工前端 → 调用 ChainPay 合约 setRules → 规则写入链上

【手动发薪】
雇主前端 → Li.Fi SDK 生成 calldata
         → 前端调用合约 executePayout
         → 合约从雇主钱包拉取 USDC
         → 合约调用 Li.Fi 合约
         → Li.Fi 路由到员工多链钱包

【定时发薪】
Go Cron 到期 → 执行者钱包调用合约 executePayout
             → 合约从雇主钱包拉取 USDC
             → 合约调用 Li.Fi 合约
             → Li.Fi 路由到员工多链钱包

【链下存储】
前端 ↔ Go API ↔ PostgreSQL
（员工档案、发薪记录，规则不存数据库）
```
