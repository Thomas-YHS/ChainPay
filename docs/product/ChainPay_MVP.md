# ChainPay MVP — 黑客松版本

> Li.Fi 官方黑客松 · 单人开发 · 约 1 周 · 测试用低费主网（Base / Gnosis）

---

## 核心场景

> 雇主添加员工 → 员工配置接收规则（存入合约）→ 雇主发薪（手动或定时）→ ChainPay 合约验证规则 → Li.Fi 自动路由到多链多 Token

这是 ChainPay 的"魔法时刻"，也是 Li.Fi 路由能力最直观的展示。

---

## 用户流程

### 雇主侧
1. 连接钱包 → 进入管理端
2. 添加员工档案（姓名、昵称、钱包地址、合约金额、发薪频率）
3. 对 ChainPay 合约进行一次 **USDC Approve**（精确金额，每次发薪前执行）
4. 员工档案保存后，员工即可登录系统
5. 发薪时：手动触发 或 定时自动触发 → 执行者钱包调用合约 → Li.Fi 路由执行

### 员工侧
1. 连接钱包 → 系统检查钱包地址是否在数据库中
2. **不存在** → 提示"你尚未被添加，请联系雇主"
3. **存在** → 进入配置页，设置接收规则（链 + Token + 比例）→ 规则写入链上合约
4. 规则保存后不可修改，后续每次发薪自动执行

---

## 功能范围

### 必须做（核心流程）

#### 1. 雇主管理端 `/employer`

- 连接钱包（雇主身份）
- **员工档案管理**：
  - 添加员工：姓名、昵称、钱包地址、合约金额（USDC）、发薪频率
  - 发薪频率选项：每天 / 每周 / 每月
  - 员工列表展示：姓名、钱包地址、合约金额、规则配置状态
- **USDC Approve**：
  - 添加员工后提示雇主对 ChainPay 合约授权精确金额
  - 每次发薪前自动检查 Allowance 是否充足
- **发薪操作**：
  - 手动触发：选择员工 → 展示路由预览 → 确认执行
  - 定时自动发薪：Go 后端 Cron 到期 → 执行者钱包调用合约 → 自动执行
- 发薪记录列表：展示历史发薪的时间、金额、状态、tx hash

#### 2. 员工配置页 `/employee`

- 连接钱包（员工身份验证）
- 系统检查钱包地址是否存在于员工数据库：
  - **不存在** → 显示提示页："你尚未被添加到系统，请联系雇主"
  - **存在** → 进入配置页
- 配置接收规则（仅可设置一次，不支持修改）：
  - 选择目标链（如 Base、Arbitrum、Gnosis）
  - 选择接收 Token（如 ETH、USDC、DAI）
  - 输入分配比例（%）
  - 支持添加多条规则（最多 5 条）
  - 比例实时校验，总和必须 = 100%
- 确认后规则写入 ChainPay 合约（链上存储）
- 规则保存后展示确认页，显示规则摘要 + 链上 tx hash

#### 3. ChainPay 智能合约

部署在 Base 或 Gnosis Chain，核心功能：

```solidity
contract ChainPayExecutor {
    // 存储员工接收规则（链上，透明可验证）
    mapping(address => Rule[]) public employeeRules;

    // 授权的执行者地址（Go 后端持有的钱包）
    address public executor;

    // 员工设置接收规则
    function setRules(Rule[] calldata rules) external;

    // 执行者触发发薪：从雇主拉取 USDC，调用 Li.Fi 路由
    function executePayout(
        address employer,
        address employee,
        uint256 totalAmount,
        bytes[] calldata lifiCallData  // 由前端 Li.Fi SDK 预先生成
    ) external onlyExecutor;
}
```

- 规则只能由员工本人设置
- 执行者只能按链上规则执行，无法将资金转到任意地址
- 执行者私钥泄露，损失上限 = 雇主已 Approve 的金额

