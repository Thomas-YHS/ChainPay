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
