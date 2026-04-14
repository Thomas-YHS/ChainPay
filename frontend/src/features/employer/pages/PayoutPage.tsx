import { useState, useEffect, useCallback } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import { useBackend } from '../../shared/hooks/useBackend'
import { useEnsureAllowance } from '../../shared/hooks/useEnsureAllowance'
import TxLink from '../../shared/components/TxLink'
import type { Employee } from '../../../store'
import { PAY_FREQUENCY_LABELS, USDC_BASE } from '../../../theme'

type PayoutState = 'idle' | 'executing' | 'success' | 'error'

const BASE_CHAIN_ID = 8453

export default function PayoutPage() {
  const { address } = useAccount()
  const { getEmployees, triggerPayout, confirmPayout } = useBackend()
  const { sendTransactionAsync } = useSendTransaction()
  const { ensureAllowance } = useEnsureAllowance()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [state, setState] = useState<PayoutState>('idle')
  const [txHashes, setTxHashes] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState<string | undefined>()

  const load = useCallback(async () => {
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch { /* backend not ready */ }
  }, [])

  useEffect(() => { load() }, [load])

  // 发薪流程（雇主钱包直发）：
  //  1. 前端调后端获取员工分账规则
  //  2. 前端直接调 LiFi API 获取跨链路由报价（fromAddress = 雇主钱包）
  //  3. wagmi sendTransaction 让雇主签名广播交易（LiFi 自动完成 USDC 授权 + 跨链兑换 + 发送）
  //  4. 前端通知后端记录 tx_hash
  async function handlePayout() {
    if (!selected || !address) return
    setState('executing')
    setTxHashes([])
    setErrorMsg(undefined)
    try {
      // 步骤 1: 获取规则
      const { log_id, rules } = await triggerPayout(selected.wallet_address)

      const hashes: string[] = []
      // 步骤 2-3: 对每条规则分别调用 LiFi + 雇主签名广播
      for (const rule of rules) {
        const salaryUsdc = parseFloat(selected.salary_amount)
        const ruleAmount = Math.floor(salaryUsdc * parseInt(rule.percentage) / 10000 * 1e6)

        // 调用 LiFi API 获取 quote
        const lifiRes = await fetch(
          `https://li.quest/v1/quote?fromChain=${BASE_CHAIN_ID}&toChain=${parseInt(rule.chainId)}&fromToken=${USDC_BASE}&toToken=${rule.tokenAddress}&fromAddress=${address}&toAddress=${selected.wallet_address}&fromAmount=${ruleAmount}`
        )
        if (!lifiRes.ok) throw new Error(`LiFi API error: ${lifiRes.status}`)
        const lifiData = await lifiRes.json()
        const txReq = lifiData.transactionRequest

        // 步骤 2.5: 确保 Li.Fi 有足够 USDC 授权额度（用 quote 返回的精确金额和 token 地址）
        if (lifiData.estimate?.approvalAddress) {
          await ensureAllowance(
            USDC_BASE as `0x${string}`,
            lifiData.estimate.approvalAddress as `0x${string}`,
            BigInt(lifiData.action.fromAmount)
          )
        }

        // wagmi 让雇主钱包签名广播（完整透传 transactionRequest，保留 Li.Fi 的 gas 定价）
        const txHash = await sendTransactionAsync({
          to: txReq.to,
          data: txReq.data,
          value: BigInt(txReq.value || '0'),
          gas: txReq.gasLimit ? BigInt(txReq.gasLimit) : undefined,
          gasPrice: txReq.gasPrice ? BigInt(txReq.gasPrice) : undefined,
          maxFeePerGas: txReq.maxFeePerGas ? BigInt(txReq.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: txReq.maxPriorityFeePerGas ? BigInt(txReq.maxPriorityFeePerGas) : undefined,
        })
        hashes.push(txHash)

        // 步骤 4: 通知后端记录 tx_hash
        await confirmPayout(log_id, txHash)
      }

      setTxHashes(hashes)
      setState('success')
    } catch (e: any) {
      setErrorMsg(e.message ?? '发薪失败')
      setState('error')
    }
  }

  function reset() {
    setState('idle')
    setTxHashes([])
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
              发薪中，请在钱包中确认签名...
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm" style={{ color: '#10b981' }}>
                <span>✅ 发薪已提交</span>
                <span style={{ color: '#94a3b8' }}>· LiFi 正在路由中</span>
              </div>
              {txHashes.map((hash, i) => (
                <div key={i} className="p-3 rounded-lg text-sm" style={{ background: '#1a1f35', border: '1px solid #2d3155' }}>
                  <span style={{ color: '#94a3b8' }}>交易 {i + 1}：</span>
                  <TxLink hash={hash} />
                </div>
              ))}
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