#### 4. 路由执行 + 状态展示

- 合约内按员工规则比例拆分金额
- 调用 Li.Fi 合约执行每条路由
- 前端实时展示每条路由执行状态：
  - `待执行` → `桥接中` → `已完成` / `失败`
- 每笔交易显示 tx hash，可点击跳转区块浏览器

---

### 加分项（选做，评审亮点）

#### A. 路由可视化（强烈推荐）

将 Li.Fi 返回的路径信息可视化展示：

```
USDC (Base)
    ↓
  Li.Fi
  ├── Stargate Bridge → 40% ETH (Base)
  └── Across Bridge + Uniswap → 60% USDC (Arbitrum)
```

- 数据来源：Li.Fi SDK 返回的 `route.steps`
- 实现成本低，视觉冲击强
- 让评审直观看到 Li.Fi 在做什么

#### B. 发薪前汇率预览

- 在确认发薪前显示"员工实际收到约 $X USD 等值"
- 数据来源：Li.Fi 返回的 `toAmountUSD` 字段
- 几乎零额外开发成本

---

### 明确不做（黑客松内排除）

| 功能 | 排除原因 |
|---|---|
| 员工确认链接 | 员工直接用钱包登录验证身份 |
| 员工规则修改 | 设置一次后锁定，降低复杂度 |
| 发薪前确认弹窗 | 路由预览页已承担确认功能 |
| Gas 池管理 | 执行者钱包直接支付 Gas |
| 税务凭证生成 | 非核心展示点 |
| 邮件 / 通知系统 | 基础设施复杂度过高 |
| 多雇主管理后台 | 超出黑客松范围 |
| 合约升级机制 | 黑客松不需要 |

---

## 技术栈

### 前端

| 层级 | 选择 | 备注 |
|---|---|---|
| 框架 | React（Vite） | 轻量，适合黑客松快速开发 |
| 样式 | Tailwind CSS | 快速布局 |
| 钱包连接 | wagmi + RainbowKit | 主流 Web3 钱包连接方案 |
| 跨链路由 | Li.Fi SDK `@lifi/sdk` | 核心执行引擎 |
| 状态管理 | Zustand | 轻量，适合小项目 |

### 后端

| 层级 | 选择 | 备注 |
|---|---|---|
| 语言 | Go | 性能好，部署简单 |
| HTTP 框架 | Gin | Go 最流行框架，文档丰富 |
| ORM | GORM | 类似 JPA，Java 背景上手快 |
| 数据库 | PostgreSQL | 稳定可靠，GORM 支持完善 |
| 定时任务 | robfig/cron | Go 最流行的 Cron 库 |
| 部署 | Railway | 支持 Go 一键部署，免费额度够用 |

### 链上

| 层级 | 选择 | 备注 |
|---|---|---|
| 智能合约语言 | Solidity | 主流，工具链成熟 |
| 开发框架 | Hardhat 或 Foundry | Foundry 更现代，Hardhat 更多教程 |
| 部署链 | Base 或 Gnosis Chain | Gas 极低，Li.Fi 支持 |
| Li.Fi 集成 | 合约内调用 Li.Fi 合约 | 链上直接路由 |

### 执行者钱包安全

| 措施 | 实现方式 |
|---|---|
| 私钥存储 | Railway 环境变量，代码用 `os.Getenv()` 读取 |
| 私钥不进代码库 | `.env` 加入 `.gitignore` |
| Approve 精确金额 | 每次发薪 Approve 精确金额，用完即清零 |
| 执行者权限最小化 | 只能调用 ChainPay 合约，合约限制执行范围 |
| 执行者无资产 | 只持有少量 Gas 费，无 USDC 等资产 |

### 完整架构

