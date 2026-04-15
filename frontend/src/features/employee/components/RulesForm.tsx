import { useState } from 'react'
import { useContract } from '../../shared/hooks/useContract'
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../../../theme'
import { colors } from '../../../styles/tokens'

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

  return (
    <div className="mx-auto max-w-[760px] py-8 px-4">
      <div className="mb-6">
        <h2 className="text-h2 font-medium text-text-primary">设置接收规则</h2>
        <p className="mt-1 text-body-sm font-light text-status-warning">⚠ 规则设置后不可修改，请仔细确认</p>
        <p className="mt-1 text-caption font-medium text-text-secondary">最多添加 5 条规则，比例总和必须等于 100%</p>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        {rules.map((rule, i) => {
          const tokens = SUPPORTED_TOKENS[rule.chainId] ?? []
          return (
            <div key={i} className="cp-card rounded-xl p-4">
              <div className="mb-2 flex items-center">
                <span className="text-caption font-medium text-text-secondary">规则 {i + 1}</span>
                {rules.length > 1 && (
                  <button onClick={() => removeRule(i)} className="ml-auto min-h-touch px-2 text-body-sm font-medium text-status-error transition-colors duration-normal ease-standard hover:opacity-80">✕</button>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className="min-h-touch w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-body-sm font-light text-text-primary"
                  value={rule.chainId}
                  onChange={e => {
                    updateRule(i, 'chainId', Number(e.target.value))
                    updateRule(i, 'tokenAddress', '0x0000000000000000000000000000000000000000')
                  }}
                >
                  {SUPPORTED_CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select className="min-h-touch w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-body-sm font-light text-text-primary" value={rule.tokenAddress} onChange={e => updateRule(i, 'tokenAddress', e.target.value)}>
                  {tokens.map(t => <option key={t.symbol} value={t.address}>{t.symbol}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={rule.percentage}
                    onChange={e => updateRule(i, 'percentage', Number(e.target.value))}
                    className="min-h-touch w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-body-sm font-light text-text-primary"
                  />
                  <span className="text-h4 font-medium text-brand-primary">%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mb-6 flex items-center">
        {rules.length < 5 && (
          <button onClick={addRule} className="min-h-touch rounded-lg border border-border-interactive bg-surface-card px-3 py-1.5 text-button-sm font-light text-brand-primary transition-colors duration-normal ease-standard hover:border-border-interactive-strong">
            + 添加规则
          </button>
        )}
        <div className="ml-auto text-body-sm font-medium" style={{ color: total === 100 ? colors.status.success : colors.status.error }}>
          总计 {total}% {total === 100 ? '✓' : '≠ 100%'}
        </div>
      </div>

      {error && <p className="mb-3 text-body-sm font-light text-status-error">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="min-h-touch w-full rounded-xl bg-brand-primary py-3 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-text-muted disabled:shadow-none"
      >
        {submitting ? '写入合约中...' : '确认并写入合约'}
      </button>
    </div>
  )
}
