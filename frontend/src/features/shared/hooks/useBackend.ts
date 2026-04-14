import { useAccount } from 'wagmi'
import { API_URL } from '../../../theme'
import type { Employee, PayrollLog, Vault } from '../../../store'

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
    const res = await fetch(`${API_URL}/payroll/logs`, { headers: headers() })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data.logs ?? []
  }

  async function getVaults(): Promise<Vault[]> {
    const res = await fetch(`${API_URL}/vaults`)
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data.vaults ?? []
  }

  async function getAutoInvest(wallet: string) {
    const res = await fetch(`${API_URL}/employees/${wallet}/auto-invest`, { headers: headers() })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data
  }

  async function updateAutoInvest(wallet: string, data: {
    enabled: boolean
    vault_id: string
    invest_type: string
    invest_value: string
  }) {
    const res = await fetch(`${API_URL}/employees/${wallet}/auto-invest`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data
  }

  async function triggerPayout(employeeWallet: string): Promise<{ log_id: number; rules: { chainId: string; tokenAddress: string; percentage: string }[] }> {
    const res = await fetch(`${API_URL}/payroll/execute`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ employee_wallet: employeeWallet }),
    })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data
  }

  async function confirmPayout(logId: number, txHash: string): Promise<void> {
    const res = await fetch(`${API_URL}/payroll/${logId}/confirm`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ tx_hash: txHash }),
    })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
  }

  async function getRulesMode(): Promise<'chain' | 'backend'> {
    const res = await fetch(`${API_URL}/config/rules-mode`)
    const json = await res.json()
    if (json.code !== 200) return 'chain' // 默认回退到 chain
    return json.data.mode as 'chain' | 'backend'
  }

  async function saveRules(wallet: string, rules: { chain_id: number; token_address: string; percentage: number }[]): Promise<void> {
    const res = await fetch(`${API_URL}/employees/${wallet}/rules`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(rules),
    })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
  }

  return { getEmployees, getEmployeeByWallet, addEmployee, getPayrollLogs, getVaults, getAutoInvest, updateAutoInvest, triggerPayout, confirmPayout, getRulesMode, saveRules }
}
