# ChainPay Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete ChainPay React frontend — landing page, employer management dashboard, and employee rules configuration — using Dark Web3 design.

**Architecture:** Single-page app with React Router v6, feature-based folder structure (`src/features/employer`, `src/features/employee`, `src/features/shared`). Zustand for global state (role selection, payout execution status). wagmi + RainbowKit for wallet. Li.Fi SDK for route generation and execution.

**Tech Stack:** React 18 + Vite, TypeScript, Tailwind CSS, wagmi v2, RainbowKit v2, @lifi/sdk, Zustand, React Router v6, @tanstack/react-query

---

## File Map

```
frontend/
├── .env.example
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx                              # App entry, providers
│   ├── App.tsx                               # Router setup
│   ├── routes.tsx                            # Route definitions
│   ├── theme.ts                              # Color constants
│   ├── store.ts                              # Zustand global store
│   ├── features/
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── TopNav.tsx               # Top navigation bar
│   │   │   │   ├── TxLink.tsx               # Clickable tx hash link
│   │   │   │   └── WalletButton.tsx         # RainbowKit wrapper
│   │   │   └── hooks/
│   │   │       ├── useBackend.ts            # Go API calls
│   │   │       └── useContract.ts           # wagmi contract calls
│   │   ├── employer/
│   │   │   ├── pages/
│   │   │   │   ├── EmployeesPage.tsx        # Employee list + add
│   │   │   │   ├── PayoutPage.tsx           # Payout flow (approve → select → route → execute)
│   │   │   │   └── HistoryPage.tsx          # Payroll log table
│   │   │   ├── components/
│   │   │   │   ├── EmployerLayout.tsx       # Sidebar layout wrapper
│   │   │   │   ├── EmployeeRow.tsx          # Single employee row
│   │   │   │   ├── AddEmployeeModal.tsx     # Add employee form modal
│   │   │   │   ├── ApproveCard.tsx          # USDC approve status card
│   │   │   │   └── RouteTimeline.tsx        # Li.Fi route execution steps
│   │   └── employee/
│   │       ├── pages/
│   │       │   └── EmployeePage.tsx         # 3-state page (not found / setup / done)
│   │       └── components/
│   │           ├── RulesForm.tsx            # Rules configuration form
│   │           └── RulesDone.tsx            # Rules set confirmation view
│   └── pages/
│       └── LandingPage.tsx                  # Role selection + connect wallet
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `frontend/` (entire Vite project)
- Create: `frontend/.env.example`
- Create: `frontend/tailwind.config.ts`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /Users/yuehongshu/Documents/dev-Claude/Projects/ChainPay
npm create vite@latest frontend -- --template react-ts
cd frontend
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install \
  react-router-dom \
  @rainbow-me/rainbowkit \
  wagmi \
  viem \
  @tanstack/react-query \
  @lifi/sdk \
  zustand \
  tailwindcss \
  @tailwindcss/vite \
  autoprefixer
```

- [ ] **Step 3: Configure Tailwind**

Replace `frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Replace `frontend/src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Create `.env.example`**

```
VITE_API_URL=http://localhost:8080/api/v1
VITE_CHAIN_PAY_CONTRACT=0x0000000000000000000000000000000000000000
```

Copy to `.env.local`:
```bash
cp .env.example .env.local
```

- [ ] **Step 5: Clean up Vite boilerplate**

Delete: `src/App.css`, `src/assets/react.svg`, `public/vite.svg`

Replace `src/App.tsx` with empty placeholder:
```tsx
export default function App() {
  return <div>ChainPay</div>
}
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```
Expected: Server at `http://localhost:5173`, page shows "ChainPay"

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend (Vite + React + Tailwind + wagmi + Li.Fi)"
```

---

## Task 2: Theme Constants & Store

**Files:**
- Create: `frontend/src/theme.ts`
- Create: `frontend/src/store.ts`

- [ ] **Step 1: Create theme constants**

Create `frontend/src/theme.ts`:
```ts
export const colors = {
  bg: '#0f1117',
  bgSidebar: '#0d1017',
  card: '#1e2030',
  cardDeep: '#252840',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  text: '#ffffff',
  textMuted: '#94a3b8',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#2d3155',
} as const

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const LIFI_DIAMOND_BASE = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'
export const CHAIN_PAY_CONTRACT = import.meta.env.VITE_CHAIN_PAY_CONTRACT as `0x${string}`
export const API_URL = import.meta.env.VITE_API_URL as string

export const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', label: 'Base' },
  { id: 42161, name: 'Arbitrum', label: 'Arbitrum' },
  { id: 100, name: 'Gnosis', label: 'Gnosis' },
  { id: 10, name: 'Optimism', label: 'Optimism' },
] as const

export const SUPPORTED_TOKENS: Record<number, { symbol: string; address: string }[]> = {
  8453: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: USDC_BASE },
  ],
  42161: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  ],
  100: [
    { symbol: 'xDAI', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83' },
  ],
  10: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  ],
}

export const PAY_FREQUENCY_LABELS: Record<string, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
}
```

- [ ] **Step 2: Create Zustand store**

Create `frontend/src/store.ts`:
```ts
import { create } from 'zustand'
import type { Route } from '@lifi/sdk'

// Types matching the Go API response
export interface Employee {
  id: number
  employer_address: string
  name: string
  nickname: string
  wallet_address: string
  salary_amount: string
  pay_frequency: string
  has_rules: boolean
  next_pay_date: string
  created_at: string
}

export interface PayrollLog {
  id: number
  employee_id: number
  employee_name: string
  amount: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  tx_hash: string
  created_at: string
}

export type RouteStepStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface RouteStep {
  label: string
  status: RouteStepStatus
  txHash?: string
  description?: string
}

interface AppStore {
  // Role selected on landing page
  role: 'employer' | 'employee' | null
  setRole: (role: 'employer' | 'employee') => void

  // Selected employee for payout
  selectedEmployee: Employee | null
  setSelectedEmployee: (e: Employee | null) => void

  // Li.Fi routes generated
  routes: Route[]
  setRoutes: (routes: Route[]) => void

  // Execution steps for the timeline
  routeSteps: RouteStep[]
  setRouteSteps: (steps: RouteStep[]) => void
  updateRouteStep: (index: number, update: Partial<RouteStep>) => void
}

