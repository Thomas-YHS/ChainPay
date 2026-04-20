import { create } from 'zustand'

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
  auto_invest_enabled: boolean
  auto_invest_vault_id: string
  auto_invest_type: string
  auto_invest_value: string
  next_pay_date: string
  created_at: string
}

export interface Vault {
  id: string
  protocol: string
  name: string
  chainId: number
  tokenAddress: string
  apy: string
  tvlUsd: string
  availableFunds: string
  tags: string[]
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

interface AppStore {
  role: 'employer' | 'employee' | null
  setRole: (role: 'employer' | 'employee') => void
}

export const useAppStore = create<AppStore>((set) => ({
  role: null,
  setRole: (role) => set({ role }),
}))
