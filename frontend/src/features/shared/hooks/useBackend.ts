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

  async function triggerPayout(employeeWallet: string): Promise<{ tx_hash: string; status: string; log_id: number }> {
    const res = await fetch(`${API_URL}/payroll/execute`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ employee_wallet: employeeWallet }),
    })
    const json = await res.json()
    if (json.code !== 200) throw new Error(json.message)
    return json.data
  }

  return { getEmployees, getEmployeeByWallet, addEmployee, getPayrollLogs, getVaults, getAutoInvest, updateAutoInvest, triggerPayout }
}