export const useAppStore = create<AppStore>((set) => ({
  role: null,
  setRole: (role) => set({ role }),

  selectedEmployee: null,
  setSelectedEmployee: (e) => set({ selectedEmployee: e }),

  routes: [],
  setRoutes: (routes) => set({ routes }),

  routeSteps: [],
  setRouteSteps: (steps) => set({ routeSteps: steps }),
  updateRouteStep: (index, update) =>
    set((state) => {
      const steps = [...state.routeSteps]
      steps[index] = { ...steps[index], ...update }
      return { routeSteps: steps }
    }),
}))
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/theme.ts frontend/src/store.ts
git commit -m "feat: add theme constants and Zustand store"
```

---

## Task 3: Providers & Router Setup

**Files:**
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/routes.tsx`

- [ ] **Step 1: Set up wagmi + RainbowKit config**

Replace `frontend/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import { base } from 'viem/chains'
import { createConfig } from '@lifi/sdk'
import App from './App'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'

// Li.Fi SDK — initialize once at app start
createConfig({ integrator: 'ChainPay' })

const wagmiConfig = getDefaultConfig({
  appName: 'ChainPay',
  projectId: 'chainpay-hackathon',   // WalletConnect project ID (placeholder works for local)
  chains: [base],
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: '#6366f1' })}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
```

- [ ] **Step 2: Create routes**

Create `frontend/src/routes.tsx`:
```tsx
import { Navigate, RouteObject } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import EmployerLayout from './features/employer/components/EmployerLayout'
import EmployeesPage from './features/employer/pages/EmployeesPage'
import PayoutPage from './features/employer/pages/PayoutPage'
import HistoryPage from './features/employer/pages/HistoryPage'
import EmployeePage from './features/employee/pages/EmployeePage'

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  {
    path: '/employer',
    element: <EmployerLayout />,
    children: [
      { index: true, element: <Navigate to="/employer/employees" replace /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'payout', element: <PayoutPage /> },
      { path: 'history', element: <HistoryPage /> },
    ],
  },
  { path: '/employee', element: <EmployeePage /> },
]
```

- [ ] **Step 3: Create App.tsx**

Replace `frontend/src/App.tsx`:
```tsx
import { BrowserRouter, useRoutes } from 'react-router-dom'
import { routes } from './routes'

function AppRoutes() {
  return useRoutes(routes)
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Create stub pages so routes compile**

Create `frontend/src/pages/LandingPage.tsx`:
```tsx
export default function LandingPage() {
  return <div style={{ color: 'white' }}>Landing</div>
}
```

Create `frontend/src/features/employer/components/EmployerLayout.tsx`:
```tsx
import { Outlet } from 'react-router-dom'
export default function EmployerLayout() {
  return <Outlet />
}
```

Create `frontend/src/features/employer/pages/EmployeesPage.tsx`:
```tsx
export default function EmployeesPage() {
  return <div style={{ color: 'white' }}>Employees</div>
}
```

Create `frontend/src/features/employer/pages/PayoutPage.tsx`:
```tsx
export default function PayoutPage() {
  return <div style={{ color: 'white' }}>Payout</div>
}
```

Create `frontend/src/features/employer/pages/HistoryPage.tsx`:
```tsx
export default function HistoryPage() {
  return <div style={{ color: 'white' }}>History</div>
}
```

Create `frontend/src/features/employee/pages/EmployeePage.tsx`:
```tsx
export default function EmployeePage() {
  return <div style={{ color: 'white' }}>Employee</div>
}
```

- [ ] **Step 5: Verify all routes load**

```bash
npm run dev
```
Visit `http://localhost:5173`, `http://localhost:5173/employer/employees`, `http://localhost:5173/employee` — each should show a white text stub without errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: set up providers (wagmi, RainbowKit, Li.Fi) and React Router"
```

---

## Task 4: Shared Components

**Files:**
- Create: `frontend/src/features/shared/components/TopNav.tsx`
- Create: `frontend/src/features/shared/components/TxLink.tsx`
- Create: `frontend/src/features/shared/components/WalletButton.tsx`

- [ ] **Step 1: Create TxLink**

Create `frontend/src/features/shared/components/TxLink.tsx`:
```tsx
interface TxLinkProps {
  hash: string
  chainId?: number
}

function explorerUrl(hash: string, chainId = 8453): string {
  const explorers: Record<number, string> = {
    8453: 'https://basescan.org/tx/',
    42161: 'https://arbiscan.io/tx/',
    100: 'https://gnosisscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
  }
  return `${explorers[chainId] ?? explorers[8453]}${hash}`
}

export default function TxLink({ hash, chainId }: TxLinkProps) {
  const short = `${hash.slice(0, 6)}...${hash.slice(-4)}`
  return (
    <a
      href={explorerUrl(hash, chainId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 text-xs font-mono"
    >
      {short} ↗
    </a>
  )
}
```

- [ ] **Step 2: Create WalletButton wrapper**

Create `frontend/src/features/shared/components/WalletButton.tsx`:
```tsx
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function WalletButton() {
  return (
    <ConnectButton
      showBalance={false}
      chainStatus="none"
      accountStatus="address"
    />
  )
}
```

- [ ] **Step 3: Create TopNav**

Create `frontend/src/features/shared/components/TopNav.tsx`:
```tsx
import { Link, useLocation } from 'react-router-dom'
import WalletButton from './WalletButton'

export default function TopNav() {
  const { pathname } = useLocation()
  const isEmployer = pathname.startsWith('/employer')
  const isEmployee = pathname.startsWith('/employee')

  return (
    <nav className="flex items-center px-6 h-14 border-b" style={{ background: '#0f1117', borderColor: '#1e2030' }}>
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mr-6">
        <span className="w-2 h-2 rounded-full bg-indigo-500" />
        <span className="text-white font-bold text-sm tracking-widest font-mono">CHAINPAY</span>
      </Link>

      {/* Role tabs */}
      <div className="flex gap-1">
        <Link
          to="/employer/employees"
          className="px-4 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            background: isEmployer ? '#6366f1' : 'transparent',
            color: isEmployer ? '#fff' : '#4b5563',
          }}
        >
          雇主端
        </Link>
        <Link
          to="/employee"
          className="px-4 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            background: isEmployee ? '#6366f1' : 'transparent',
            color: isEmployee ? '#fff' : '#4b5563',
          }}
        >
          员工端
        </Link>
      </div>

      {/* Wallet */}
      <div className="ml-auto">
        <WalletButton />
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/shared/
git commit -m "feat: add shared components (TopNav, TxLink, WalletButton)"
```

---

## Task 5: Shared Hooks

**Files:**
- Create: `frontend/src/features/shared/hooks/useBackend.ts`
- Create: `frontend/src/features/shared/hooks/useContract.ts`

- [ ] **Step 1: Create useBackend hook**

`useBackend` wraps all Go API calls. It reads the connected wallet address and passes it as `X-Wallet-Address` header.

Create `frontend/src/features/shared/hooks/useBackend.ts`:
```ts
import { useAccount } from 'wagmi'
import { API_URL } from '../../../theme'
import type { Employee, PayrollLog } from '../../../store'

