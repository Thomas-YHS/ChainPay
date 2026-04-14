# Earn Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在员工页面新增"Earn 收益"按钮，进入 Dashboard 展示 Li.Fi Earn vault 列表，员工可直接用自己钱包存入 vault。

**Architecture:** 纯前端方案（方案 A）。前端直调 `earn.li.fi`（vault 发现）和 `li.quest`（Composer quote），wagmi 签名广播。API key 通过 `VITE_LIFI_API_KEY` 环境变量注入（⚠️ 技术债：生产前需迁移到后端代理）。

**Tech Stack:** React 19, wagmi v2, viem, Tailwind v4, `frontend-design:frontend-design` skill（用于 EarnDashboard UI）

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `frontend/src/features/shared/hooks/useEnsureAllowance.ts` | ERC20 allowance 检查 + approve，供多处复用 |
| 新建 | `frontend/src/features/employee/pages/EarnDashboard.tsx` | Vault 列表 + 存入流程（使用 frontend-design skill） |
| 修改 | `frontend/src/routes.tsx` | 注册 `/employee/earn` 路由 |
| 修改 | `frontend/src/features/employee/pages/EmployeePage.tsx` | 在 `done` 状态下加"Earn 收益"入口按钮 |
| 修改 | `frontend/src/features/employer/pages/PayoutPage.tsx` | 替换内联 `ensureAllowance` 为 hook |
| 修改 | `frontend/src/theme.ts` | 新增 `LIFI_API_KEY` 常量 |
| 修改 | `frontend/.env.local` | 新增 `VITE_LIFI_API_KEY` |

---

## Task 1: 提取 `useEnsureAllowance` hook

**Files:**
- Create: `frontend/src/features/shared/hooks/useEnsureAllowance.ts`
- Modify: `frontend/src/features/employer/pages/PayoutPage.tsx`

> ⚠️ 无测试框架，跳过 TDD 步骤。类型检查替代：`npx tsc --noEmit`

- [ ] **Step 1: 创建 hook 文件**

```typescript
// frontend/src/features/shared/hooks/useEnsureAllowance.ts
import { useAccount, usePublicClient, useSendTransaction } from 'wagmi'
import { encodeFunctionData } from 'viem'

const ERC20_ABI = [
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
] as const

export function useEnsureAllowance() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { sendTransactionAsync } = useSendTransaction()

  async function ensureAllowance(
    tokenAddress: `0x${string}`,
    approvalAddress: `0x${string}`,
    amount: bigint
  ) {
    if (!address || !publicClient) throw new Error('Wallet not connected')
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address as `0x${string}`, approvalAddress],
    })
    if (allowance < amount) {
      const approveTx = await sendTransactionAsync({
        to: tokenAddress,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [approvalAddress, amount],
        }),
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })
    }
  }

  return { ensureAllowance }
}
```

- [ ] **Step 2: 更新 PayoutPage 使用 hook**

在 `PayoutPage.tsx` 中：

1. 删除文件顶部的 `ERC20_ABI` 常量（如果有）
2. 删除 `usePublicClient` import（已移入 hook）
3. 删除内联 `ensureAllowance` 函数
4. 添加 hook import 和调用：

```typescript
// 在 import 区新增
import { useEnsureAllowance } from '../../shared/hooks/useEnsureAllowance'

// 在组件内，替换原有声明
const { ensureAllowance } = useEnsureAllowance()
```

5. 调用处改为（注意 tokenAddress 参数新增）：

```typescript
await ensureAllowance(
  USDC_BASE as `0x${string}`,
  lifiData.estimate.approvalAddress as `0x${string}`,
  BigInt(lifiData.action.fromAmount)
)
```

- [ ] **Step 3: 类型检查**

```bash
cd frontend && npx tsc --noEmit
```

期望：0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/shared/hooks/useEnsureAllowance.ts \
        frontend/src/features/employer/pages/PayoutPage.tsx
git commit -m "refactor(frontend): 提取 useEnsureAllowance hook，供 PayoutPage 和 EarnDashboard 复用"
```

---

## Task 2: 新增环境变量和主题常量

**Files:**
- Modify: `frontend/src/theme.ts`
- Modify: `frontend/.env.local`

- [ ] **Step 1: 在 `theme.ts` 新增 API key 常量**

在 `frontend/src/theme.ts` 现有常量下方添加：

```typescript
export const LIFI_API_KEY = import.meta.env.VITE_LIFI_API_KEY as string ?? ''
export const LIFI_DIAMOND_BASE = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'
```

（注意：`LIFI_DIAMOND_BASE` 已存在则跳过重复添加）

- [ ] **Step 2: 在 `.env.local` 新增变量**

打开 `frontend/.env.local`，追加：

```
VITE_LIFI_API_KEY=<你的 Li.Fi API key>
```

> 获取方式：https://app.li.fi → Developer → API Keys

- [ ] **Step 3: Commit**

```bash
git add frontend/src/theme.ts
# 注意：.env.local 不提交到 git
git commit -m "feat(frontend): 新增 LIFI_API_KEY 主题常量"
```

---

## Task 3: 注册路由

**Files:**
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: 在 `routes.tsx` 新增路由**

```typescript
// 在文件顶部 import 区新增
import EarnDashboard from './features/employee/pages/EarnDashboard'

