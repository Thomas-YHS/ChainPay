import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { getEmployeeByWallet, getRulesMode } = useBackend()

  // 断开连接时跳转到首页
  useEffect(() => {
    if (!isConnected) navigate('/')
  }, [isConnected, navigate])

  const [state, setState] = useState<EmployeeState>('connecting')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [savedTxHash, setSavedTxHash] = useState<string | undefined>()
  const [showAutoInvest, setShowAutoInvest] = useState(false)
  const [rulesMode, setRulesMode] = useState<'chain' | 'backend'>('chain')

  useEffect(() => {
    getRulesMode().then(setRulesMode)
  }, [])

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

        {state === 'done' && (
          <>
            <RulesDone txHash={savedTxHash} mode={rulesMode} />
            <div className="mt-4 px-4 max-w-md mx-auto">
              <button
                onClick={() => navigate('/employee/earn')}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#1e2030', border: '1px solid #10b981', color: '#10b981' }}
              >
                📈 Earn 收益 — 存入 vault 赚取利息
              </button>
            </div>
            <div className="mt-6">
              <button
                onClick={() => setShowAutoInvest(true)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#1e2030', border: '1px solid #6366f1', color: '#a5b4fc' }}
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