export function useBackend() {
  const { address } = useAccount()

  function headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(address ? { 'X-Wallet-Address': address } : {}),
    }
  }

  async function getEmployees(): Promise<Employee[]> {
    const res = await fetch(`${API_URL}/employees`, { headers: headers() })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data.employees
  }

  async function getEmployeeByWallet(wallet: string): Promise<Employee | null> {
    const res = await fetch(`${API_URL}/employees/${wallet}`, { headers: headers() })
    const json = await res.json()
    if (json.code === 404) return null
    if (json.code !== 200) throw new Error(json.message)
    return json.data
  }

  async function addEmployee(data: {
    name: string
    nickname: string
    wallet_address: string
    salary_amount: string
    pay_frequency: string
  }): Promise<Employee> {
    const res = await fetch(`${API_URL}/employees`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (json.code !== 201) throw new Error(json.message)
    return json.data
  }

  async function getPayrollLogs(): Promise<PayrollLog[]> {
    const res = await fetch(`${API_URL}/payroll-logs`, { headers: headers() })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data.logs ?? []
  }

  return { getEmployees, getEmployeeByWallet, addEmployee, getPayrollLogs }
}
```

- [ ] **Step 2: Create useContract hook**

Create `frontend/src/features/shared/hooks/useContract.ts`:
```ts
import { useWriteContract, useReadContract } from 'wagmi'
import { CHAIN_PAY_CONTRACT, USDC_BASE } from '../../../theme'

// Minimal ABI — only the functions we call
const CHAIN_PAY_ABI = [
  {
    name: 'setRules',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'rules',
        type: 'tuple[]',
        components: [
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'basisPoints', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: 'getRules',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'employee', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'basisPoints', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'executePayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'employer', type: 'address' },
      { name: 'employee', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'lifiCallData', type: 'bytes[]' },
    ],
    outputs: [],
  },
] as const

const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export function useContract() {
  const { writeContractAsync } = useWriteContract()

  function setRules(rules: { chainId: bigint; tokenAddress: `0x${string}`; basisPoints: bigint }[]) {
    return writeContractAsync({
      address: CHAIN_PAY_CONTRACT,
      abi: CHAIN_PAY_ABI,
      functionName: 'setRules',
      args: [rules],
    })
  }

  function approveUsdc(amount: bigint) {
    return writeContractAsync({
      address: USDC_BASE as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [CHAIN_PAY_CONTRACT, amount],
    })
  }

  function executePayout(
    employer: `0x${string}`,
    employee: `0x${string}`,
    totalAmount: bigint,
    lifiCallData: `0x${string}`[]
  ) {
    return writeContractAsync({
      address: CHAIN_PAY_CONTRACT,
      abi: CHAIN_PAY_ABI,
      functionName: 'executePayout',
      args: [employer, employee, totalAmount, lifiCallData],
    })
  }

  return { setRules, approveUsdc, executePayout }
}

// Separate hook for reading rules (wagmi useReadContract is a React hook)
export function useGetRules(employeeAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: CHAIN_PAY_CONTRACT,
    abi: CHAIN_PAY_ABI,
    functionName: 'getRules',
    args: employeeAddress ? [employeeAddress] : undefined,
    query: { enabled: !!employeeAddress },
  })
}

