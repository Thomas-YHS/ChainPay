import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useBackend } from '../../shared/hooks/useBackend'
import TopNav from '../../shared/components/TopNav'
import RulesForm from '../components/RulesForm'
import RulesDone from '../components/RulesDone'
import AutoInvestModal from '../components/AutoInvestModal'
import type { Employee } from '../../../store'

type EmployeeState = 'connecting' | 'checking' | 'not-found' | 'setup' | 'done'

export default function EmployeePage() {
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { getEmployeeByWallet } = useBackend()

  const [state, setState] = useState<EmployeeState>('connecting')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [savedTxHash, setSavedTxHash] = useState<string | undefined>()
  const [showAutoInvest, setShowAutoInvest] = useState(false)

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
        setState(emp.has_rules ? 'done' : 'setup')
      }
    }).catch(() => setState('not-found'))
  }, [isConnected, address])

  function handleRulesSaved(txHash: string) {
    setSavedTxHash(txHash)
    setState('done')
  }

  return (
    <div className="cp-shell flex min-h-screen flex-col">
      <TopNav />
      <div className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 md:px-8">
        {state === 'connecting' && (
          <div className="cp-card mx-auto flex max-w-[560px] flex-col items-center justify-center px-4 py-20 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="mb-2 text-h2 font-medium text-text-primary">连接钱包以继续</h2>
            <p className="mb-6 text-body-sm font-light text-text-secondary">系统将自动验证你是否为已注册员工</p>
            <button
              onClick={() => openConnectModal?.()}
              className="min-h-touch rounded-xl bg-brand-primary px-6 py-3 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover"
            >
              连接钱包
            </button>
          </div>
        )}

        {state === 'checking' && (
          <div className="cp-card mx-auto flex max-w-[560px] items-center justify-center py-20">
            <p className="text-body-sm font-light text-text-secondary">验证身份中...</p>
          </div>
        )}

        {state === 'not-found' && (
          <div className="cp-card mx-auto flex max-w-[560px] flex-col items-center justify-center px-4 py-20 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="mb-2 text-h2 font-medium text-text-primary">未找到你的档案</h2>
            <p className="mb-4 text-body-sm font-light text-text-secondary">
              钱包地址 <span className="cp-text-code text-brand-primary">{address?.slice(0, 6)}...{address?.slice(-4)}</span> 尚未被添加到系统中
            </p>
            <div className="max-w-xs rounded-xl border border-border bg-surface-canvas p-4 text-body-sm font-light text-text-secondary">
              请联系你的雇主将你的钱包地址添加到 ChainPay 系统后再试
            </div>
          </div>
        )}

        {state === 'setup' && <RulesForm onSaved={handleRulesSaved} />}

        {state === 'done' && (
          <>
            <RulesDone txHash={savedTxHash} />
            <div className="mx-auto mt-6 w-full max-w-[560px]">
              <button
                onClick={() => setShowAutoInvest(true)}
                className="min-h-touch w-full rounded-xl border border-border-interactive bg-surface-card py-3 text-body-sm font-light text-brand-primary shadow-sm transition-colors duration-normal ease-standard hover:border-border-interactive-strong"
              >
                💰 配置自动定投理财
              </button>
            </div>
          </>
        )}

        {showAutoInvest && employee && (
          <AutoInvestModal
            wallet={employee.wallet_address}
            currentEnabled={employee.auto_invest_enabled}
            currentVaultID={employee.auto_invest_vault_id}
            currentInvestType={employee.auto_invest_type}
            currentInvestValue={employee.auto_invest_value}
            salaryAmount={employee.salary_amount}
            onClose={() => setShowAutoInvest(false)}
            onSaved={() => {}}
          />
        )}
      </div>
    </div>
  )
}
