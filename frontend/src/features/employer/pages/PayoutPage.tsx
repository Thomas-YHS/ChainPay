import { useState, useEffect, useCallback } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import TxLink from '../../shared/components/TxLink'
import type { Employee } from '../../../store'
import { PAY_FREQUENCY_LABELS } from '../../../theme'

type PayoutState = 'idle' | 'executing' | 'success' | 'error'

export default function PayoutPage() {
  const { getEmployees, triggerPayout } = useBackend()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [state, setState] = useState<PayoutState>('idle')
  const [txHash, setTxHash] = useState<string | undefined>()
  const [errorMsg, setErrorMsg] = useState<string | undefined>()

  const load = useCallback(async () => {
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch { /* backend not ready */ }
  }, [])

  useEffect(() => { load() }, [load])

  // 发薪流程（Pure Composer）：
  //  1. 后端读取员工配置的接收规则
  //  2. 后端调用 LiFi API 获取跨链路由报价
  //  3. 后端钱包签名并广播交易（LiFi 自动完成 USDC 授权 + 跨链兑换 + 发送）
  async function handlePayout() {
    if (!selected) return
    setState('executing')
    setTxHash(undefined)
    setErrorMsg(undefined)
    try {
      const result = await triggerPayout(selected.wallet_address)
      setTxHash(result.tx_hash)
      setState('success')
    } catch (e: any) {
      setErrorMsg(e.message ?? '发薪失败')
      setState('error')
    }
  }

  function reset() {
    setState('idle')
    setTxHash(undefined)
    setErrorMsg(undefined)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-white text-xl font-bold mb-6">发薪</h1>

      <h2 className="text-sm font-semibold mb-3" style={{ color: '#94a3b8' }}>选择员工</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {employees.map((emp) => {
          const disabled = !emp.has_rules
          const isSelected = selected?.id === emp.id
          return (
            <button
              key={emp.id}
              disabled={disabled}
              onClick={() => { setSelected(isSelected ? null : emp); reset() }}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: isSelected ? '#1e2030' : '#1a1f35',
                border: isSelected ? '1px solid #6366f1' : '1px solid #2d3155',
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

      {employees.length === 0 && (
        <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>暂无员工，请先在员工管理页添加员工</p>
      )}

      {selected && (
        <div className="rounded-xl p-4" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
          <p className="text-sm text-white mb-4">
            已选：<span className="font-semibold">{selected.name}</span>
            <span className="ml-2" style={{ color: '#94a3b8' }}>· ${selected.salary_amount} USDC</span>
          </p>

          {state === 'idle' && (
            <button
              onClick={handlePayout}
              className="w-full py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: '#6366f1', color: '#fff' }}
            >
              确认发薪
            </button>
          )}

          {state === 'executing' && (
            <div className="w-full py-2.5 rounded-lg text-sm text-center" style={{ background: '#4b5563', color: '#fff' }}>
              发薪中，等待后端签名广播...
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm" style={{ color: '#10b981' }}>
                <span>✅ 发薪已提交</span>
                <span style={{ color: '#94a3b8' }}>· 后端正在等待链上确认</span>
              </div>
              {txHash && (
                <div className="p-3 rounded-lg text-sm" style={{ background: '#1a1f35', border: '1px solid #2d3155' }}>
                  <span style={{ color: '#94a3b8' }}>交易哈希：</span>
                  <TxLink hash={txHash} />
                </div>
              )}
              <button
                onClick={reset}
                className="w-full py-2 rounded-lg text-sm"
                style={{ background: '#1a1f35', border: '1px solid #2d3155', color: '#94a3b8' }}
              >
                继续发薪
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: '#ef4444' }}>❌ {errorMsg}</p>
              <button
                onClick={reset}
                className="w-full py-2 rounded-lg text-sm"
                style={{ background: '#1a1f35', border: '1px solid #2d3155', color: '#94a3b8' }}
              >
                重试
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