export function useUsdcAllowance(ownerAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_BASE as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: 'allowance',
    args: ownerAddress ? [ownerAddress, CHAIN_PAY_CONTRACT] : undefined,
    query: { enabled: !!ownerAddress },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/shared/hooks/
git commit -m "feat: add useBackend and useContract hooks"
```

---

## Task 6: Landing Page

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx`

- [ ] **Step 1: Implement landing page**

Replace `frontend/src/pages/LandingPage.tsx`:
```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useConnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAppStore } from '../store'
import WalletButton from '../features/shared/components/WalletButton'

export default function LandingPage() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { role, setRole } = useAppStore()

  // After wallet connects, redirect based on role
  useEffect(() => {
    if (!isConnected || !address || !role) return
    if (role === 'employer') {
      navigate('/employer/employees')
    } else {
      navigate('/employee')
    }
  }, [isConnected, address, role, navigate])

  function handleRoleClick(selected: 'employer' | 'employee') {
    setRole(selected)
    if (isConnected) {
      // Already connected — navigate directly
      navigate(selected === 'employer' ? '/employer/employees' : '/employee')
    } else {
      openConnectModal?.()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0f1117' }}>
      {/* Wallet button top right */}
      <div className="absolute top-4 right-4">
        <WalletButton />
      </div>

      {/* Badge */}
      <div
        className="mb-5 px-4 py-1 rounded-full text-xs font-medium border"
        style={{ background: '#1e2030', borderColor: '#2d3155', color: '#6366f1' }}
      >
        Powered by Li.Fi
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-center mb-3" style={{ color: '#fff' }}>
        跨链薪资，
        <span style={{ background: 'linear-gradient(90deg,#6366f1,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          一键路由
        </span>
      </h1>
      <p className="text-center text-sm mb-10 max-w-sm" style={{ color: '#94a3b8' }}>
        雇主单链发 USDC，员工自动收到多链多 Token 组合。规则透明上链，无需信任中间方。
      </p>

      {/* Role cards */}
      <div className="flex gap-4 w-full max-w-sm">
        <button
          onClick={() => handleRoleClick('employer')}
          className="flex-1 rounded-xl p-6 text-center cursor-pointer transition-transform hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#1e2030,#252840)', border: '1px solid #6366f1' }}
        >
          <div className="text-3xl mb-3">🏢</div>
          <div className="text-white font-semibold text-sm mb-1">我是雇主</div>
          <div className="text-xs mb-4" style={{ color: '#94a3b8' }}>添加员工、设置发薪</div>
          <div className="py-2 px-3 rounded-md text-xs font-semibold" style={{ background: '#6366f1', color: '#fff' }}>
            进入管理端 →
          </div>
        </button>

        <button
          onClick={() => handleRoleClick('employee')}
          className="flex-1 rounded-xl p-6 text-center cursor-pointer transition-transform hover:scale-105"
          style={{ background: '#1e2030', border: '1px solid #2d3155' }}
        >
          <div className="text-3xl mb-3">👷</div>
          <div className="text-white font-semibold text-sm mb-1">我是员工</div>
          <div className="text-xs mb-4" style={{ color: '#94a3b8' }}>设置接收规则</div>
          <div className="py-2 px-3 rounded-md text-xs" style={{ background: '#252840', color: '#94a3b8', border: '1px solid #2d3155' }}>
            进入配置页 →
          </div>
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-10 mt-12 pt-8" style={{ borderTop: '1px solid #1e2030' }}>
        {[
          { value: '$7.2K', label: '已路由' },
          { value: '4', label: '条链' },
          { value: '100%', label: '链上透明' },
        ].map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="text-white font-bold text-lg">{value}</div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify landing page renders**

```bash
npm run dev
```
Visit `http://localhost:5173` — should see the Dark Web3 landing page with two role cards.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx
git commit -m "feat: implement landing page with role selection"
```

---

## Task 7: Employer Layout + EmployeesPage

**Files:**
- Modify: `frontend/src/features/employer/components/EmployerLayout.tsx`
- Create: `frontend/src/features/employer/components/EmployeeRow.tsx`
- Modify: `frontend/src/features/employer/pages/EmployeesPage.tsx`

- [ ] **Step 1: Implement EmployerLayout with sidebar**

Replace `frontend/src/features/employer/components/EmployerLayout.tsx`:
```tsx
import { Outlet, NavLink } from 'react-router-dom'
import TopNav from '../../shared/components/TopNav'

const navItems = [
  { to: '/employer/employees', icon: '👥', label: '员工' },
  { to: '/employer/payout', icon: '💸', label: '发薪' },
  { to: '/employer/history', icon: '📋', label: '记录' },
]

export default function EmployerLayout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1117' }}>
      <TopNav />
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-20 flex flex-col py-4 gap-1" style={{ background: '#0d1017', borderRight: '1px solid #1e2030' }}>
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center py-3 px-2 rounded-md mx-1 text-center transition-colors"
              style={({ isActive }) => ({
                background: isActive ? '#1e2030' : 'transparent',
                borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
                color: isActive ? '#fff' : '#4b5563',
              })}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </aside>
        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create EmployeeRow component**

Create `frontend/src/features/employer/components/EmployeeRow.tsx`:
```tsx
import { PAY_FREQUENCY_LABELS } from '../../../theme'
import type { Employee } from '../../../store'

// Deterministic gradient based on first letter
const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#818cf8)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#06b6d4,#22d3ee)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#ef4444,#f87171)',
]
function avatarGradient(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

interface Props {
  employee: Employee
}

export default function EmployeeRow({ employee }: Props) {
  const initial = (employee.nickname || employee.name)[0].toUpperCase()
  const freqLabel = PAY_FREQUENCY_LABELS[employee.pay_frequency] ?? employee.pay_frequency

  return (
    <div
      className="flex items-center px-4 py-3 border-b"
      style={{ borderColor: '#252840' }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold mr-3 flex-shrink-0"
        style={{ background: avatarGradient(employee.name) }}
      >
        {initial}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-semibold truncate">{employee.name}</div>
        <div className="text-xs" style={{ color: '#94a3b8' }}>
          ${employee.salary_amount} USDC · {freqLabel}
        </div>
      </div>
      {/* Wallet */}
      <div className="text-xs mr-4 font-mono hidden md:block" style={{ color: '#4b5563' }}>
        {employee.wallet_address.slice(0, 6)}...{employee.wallet_address.slice(-4)}
      </div>
      {/* Status badge */}
      {employee.has_rules ? (
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#10b98120', color: '#10b981' }}>
          规则已设
        </span>
      ) : (
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
          待设置
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement EmployeesPage**

Replace `frontend/src/features/employer/pages/EmployeesPage.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import EmployeeRow from '../components/EmployeeRow'
import AddEmployeeModal from '../components/AddEmployeeModal'
import type { Employee } from '../../../store'

export default function EmployeesPage() {
  const { getEmployees } = useBackend()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch (e) {
      setError('无法加载员工列表，请确认后端已启动')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center mb-6">
        <h1 className="text-white text-xl font-bold">员工列表</h1>
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#6366f1' }}
        >
          + 添加员工
        </button>
      </div>

      {loading && <p style={{ color: '#94a3b8' }}>加载中...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
          {employees.length === 0 ? (
            <div className="py-12 text-center" style={{ color: '#94a3b8' }}>
              还没有员工，点击「添加员工」开始
            </div>
          ) : (
            employees.map((emp) => <EmployeeRow key={emp.id} employee={emp} />)
          )}
        </div>
      )}

      {showModal && (
        <AddEmployeeModal
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create AddEmployeeModal stub** (full implementation in Task 8)

Create `frontend/src/features/employer/components/AddEmployeeModal.tsx`:
```tsx
interface Props {
  onClose: () => void
  onAdded: () => void
}
export default function AddEmployeeModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="p-6 rounded-xl" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <p style={{ color: '#fff' }}>AddEmployeeModal — coming in Task 8</p>
        <button onClick={onClose} style={{ color: '#94a3b8', marginTop: 12 }}>关闭</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify layout renders**

```bash
npm run dev
```
Visit `http://localhost:5173/employer/employees` — should see sidebar + TopNav + "员工列表" heading.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/employer/
git commit -m "feat: employer layout with sidebar and EmployeesPage"
```

---

## Task 8: AddEmployeeModal

**Files:**
- Modify: `frontend/src/features/employer/components/AddEmployeeModal.tsx`

- [ ] **Step 1: Implement modal**

Replace `frontend/src/features/employer/components/AddEmployeeModal.tsx`:
```tsx
import { useState } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'

interface Props {
  onClose: () => void
  onAdded: () => void
}

const FREQUENCIES = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
]

export default function AddEmployeeModal({ onClose, onAdded }: Props) {
  const { addEmployee } = useBackend()
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    wallet_address: '',
    salary_amount: '',
    pay_frequency: 'monthly',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.wallet_address || !form.salary_amount) {
      setError('姓名、钱包地址、合约金额为必填项')
      return
    }
    if (!form.wallet_address.startsWith('0x') || form.wallet_address.length !== 42) {
      setError('钱包地址格式错误（需要 0x 开头，42位）')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await addEmployee(form)
      onAdded()
    } catch (e: any) {
      setError(e.message ?? '添加失败')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#252840',
    border: '1px solid #2d3155',
    borderRadius: 6,
    color: '#fff',
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  }

  const labelStyle = { color: '#94a3b8', fontSize: 11, marginBottom: 4, display: 'block' }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <div className="flex items-center mb-5">
          <h2 className="text-white font-bold">添加员工</h2>
          <button onClick={onClose} className="ml-auto text-lg" style={{ color: '#4b5563' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>姓名 *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="张三" />
          </div>
          <div>
            <label style={labelStyle}>昵称</label>
            <input style={inputStyle} value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="Alex（可选）" />
          </div>
          <div>
            <label style={labelStyle}>钱包地址 *</label>
            <input style={inputStyle} value={form.wallet_address} onChange={e => set('wallet_address', e.target.value)} placeholder="0x..." className="font-mono" />
          </div>
          <div>
            <label style={labelStyle}>合约金额（USDC）*</label>
            <input style={inputStyle} type="number" min="1" value={form.salary_amount} onChange={e => set('salary_amount', e.target.value)} placeholder="2400" />
          </div>
          <div>
            <label style={labelStyle}>发薪频率 *</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.pay_frequency} onChange={e => set('pay_frequency', e.target.value)}>
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ background: '#252840', color: '#94a3b8', border: '1px solid #2d3155' }}>
              取消
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: loading ? '#4b5563' : '#6366f1', color: '#fff' }}>
              {loading ? '添加中...' : '确认添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/employer/components/AddEmployeeModal.tsx
git commit -m "feat: implement AddEmployeeModal"
```

---

## Task 9: PayoutPage — Approve + Employee Selection

**Files:**
- Modify: `frontend/src/features/employer/pages/PayoutPage.tsx`
- Create: `frontend/src/features/employer/components/ApproveCard.tsx`

- [ ] **Step 1: Create ApproveCard**

Create `frontend/src/features/employer/components/ApproveCard.tsx`:
```tsx
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useContract, useUsdcAllowance } from '../../shared/hooks/useContract'
import { parseUnits, formatUnits } from 'viem'