// 在 routes 数组中，替换：
{ path: '/employee', element: <EmployeePage /> },
// 改为：
{
  path: '/employee',
  children: [
    { index: true, element: <EmployeePage /> },
    { path: 'earn', element: <EarnDashboard /> },
  ],
},
```

> ⚠️ `EarnDashboard.tsx` 在 Task 4 创建，此步骤会导致类型错误，先跳过类型检查，Task 4 完成后统一验证。

- [ ] **Step 2: Commit（暂缓，与 Task 4 合并 commit）**

---

## Task 4: 构建 EarnDashboard 页面（使用 frontend-design skill）

**Files:**
- Create: `frontend/src/features/employee/pages/EarnDashboard.tsx`

> **重要：** 执行此 Task 时，必须先调用 `frontend-design:frontend-design` skill，再实现代码。

### 背景信息（供 frontend-design skill 使用）

**项目风格：**
- 背景色 `#0f1117`，卡片 `#1e2030`，主色 `#6366f1`，文字 `#ffffff`，次要文字 `#94a3b8`，边框 `#2d3155`
- 成功色 `#10b981`，警告 `#f59e0b`，错误 `#ef4444`
- 圆角 `rounded-xl`，Tailwind v4（无配置文件，直接用 class）

**页面结构：**

```
EarnDashboard
├── TopNav（复用现有组件）
├── 页面标题区："Earn 收益" + 返回按钮
├── 加载中状态
├── 错误状态（含重试按钮）
└── vault 列表
    └── VaultCard × N
        ├── 协议 logo 占位 + 协议名
        ├── vault 名称
        ├── APY（绿色高亮）
        ├── TVL
        ├── 链名 badge
        └── 展开区（点击"存入"后显示）
            ├── 金额输入框（USDC）
            ├── 存入按钮
            └── 状态展示（approve 中 / 存入中 / 成功 tx hash / 错误）
```

- [ ] **Step 1: 调用 frontend-design skill 设计 UI**

调用 `frontend-design:frontend-design` skill，描述以上界面需求，获得组件代码。

- [ ] **Step 2: 实现完整组件逻辑**

基于 frontend-design 输出，填入以下核心逻辑：

**2a. 类型定义（文件顶部）：**

```typescript
interface EarnVault {
  id: string
  address: string      // vault 合约地址（作为 toToken）
  protocol: string
  name: string
  chainId: number
  apy: string          // 小数形式，如 "0.125" = 12.5%
  tvlUsd: string
  isTransactional: boolean
}
```

**2b. APY 格式化工具函数：**

```typescript
function formatAPY(apy: string): string {
  const raw = parseFloat(apy)
  if (isNaN(raw)) return 'N/A'
  const pct = raw < 1 ? raw * 100 : raw   // <1 视为小数，>=1 视为已是百分比
  return pct.toFixed(2) + '%'
}
```

**2c. TVL 格式化工具函数：**

```typescript
function formatTVL(tvl: string): string {
  const n = parseFloat(tvl)
  if (isNaN(n)) return 'N/A'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}
```

**2d. Vault 数据加载（useEffect）：**