```
前端（React + wagmi）
  ├── 钱包连接、USDC Approve → ChainPay 合约
  ├── 员工设置规则 → 写入 ChainPay 合约（链上）
  └── Li.Fi SDK → 展示路由预览、实时状态

ChainPay 合约（Solidity，部署在 Base）
  ├── 存储员工接收规则（链上透明）
  ├── 验证执行者身份（onlyExecutor）
  └── 调用 Li.Fi 合约执行跨链路由

后端（Go + Gin）
  ├── 员工档案 CRUD（姓名等链下信息）
  ├── 发薪记录管理
  └── robfig/cron → 定时触发执行者钱包调用合约

执行者钱包（Go 后端持有，私钥存环境变量）
  └── 调用 ChainPay 合约 → 合约调用 Li.Fi → 资金路由到员工钱包

数据库（PostgreSQL）
  ├── employees    → 员工档案（姓名、昵称、发薪频率等）
  ├── payroll_logs → 发薪记录（金额、时间、tx hash、状态）
  └── （接收规则存链上，不存数据库）
```

---

## Li.Fi SDK 核心用法

```bash
npm install @lifi/sdk
```

```typescript
import { createConfig, getRoutes, executeRoute } from '@lifi/sdk'

createConfig({ integrator: 'ChainPay' })

// 按比例拆分路由（示例：100 USDC → 40% ETH on Base + 60% USDC on Arbitrum）
const route1 = await getRoutes({
  fromChainId: 8453,
  toChainId: 8453,
  fromTokenAddress: USDC_BASE,
  toTokenAddress: ETH_BASE,
  fromAmount: '40000000',       // 40 USDC（合约金额 × 40%）
  fromAddress: chainPayContract,
  toAddress: employeeAddress,
})

const route2 = await getRoutes({
  fromChainId: 8453,
  toChainId: 42161,
  fromTokenAddress: USDC_BASE,
  toTokenAddress: USDC_ARB,
  fromAmount: '60000000',       // 60 USDC（合约金额 × 60%）
  fromAddress: chainPayContract,
  toAddress: employeeAddress,
})

await executeRoute(route1.routes[0], {
  updateRouteHook(route) { /* 更新 UI 状态 */ }
})
await executeRoute(route2.routes[0], {
  updateRouteHook(route) { /* 更新 UI 状态 */ }
})
```

> **注意**：Li.Fi 已停止测试网支持。建议使用 Base 或 Gnosis Chain（Gas 极低）作为测试环境。

---

## 展示脚本（Demo Day）

1. 打开雇主管理端 → 展示已添加的员工档案（姓名、金额、发薪频率）
2. 切换到员工页面 → 连接员工钱包 → 设置接收规则（40% ETH on Base，60% USDC on Arbitrum）→ 规则写入链上
3. 回到雇主端 → Approve USDC → 触发发薪 → 展示路由预览
4. 确认发薪 → 合约验证规则 → Li.Fi 路由执行 → 实时展示状态
5. 展示路由可视化：Li.Fi 如何拆分路径经过哪些桥和 DEX
6. 点击 tx hash → 区块浏览器确认员工多链到账
7. （可选）展示定时发薪：下次自动发薪时间倒计时

整个 demo 约 2 分钟，核心信息：**规则上链透明可验证，雇主无法篡改，Li.Fi 全程自动路由。**

---

## 开发优先级

```
Week 1 计划

Day 1    项目初始化 + 钱包连接 + Li.Fi SDK 跑通第一条路由
Day 2    ChainPay 合约开发（规则存储 + executePayout）+ 部署到 Base
Day 3    员工配置页：钱包验证 + 接收规则配置 + 写入合约
Day 4    雇主管理端：员工档案 + USDC Approve + 手动发薪触发
Day 5    Go 后端：Cron 定时任务 + 执行者钱包调用合约
Day 6    路由执行状态实时展示 + 路由可视化（加分项 A）
Day 7    UI 打磨 + Demo 脚本演练 + 提交
```

---

*本文档为黑客松 MVP 版本，聚焦核心场景，非完整产品规划。*