interface Props {
  totalAmountUsdc: string  // e.g. "7200"
}

export default function ApproveCard({ totalAmountUsdc }: Props) {
  const { address } = useAccount()
  const { approveUsdc } = useContract()
  const { data: allowance, refetch } = useUsdcAllowance(address)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const required = parseUnits(totalAmountUsdc || '0', 6)
  const current = allowance ?? 0n
  const isApproved = current >= required

  async function handleApprove() {
    setLoading(true)
    setError(null)
    try {
      await approveUsdc(required)
      await refetch()
    } catch (e: any) {
      setError(e.shortMessage ?? e.message ?? '授权失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
      <div className="flex items-center mb-2">
        <span className="text-white font-semibold text-sm">USDC Approve</span>
        {isApproved ? (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#10b98120', color: '#10b981' }}>
            已授权 ${formatUnits(current, 6)}
          </span>
        ) : (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#ef444420', color: '#ef4444' }}>
            未授权
          </span>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>
        本次发薪总额：<span className="text-white font-mono">${totalAmountUsdc} USDC</span>
      </p>
      {!isApproved && (
        <>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-semibold"
            style={{ background: loading ? '#4b5563' : '#6366f1', color: '#fff' }}
          >
            {loading ? '授权中...' : `Approve $${totalAmountUsdc} USDC`}
          </button>
          {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement PayoutPage (step 1 & 2 of 3)**

Replace `frontend/src/features/employer/pages/PayoutPage.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../../store'
import { useBackend } from '../../shared/hooks/useBackend'
import ApproveCard from '../components/ApproveCard'
import RouteTimeline from '../components/RouteTimeline'
import type { Employee } from '../../../store'
import { PAY_FREQUENCY_LABELS } from '../../../theme'

type Step = 'select' | 'executing'

export default function PayoutPage() {
  const { getEmployees } = useBackend()
  const { selectedEmployee, setSelectedEmployee, routeSteps } = useAppStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [step, setStep] = useState<Step>('select')

  const load = useCallback(async () => {
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch { /* backend not ready */ }
  }, [])

  useEffect(() => { load() }, [load])

  const eligibleEmployees = employees.filter((e) => e.has_rules)
  const totalAmount = selectedEmployee ? selectedEmployee.salary_amount : '0'

  if (step === 'executing') {
    return (
      <div>
        <div className="flex items-center mb-6">
          <h1 className="text-white text-xl font-bold">
            发薪执行中 · {selectedEmployee?.name}
          </h1>
          <button
            onClick={() => { setStep('select'); setSelectedEmployee(null) }}
            className="ml-auto text-sm"
            style={{ color: '#94a3b8' }}
          >
            ← 返回
          </button>
        </div>
        <RouteTimeline steps={routeSteps} employee={selectedEmployee!} />
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-white text-xl font-bold mb-6">发薪</h1>

      <ApproveCard totalAmountUsdc={totalAmount} />

      <h2 className="text-sm font-semibold mb-3" style={{ color: '#94a3b8' }}>选择员工</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {employees.map((emp) => {
          const disabled = !emp.has_rules
          const selected = selectedEmployee?.id === emp.id
          return (
            <button
              key={emp.id}
              disabled={disabled}
              onClick={() => setSelectedEmployee(selected ? null : emp)}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: selected ? '#1e2030' : '#1a1f35',
                border: selected ? '1px solid #6366f1' : '1px solid #2d3155',
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="text-white text-sm font-semibold">{emp.name}</div>
              <div className="text-xs mt-1" style={{ color: '#6366f1' }}>${emp.salary_amount} USDC</div>
              <div className="text-xs mt-1" style={{ color: disabled ? '#f59e0b' : '#94a3b8' }}>
                {disabled ? '待设置规则' : PAY_FREQUENCY_LABELS[emp.pay_frequency]}
              </div>
            </button>
          )
        })}
      </div>

      {eligibleEmployees.length === 0 && (
        <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>暂无已设置规则的员工</p>
      )}

      <RoutePreviewSection
        employee={selectedEmployee}
        onExecuting={() => setStep('executing')}
      />
    </div>
  )
}

// Route preview is implemented in Task 10
function RoutePreviewSection({ employee, onExecuting }: { employee: Employee | null; onExecuting: () => void }) {
  if (!employee) return null
  return (
    <div className="mt-4 p-4 rounded-xl" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
      <p className="text-sm text-white mb-3">已选：{employee.name} · ${employee.salary_amount} USDC</p>
      <button
        onClick={onExecuting}
        className="w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: '#6366f1', color: '#fff' }}
      >
        生成路由预览 →
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create RouteTimeline stub**

Create `frontend/src/features/employer/components/RouteTimeline.tsx`:
```tsx
import type { Employee, RouteStep } from '../../../store'
import TxLink from '../../shared/components/TxLink'

interface Props {
  steps: RouteStep[]
  employee: Employee
}

export default function RouteTimeline({ steps, employee }: Props) {
  if (steps.length === 0) {
    return <p style={{ color: '#94a3b8' }}>准备路由中...</p>
  }

  return (
    <div className="max-w-lg">
      <div className="relative pl-5">
        <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: '#2d3155' }} />
        {steps.map((step, i) => (
          <div key={i} className="relative mb-5 last:mb-0">
            <div
              className="absolute -left-3.5 top-1 w-3 h-3 rounded-full"
              style={{
                background: step.status === 'completed' ? '#10b981' : step.status === 'processing' ? '#f59e0b' : '#2d3155',
                border: step.status === 'pending' ? '1px solid #4b5563' : 'none',
              }}
            />
            <div
              className="text-sm font-semibold"
              style={{ color: step.status === 'pending' ? '#4b5563' : '#fff' }}
            >
              {step.label}
            </div>
            <div className="text-xs mt-0.5" style={{ color: step.status === 'processing' ? '#f59e0b' : '#94a3b8' }}>
              {step.description}
              {step.txHash && <span className="ml-2"><TxLink hash={step.txHash} /></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/employer/
git commit -m "feat: PayoutPage with ApproveCard, employee selection, RouteTimeline"
```

---

## Task 10: Li.Fi Route Preview + Execution

**Files:**
- Modify: `frontend/src/features/employer/pages/PayoutPage.tsx` (RoutePreviewSection)
- Modify: `frontend/src/features/employer/components/RouteTimeline.tsx`

- [ ] **Step 1: Implement route generation and execution in PayoutPage**

Replace the `RoutePreviewSection` function at the bottom of `frontend/src/features/employer/pages/PayoutPage.tsx`:
```tsx
import { getRoutes, executeRoute, type Route } from '@lifi/sdk'
import { parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useAppStore } from '../../../store'
import { USDC_BASE } from '../../../theme'
import { useContract } from '../../shared/hooks/useContract'

function RoutePreviewSection({ employee, onExecuting }: { employee: Employee | null; onExecuting: () => void }) {
  const { address } = useAccount()
  const { setRouteSteps, updateRouteStep } = useAppStore()
  const { executePayout } = useContract()
  const [lifiRoutes, setLifiRoutes] = useState<Route[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)

  if (!employee) return null

  async function fetchRoutes() {
    if (!address) return
    setLoadingRoutes(true)
    setRouteError(null)
    try {
      // Employee rules come from the contract — for now use placeholder split
      // In production, read rules from useGetRules(employee.wallet_address)
      // and call getRoutes once per rule
      const amount = parseUnits(employee.salary_amount, 6)
      const result = await getRoutes({
        fromChainId: 8453,
        toChainId: 8453,
        fromTokenAddress: USDC_BASE,
        toTokenAddress: USDC_BASE,
        fromAmount: amount.toString(),
        fromAddress: address,
        toAddress: employee.wallet_address as `0x${string}`,
      })
      setLifiRoutes(result.routes.slice(0, 1))
    } catch (e: any) {
      setRouteError(e.message ?? '路由获取失败')
    } finally {
      setLoadingRoutes(false)
    }
  }

  async function handleExecute() {
    if (!address || lifiRoutes.length === 0) return
    setExecuting(true)

    // Build initial timeline steps
    const initialSteps = lifiRoutes[0].steps.map((s, i) => ({
      label: `路由 ${i + 1} · ${s.toolDetails?.name ?? s.tool}`,
      status: 'pending' as const,
      description: `${s.action.fromAmount} → ${s.action.toChainId}`,
    }))
    setRouteSteps([
      { label: '从雇主拉取 USDC', status: 'pending', description: `$${employee.salary_amount} USDC · Base` },
      ...initialSteps,
    ])
    onExecuting()

    try {
      updateRouteStep(0, { status: 'processing', description: `$${employee.salary_amount} USDC · Base` })

      await executeRoute(lifiRoutes[0], {
        updateRouteHook(updatedRoute) {
          updatedRoute.steps.forEach((step, i) => {
            const idx = i + 1 // offset by 1 for the "pull USDC" step
            const execution = step.execution
            if (!execution) return
            const status = execution.status === 'DONE'
              ? 'completed'
              : execution.status === 'FAILED'
              ? 'failed'
              : 'processing'
            const txHash = execution.process?.find((p) => p.txHash)?.txHash
            updateRouteStep(idx, {
              status,
              txHash,
              description: status === 'processing' ? '桥接中...' : step.toolDetails?.name,
            })
          })
        },
      })

      updateRouteStep(0, { status: 'completed' })
    } catch (e: any) {
      updateRouteStep(0, { status: 'failed', description: e.message })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="mt-4 p-4 rounded-xl" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
      <p className="text-sm text-white mb-3">已选：{employee.name} · ${employee.salary_amount} USDC</p>

      {lifiRoutes.length === 0 ? (
        <>
          <button
            onClick={fetchRoutes}
            disabled={loadingRoutes}
            className="w-full py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: loadingRoutes ? '#4b5563' : '#6366f1', color: '#fff' }}
          >
            {loadingRoutes ? '获取路由中...' : '生成路由预览 →'}
          </button>
          {routeError && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{routeError}</p>}
        </>
      ) : (
        <>
          {/* Route preview */}
          <div className="mb-3 p-3 rounded-lg" style={{ background: '#252840' }}>
            {lifiRoutes[0].steps.map((s, i) => (
              <div key={i} className="flex justify-between text-xs py-1">
                <span style={{ color: '#94a3b8' }}>{s.toolDetails?.name ?? s.tool}</span>
                <span style={{ color: '#6366f1' }}>≈ ${s.estimate?.toAmountUSD ?? '—'}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="w-full py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: executing ? '#4b5563' : '#6366f1', color: '#fff' }}
          >
            {executing ? '执行中...' : '确认发薪'}
          </button>
        </>
      )}
    </div>
  )
}
```

> **Note for developer:** The `useState` and `useAccount` imports are already at the top of `PayoutPage.tsx`. Add `getRoutes`, `executeRoute`, `Route` to the import from `@lifi/sdk`, and `parseUnits` from `viem`. The `RoutePreviewSection` function must be defined inside the file scope but needs to use hooks, so it must remain a proper React component (capitalized, called with JSX).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/employer/pages/PayoutPage.tsx
git commit -m "feat: Li.Fi route generation and execution with timeline"
```

---

## Task 11: HistoryPage

**Files:**
- Modify: `frontend/src/features/employer/pages/HistoryPage.tsx`

- [ ] **Step 1: Implement history table**

Replace `frontend/src/features/employer/pages/HistoryPage.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import TxLink from '../../shared/components/TxLink'
import type { PayrollLog } from '../../../store'

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: '#10b98120', color: '#10b981', label: '完成' },
  processing: { bg: '#f59e0b20', color: '#f59e0b', label: '进行中' },
  pending: { bg: '#6366f120', color: '#6366f1', label: '待执行' },
  failed: { bg: '#ef444420', color: '#ef4444', label: '失败' },
}

export default function HistoryPage() {
  const { getPayrollLogs } = useBackend()
  const [logs, setLogs] = useState<PayrollLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPayrollLogs()
      setLogs(data)
    } catch { /* backend not ready */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h1 className="text-white text-xl font-bold mb-6">发薪记录</h1>
      {loading && <p style={{ color: '#94a3b8' }}>加载中...</p>}
      {!loading && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
          {logs.length === 0 ? (
            <div className="py-12 text-center" style={{ color: '#94a3b8' }}>暂无发薪记录</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #252840' }}>
                  {['时间', '员工', '金额', '状态', '交易'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const s = STATUS_STYLES[log.status] ?? STATUS_STYLES.pending
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #252840' }}>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#94a3b8' }}>
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-white">{log.employee_name}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#6366f1' }}>${log.amount} USDC</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {log.tx_hash ? <TxLink hash={log.tx_hash} /> : <span style={{ color: '#4b5563' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/employer/pages/HistoryPage.tsx
git commit -m "feat: HistoryPage with payroll log table"
```

---

## Task 12: Employee Page

**Files:**
- Modify: `frontend/src/features/employee/pages/EmployeePage.tsx`
- Create: `frontend/src/features/employee/components/RulesForm.tsx`
- Create: `frontend/src/features/employee/components/RulesDone.tsx`

- [ ] **Step 1: Create RulesDone component**

Create `frontend/src/features/employee/components/RulesDone.tsx`:
```tsx
import TxLink from '../../shared/components/TxLink'
import { SUPPORTED_CHAINS } from '../../../theme'

interface OnChainRule {
  chainId: bigint
  tokenAddress: `0x${string}`
  basisPoints: bigint
}

interface Props {
  rules: readonly OnChainRule[]
  txHash?: string
}

function chainName(id: bigint) {
  return SUPPORTED_CHAINS.find((c) => BigInt(c.id) === id)?.label ?? `Chain ${id}`
}

export default function RulesDone({ rules, txHash }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: '#10b98120' }}>
        ✅
      </div>
      <h2 className="text-white text-xl font-bold mb-2">规则已生效</h2>
      <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>链上存储 · 透明可验证</p>

      <div className="w-full max-w-sm rounded-xl p-4 mb-4 text-left" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>接收规则</p>
        {rules.map((rule, i) => (
          <div key={i} className="flex justify-between py-1.5" style={{ borderTop: i > 0 ? '1px solid #252840' : undefined }}>
            <span className="text-white text-sm">{Number(rule.basisPoints) / 100}%</span>
            <span className="text-sm" style={{ color: '#94a3b8' }}>
              {rule.tokenAddress === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'Token'} · {chainName(rule.chainId)}
            </span>
          </div>
        ))}
      </div>

      {txHash && (
        <div className="w-full max-w-sm rounded-xl p-4 text-left" style={{ background: '#1a1f35', border: '1px solid #2d3155' }}>
          <p className="text-xs mb-1" style={{ color: '#94a3b8' }}>链上交易</p>
          <TxLink hash={txHash} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create RulesForm component**

Create `frontend/src/features/employee/components/RulesForm.tsx`:
```tsx
import { useState } from 'react'
import { useContract } from '../../shared/hooks/useContract'
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../../../theme'

interface Rule {
  chainId: number
  tokenAddress: string
  percentage: number  // 1–100
}

interface Props {
  onSaved: (txHash: string) => void
}

const EMPTY_RULE: Rule = { chainId: 8453, tokenAddress: '0x0000000000000000000000000000000000000000', percentage: 0 }

export default function RulesForm({ onSaved }: Props) {
  const { setRules } = useContract()
  const [rules, setRulesState] = useState<Rule[]>([{ ...EMPTY_RULE, percentage: 100 }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = rules.reduce((sum, r) => sum + Number(r.percentage), 0)
  const canSubmit = total === 100 && rules.length > 0

  function addRule() {
    if (rules.length >= 5) return
    setRulesState([...rules, { ...EMPTY_RULE, percentage: 0 }])
  }

  function removeRule(i: number) {
    setRulesState(rules.filter((_, idx) => idx !== i))
  }

  function updateRule(i: number, field: keyof Rule, value: string | number) {
    const updated = [...rules]
    updated[i] = { ...updated[i], [field]: value }
    setRulesState(updated)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const contractRules = rules.map((r) => ({
        chainId: BigInt(r.chainId),
        tokenAddress: r.tokenAddress as `0x${string}`,
        basisPoints: BigInt(Math.round(r.percentage * 100)),  // 40% → 4000
      }))
      const txHash = await setRules(contractRules)
      onSaved(txHash)
    } catch (e: any) {
      setError(e.shortMessage ?? e.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const selectStyle = {
    background: '#252840',
    border: '1px solid #2d3155',
    borderRadius: 6,
    color: '#fff',
    padding: '6px 10px',
    fontSize: 12,
    flex: 1,
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <h2 className="text-white text-xl font-bold mb-1">设置接收规则</h2>
      <p className="text-sm mb-1" style={{ color: '#f59e0b' }}>⚠ 规则设置后不可修改，请仔细确认</p>
      <p className="text-xs mb-6" style={{ color: '#94a3b8' }}>最多添加 5 条规则，比例总和必须等于 100%</p>

      <div className="flex flex-col gap-3 mb-4">
        {rules.map((rule, i) => {
          const tokens = SUPPORTED_TOKENS[rule.chainId] ?? []
          return (
            <div key={i} className="rounded-xl p-3" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
              <div className="flex items-center mb-2">
                <span className="text-xs" style={{ color: '#94a3b8' }}>规则 {i + 1}</span>
                {rules.length > 1 && (
                  <button onClick={() => removeRule(i)} className="ml-auto text-xs" style={{ color: '#ef4444' }}>✕</button>
                )}
              </div>
              <div className="flex gap-2">
                <select style={selectStyle} value={rule.chainId} onChange={e => { updateRule(i, 'chainId', Number(e.target.value)); updateRule(i, 'tokenAddress', '0x0000000000000000000000000000000000000000') }}>
                  {SUPPORTED_CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select style={selectStyle} value={rule.tokenAddress} onChange={e => updateRule(i, 'tokenAddress', e.target.value)}>
                  {tokens.map(t => <option key={t.symbol} value={t.address}>{t.symbol}</option>)}
                </select>
                <div className="flex items-center gap-1" style={{ flex: 1 }}>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={rule.percentage}
                    onChange={e => updateRule(i, 'percentage', Number(e.target.value))}
                    style={{ ...selectStyle, flex: 1, width: 60 }}
                  />
                  <span className="text-xs" style={{ color: '#6366f1' }}>%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center mb-6">
        {rules.length < 5 && (
          <button onClick={addRule} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: '#1a1f35', color: '#6366f1', border: '1px dashed #2d3155' }}>
            + 添加规则
          </button>
        )}
        <div className="ml-auto text-sm font-semibold" style={{ color: total === 100 ? '#10b981' : '#ef4444' }}>
          总计 {total}% {total === 100 ? '✓' : '≠ 100%'}
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full py-3 rounded-xl text-sm font-semibold"
        style={{ background: canSubmit && !submitting ? '#6366f1' : '#252840', color: canSubmit && !submitting ? '#fff' : '#4b5563' }}
      >
        {submitting ? '写入合约中...' : '确认并写入合约'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Implement EmployeePage with 3-state logic**

Replace `frontend/src/features/employee/pages/EmployeePage.tsx`:
```tsx
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useBackend } from '../../shared/hooks/useBackend'
import { useGetRules } from '../../shared/hooks/useContract'
import TopNav from '../../shared/components/TopNav'
import RulesForm from '../components/RulesForm'
import RulesDone from '../components/RulesDone'
import type { Employee } from '../../../store'

type EmployeeState = 'connecting' | 'checking' | 'not-found' | 'setup' | 'done'

export default function EmployeePage() {
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { getEmployeeByWallet } = useBackend()

  const [state, setState] = useState<EmployeeState>('connecting')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [savedTxHash, setSavedTxHash] = useState<string | undefined>()

  // Read on-chain rules
  const { data: onChainRules } = useGetRules(address)
  const hasOnChainRules = onChainRules && onChainRules.length > 0

  useEffect(() => {
    if (!isConnected || !address) {
      setState('connecting')
      return
    }
    setState('checking')
    getEmployeeByWallet(address).then((emp) => {
      if (!emp) {
        setState('not-found')
      } else {
        setEmployee(emp)
        // Check on-chain rules (useGetRules handles this reactively)
      }
    }).catch(() => setState('not-found'))
  }, [isConnected, address])

  // React to on-chain rules loading
  useEffect(() => {
    if (!employee) return
    if (hasOnChainRules) {
      setState('done')
    } else {
      setState('setup')
    }
  }, [employee, hasOnChainRules])

  function handleRulesSaved(txHash: string) {
    setSavedTxHash(txHash)
    setState('done')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1117' }}>
      <TopNav />
      <div className="flex-1">
        {state === 'connecting' && (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-white text-xl font-bold mb-2">连接钱包以继续</h2>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>系统将自动验证你是否为已注册员工</p>
            <button
              onClick={() => openConnectModal?.()}
              className="px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#6366f1', color: '#fff' }}
            >
              连接钱包
            </button>
          </div>
        )}

        {state === 'checking' && (
          <div className="flex items-center justify-center py-24">
            <p style={{ color: '#94a3b8' }}>验证身份中...</p>
          </div>
        )}

        {state === 'not-found' && (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-white text-xl font-bold mb-2">未找到你的档案</h2>
            <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
              钱包地址 <span className="font-mono" style={{ color: '#6366f1' }}>{address?.slice(0, 6)}...{address?.slice(-4)}</span> 尚未被添加到系统中
            </p>
            <div className="p-4 rounded-xl text-sm max-w-xs" style={{ background: '#1e2030', border: '1px solid #2d3155', color: '#94a3b8' }}>
              请联系你的雇主将你的钱包地址添加到 ChainPay 系统后再试
            </div>
          </div>
        )}

        {state === 'setup' && <RulesForm onSaved={handleRulesSaved} />}

        {state === 'done' && onChainRules && (
          <RulesDone rules={onChainRules} txHash={savedTxHash} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify employee page renders all 3 states**

```bash
npm run dev
```
Visit `http://localhost:5173/employee`:
- Without wallet: shows "连接钱包以继续"
- Connect a wallet not in the backend: shows "未找到你的档案"
- Connect the registered employee wallet: shows RulesForm

- [ ] **Step 5: Final commit**

```bash
git add frontend/src/features/employee/
git commit -m "feat: EmployeePage with 3-state logic, RulesForm, RulesDone"
```

---

## Task 13: Final Wiring & Build Check

**Files:** No new files — verify everything compiles and runs.

- [ ] **Step 1: Add .superpowers to .gitignore**

```bash
echo ".superpowers/" >> /Users/yuehongshu/Documents/dev-Claude/Projects/ChainPay/.gitignore
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors (or only warnings about unused variables).

- [ ] **Step 3: Production build check**

```bash
npm run build
```
Expected: `dist/` created with no errors.

- [ ] **Step 4: Final smoke test**

```bash
npm run dev
```
Check each route loads without console errors:
- `http://localhost:5173` → Landing page
- `http://localhost:5173/employer/employees` → Sidebar + employee list
- `http://localhost:5173/employer/payout` → Payout page
- `http://localhost:5173/employer/history` → History table
- `http://localhost:5173/employee` → Connect wallet prompt

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: frontend complete — all pages wired, build passing"
```

---

## Notes for Developer

**Java 类比：**
- `useEffect` ≈ Spring `@PostConstruct` — 组件加载后执行
- `useState` ≈ 普通 Java 字段，但修改后 UI 自动刷新
- Zustand store ≈ Spring Singleton Bean，全局共享状态
- wagmi hooks ≈ 自动管理 async 状态的工具类（带 loading/error/data）

**后端未启动时：**
前端可以独立运行，所有 `useBackend` 调用失败会静默处理（catch 块）。连接钱包和 Li.Fi SDK 路由生成不依赖后端。

**合约未部署时：**
在 `.env.local` 里 `VITE_CHAIN_PAY_CONTRACT` 保持占位符地址，合约调用会失败但不影响页面渲染。等合约部署后填入真实地址即可。

**WalletConnect Project ID：**
本地开发 `chainpay-hackathon` 占位符即可。正式发布前去 [cloud.walletconnect.com](https://cloud.walletconnect.com) 创建真实 ID。
