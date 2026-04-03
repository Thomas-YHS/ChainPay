# ChainPay 前端 UI 设计规范

**日期：** 2026-04-03  
**范围：** React 前端全部页面的视觉设计与结构

---

## 1. 视觉风格

**主题：** Dark Web3  
- 背景：`#0f1117`（主背景）/ `#0d1017`（侧边栏）/ `#1e2030`（卡片）
- 主色：`#6366f1`（紫色，按钮/高亮/激活状态）
- 辅色：`#818cf8`（紫色浅，渐变用）
- 文字主：`#ffffff`
- 文字次：`#94a3b8`
- 成功：`#10b981`
- 警告：`#f59e0b`
- 边框：`#2d3155`
- 字体：系统 monospace（导航/数字）+ 系统 sans-serif（正文）

---

## 2. 页面路由结构

```
/                       → 落地页（角色选择 + 连接钱包）
/employer               → redirect → /employer/employees
/employer/employees     → 员工管理（列表 + 添加）
/employer/payout        → 发薪（Approve + 选员工 + 路由预览 + 执行）
/employer/history       → 发薪记录
/employee               → 员工端（钱包验证 → 规则配置 or 完成页）
```

---

## 3. 目录结构

```
src/
├── features/
│   ├── employer/
│   │   ├── pages/
│   │   │   ├── EmployeesPage.tsx     # 员工列表 + 添加
│   │   │   ├── PayoutPage.tsx        # 发薪操作
│   │   │   └── HistoryPage.tsx       # 发薪记录
│   │   └── components/
│   │       ├── EmployeeRow.tsx       # 员工列表行
│   │       ├── AddEmployeeModal.tsx  # 添加员工弹窗
│   │       ├── RouteTimeline.tsx     # 路由执行时间线
│   │       └── ApproveCard.tsx       # USDC Approve 状态卡
│   ├── employee/
│   │   ├── pages/
│   │   │   └── EmployeePage.tsx      # 规则配置 or 完成页（条件渲染）
│   │   └── components/
│   │       ├── RulesForm.tsx         # 规则配置表单
│   │       └── RulesDone.tsx         # 规则已设置展示
│   └── shared/
│       ├── components/
│       │   ├── TopNav.tsx            # 顶部导航（雇主/员工 Tab）
│       │   ├── WalletButton.tsx      # RainbowKit 钱包连接按钮
│       │   └── TxLink.tsx            # tx hash 链接组件
│       └── hooks/
│           ├── useBackend.ts         # Go API 调用
│           └── useContract.ts        # 合约交互（wagmi）
├── routes.tsx
└── App.tsx
```

---

## 4. 导航结构

**顶部导航（全局）**
- 左：Logo `CHAINPAY` + 紫点
- 中：Tab 切换「雇主端」/ 「员工端」（高亮当前）
- 右：RainbowKit `WalletButton`（已连接显示 `0x1f4...a2c`）

**雇主端侧边栏**
- 👥 员工
- 💸 发薪
- 📋 记录
- 激活项：左侧 2px 紫色竖线 + 背景 `#1e2030`

---

## 5. 落地页 `/`

**布局：** 居中单列，无侧边栏

**内容：**
1. Badge：`Powered by Li.Fi`
2. 标题：「跨链薪资，一键路由」（渐变紫色文字）
3. 副标题：产品一句话介绍
4. 角色卡片组（两列）：
   - 「我是雇主」→ 紫色填充卡，按钮「进入管理端 →」
   - 「我是员工」→ 描边卡，按钮「进入配置页 →」
   - 点击后触发 RainbowKit 连接弹窗，连接成功跳转对应路由
5. 底部统计：已路由金额 / 支持链数 / 链上透明

**身份验证逻辑：**
- 雇主：自我选择，无后端验证，直接进管理端
- 员工：连接钱包后调用 `GET /api/employees?wallet=<address>`
  - 200 有记录 → `/employee`（规则配置）
  - 200 无记录 → 显示「未找到档案」提示页

---

## 6. 雇主管理端

### 6.1 员工管理 `/employer/employees`

**员工列表：**
- 每行：头像（名字首字母 + 随机渐变色）/ 姓名 / 月薪 / 发薪频率 / 规则状态标签
- 规则状态：`规则已设`（绿色）/ `待设置`（黄色）
- 右上角：「+ 添加员工」按钮

**添加员工表单（Modal 或右侧抽屉）：**
- 字段：姓名、昵称、钱包地址、合约金额（USDC）、发薪频率（每天/每周/每月）
- 提交后：调用 `POST /api/employees` → 列表刷新

### 6.2 发薪页 `/employer/payout`

**分三步：**

1. **USDC Approve 状态卡**
   - 显示本次发薪总额
   - 已授权：绿色标签
   - 未授权：「Approve USDC」按钮 → 调用合约 `approve`

2. **选择员工**
   - 卡片网格，规则未设置的员工置灰不可选
   - 支持单选

3. **路由预览 + 确认**
   - 点「生成路由预览」→ 调用 Li.Fi SDK `getRoutes`
   - 展示：每条路由的 Bridge 名称、目标链/Token、预估金额
   - 底部：「确认发薪」→ 调用合约 `executePayout`

**执行后：进入路由执行时间线视图**

### 6.3 路由执行时间线

**每条步骤一行，状态实时更新：**
- ✅ 完成：绿点 + 白色文字 + tx hash 链接
- 🟡 进行中：黄点 + 黄色文字 + loading 描述
- ⚪ 待执行：灰点 + 灰色文字

**数据来源：** Li.Fi SDK `executeRoute` 的 `updateRouteHook` 回调

### 6.4 发薪记录 `/employer/history`

- 表格：时间 / 员工名 / 金额 / 状态 / tx hash
- 状态：`完成`（绿）/ `进行中`（黄）/ `失败`（红）
- 数据来源：`GET /api/payroll-logs`

---

## 7. 员工端 `/employee`

**单页面，三种条件渲染状态：**

### 状态 1：未注册
- 钱包连接后 API 未找到记录
- 展示：大图标 + 「未找到你的档案」+ 钱包地址 + 「请联系雇主」说明

### 状态 2：规则配置
- 触发条件：API 找到记录 + 链上合约无规则
- 警告提示：「规则设置后不可修改」
- 规则列表（最多 5 条）：
  - 每条：选择目标链 / 选择 Token / 输入比例 %
  - 支持删除
  - 底部实时显示总计 %（必须 = 100% 才可提交）
- 提交：调用合约 `setRules`

### 状态 3：规则已设置
- 触发条件：链上合约已有规则
- 展示：✅ 图标 + 规则摘要（链/Token/比例）+ tx hash 链接

---

## 8. 技术要点

| 点 | 实现方式 |
|---|---|
| 钱包连接 | RainbowKit `ConnectButton` |
| 链上读写 | wagmi `useReadContract` / `useWriteContract` |
| 后端调用 | `fetch` + 自定义 `useBackend` hook |
| 路由生成 | Li.Fi SDK `getRoutes` |
| 路由执行 | Li.Fi SDK `executeRoute` + `updateRouteHook` 更新状态 |
| 状态管理 | Zustand（全局：钱包、当前员工、路由执行状态）|
| 路由管理 | React Router v6 |

---

## 9. 不在本次前端范围内

- 发薪历史图表/分析
- 员工规则修改（MVP 锁定）
- 多雇主管理
- 移动端适配（黑客松以桌面为主）