```typescript
// 从 SUPPORTED_CHAINS 提取所有 chainId，并发请求
useEffect(() => {
  async function load() {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        SUPPORTED_CHAINS.map(chain =>
          fetch(
            `https://earn.li.fi/v1/earn/vaults?chainId=${chain.id}&asset=USDC&sortBy=apy`,
            { headers: { 'x-lifi-api-key': LIFI_API_KEY } }
          ).then(r => r.json()).then(j => (j.data ?? []) as EarnVault[])
        )
      )
      const all = results.flat().filter(v => v.isTransactional)
      all.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy))
      setVaults(all)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load vaults')
    } finally {
      setLoading(false)
    }
  }
  load()
}, [])
```

**2e. 存入流程函数：**

```typescript
async function handleDeposit(vault: EarnVault, amountUsd: string) {
  if (!address) return
  setDepositState('approving')
  try {
    const amountRaw = BigInt(Math.floor(parseFloat(amountUsd) * 1e6))
    const usdcAddress = (SUPPORTED_TOKENS[vault.chainId]?.find(t => t.symbol === 'USDC')?.address
      ?? USDC_BASE) as `0x${string}`

    // Step 1: approve
    await ensureAllowance(usdcAddress, LIFI_DIAMOND_BASE as `0x${string}`, amountRaw)

    // Step 2: Composer quote
    setDepositState('quoting')
    const params = new URLSearchParams({
      fromChain: String(vault.chainId),
      toChain: String(vault.chainId),
      fromToken: usdcAddress,
      toToken: vault.address,
      fromAmount: String(amountRaw),
      fromAddress: address,
      toAddress: address,
    })
    const res = await fetch(`https://li.quest/v1/quote?${params}`)
    if (!res.ok) throw new Error(`LiFi quote error: ${res.status}`)
    const lifiData = await res.json()
    const txReq = lifiData.transactionRequest

    // Step 3: 广播
    setDepositState('depositing')
    const txHash = await sendTransactionAsync({
      to: txReq.to,
      data: txReq.data,
      value: BigInt(txReq.value || '0'),
      gas: txReq.gasLimit ? BigInt(txReq.gasLimit) : undefined,
      gasPrice: txReq.gasPrice ? BigInt(txReq.gasPrice) : undefined,
      maxFeePerGas: txReq.maxFeePerGas ? BigInt(txReq.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: txReq.maxPriorityFeePerGas ? BigInt(txReq.maxPriorityFeePerGas) : undefined,
    })
    setDepositTxHash(txHash)
    setDepositState('success')
  } catch (e: any) {
    if (e.message?.includes('User rejected')) {
      setDepositState('idle')
    } else {
      setDepositError(e.message ?? '存入失败')
      setDepositState('error')
    }
  }
}
```

**2f. 完整 import 列表：**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useSendTransaction } from 'wagmi'
import { useEnsureAllowance } from '../../shared/hooks/useEnsureAllowance'
import TopNav from '../../shared/components/TopNav'
import TxLink from '../../shared/components/TxLink'
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS, USDC_BASE, LIFI_DIAMOND_BASE, LIFI_API_KEY } from '../../../theme'
```

- [ ] **Step 3: 类型检查**

```bash
cd frontend && npx tsc --noEmit
```

期望：0 errors

- [ ] **Step 4: Commit（含 Task 3 的路由变更）**

```bash
git add frontend/src/features/employee/pages/EarnDashboard.tsx \
        frontend/src/routes.tsx
git commit -m "feat(frontend): 新增 Earn Dashboard 页面，支持 vault 展示和 Composer 存入"
```

---

## Task 5: 在 EmployeePage 添加入口按钮

**Files:**
- Modify: `frontend/src/features/employee/pages/EmployeePage.tsx`

- [ ] **Step 1: 在 `done` 状态下加入"Earn 收益"按钮**

找到 `EmployeePage.tsx` 中 `state === 'done'` 的渲染块：

```tsx
{state === 'done' && (
  <>
    <RulesDone txHash={savedTxHash} mode={rulesMode} />
    <div className="mt-6">
      <button
        onClick={() => setShowAutoInvest(true)}
        ...
      >
        💰 配置自动定投理财
      </button>
    </div>
  </>
)}
```

在 `RulesDone` 和自动定投按钮之间插入：

```tsx
<div className="mt-4 px-4 max-w-md mx-auto">
  <button
    onClick={() => navigate('/employee/earn')}
    className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
    style={{ background: '#1e2030', border: '1px solid #10b981', color: '#10b981' }}
  >
    📈 Earn 收益 — 存入 vault 赚取利息
  </button>
</div>
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npx tsc --noEmit
```

期望：0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/employee/pages/EmployeePage.tsx
git commit -m "feat(frontend): 员工页面新增 Earn Dashboard 入口按钮"
```

---

## 验收标准

- [ ] 员工页面（`state === 'done'`）显示"Earn 收益"按钮
- [ ] 点击跳转到 `/employee/earn`
- [ ] Dashboard 加载并展示 vault 列表（协议、APY、TVL、链名）
- [ ] 非 `isTransactional` 的 vault 不显示（已在加载时过滤）
- [ ] 输入金额 → 存入 → 钱包弹出 approve 签名 → 弹出主交易签名 → 展示 tx hash
- [ ] 用户拒绝签名 → 回到 idle 状态，无错误提示
- [ ] `npx tsc --noEmit` 0 errors

---

## 技术债记录

⚠️ **API key 暴露问题：** `VITE_LIFI_API_KEY` 在浏览器中可见。升级路径：
1. 后端新增 `GET /api/v1/vaults?chain_ids=8453,100` 代理 `earn.li.fi`
2. 前端改调后端接口，移除 `VITE_LIFI_API_KEY`
3. 优先级：黑客松后、生产部署前
