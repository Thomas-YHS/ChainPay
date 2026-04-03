import { useState } from 'react'
import { useContract } from '../../shared/hooks/useContract'
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../../../theme'

interface Rule {
  chainId: number
  tokenAddress: string
  percentage: number
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
        basisPoints: BigInt(Math.round(r.percentage * 100)),
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
                <select
                  style={selectStyle}
                  value={rule.chainId}
                  onChange={e => {
                    updateRule(i, 'chainId', Number(e.target.value))
                    updateRule(i, 'tokenAddress', '0x0000000000000000000000000000000000000000')
                  }}
                >
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
                    style={{ ...selectStyle, flex: 1 }}
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
