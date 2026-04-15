import { useState, useEffect } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import type { Vault } from '../../../store'
import { colors } from '../../../styles/tokens'

interface AutoInvestModalProps {
  wallet: string
  currentEnabled: boolean
  currentVaultID: string
  currentInvestType: string
  currentInvestValue: string
  salaryAmount: string
  onClose: () => void
  onSaved: () => void
}

export default function AutoInvestModal({
  wallet,
  currentEnabled,
  currentVaultID,
  currentInvestType,
  currentInvestValue,
  salaryAmount,
  onClose,
  onSaved,
}: AutoInvestModalProps) {
  const { getVaults, updateAutoInvest } = useBackend()
  const [vaults, setVaults] = useState<Vault[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(currentEnabled)
  const [selectedVault, setSelectedVault] = useState<Vault | null>(
    currentVaultID ? { id: currentVaultID, protocol: '', name: '', chainId: 8453, tokenAddress: '', apy: '', tvlUsd: '', availableFunds: '', tags: [] } : null
  )
  const [investType, setInvestType] = useState(currentInvestType || 'percentage')
  const [investValue, setInvestValue] = useState(currentInvestValue || '1000')

  useEffect(() => {
    setLoading(true)
    getVaults().then(setVaults).finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await updateAutoInvest(wallet, {
        enabled,
        vault_id: enabled ? (selectedVault?.id ?? '') : '',
        invest_type: enabled ? investType : '',
        invest_value: enabled ? investValue : '0',
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/60 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-6 shadow-md">
        <h2 className="text-h2 font-medium text-text-primary">开启定投理财</h2>
        <p className="mb-4 text-body-sm font-light text-text-secondary">
          每次收到薪资，自动将 {investType === 'percentage' ? `${(Number(investValue) / 100).toFixed(1)}%` : `${investValue} USDC`} 存入收益 vault
        </p>

        <label className="mb-4 flex cursor-pointer items-center gap-3">
          <div
            onClick={() => setEnabled(!enabled)}
            className="flex h-6 w-10 items-center rounded-full transition-colors duration-normal ease-standard"
            style={{ background: enabled ? colors.brand.primary : colors.border.default }}
          >
            <div className="mx-1 h-4 w-4 rounded-full bg-text-inverse transition-transform duration-normal ease-standard" style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }} />
          </div>
          <span className="text-body-sm font-medium text-text-primary">启用自动定投</span>
        </label>

        {enabled && (
          <>
            <div className="mb-4">
              <label className="mb-2 block text-caption font-medium text-text-secondary">选择 Vault</label>
              {loading ? (
                <p className="text-body-sm font-light text-text-secondary">加载中...</p>
              ) : vaults.length === 0 ? (
                <p className="text-body-sm font-light text-text-secondary">暂无可用 vault</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {vaults.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVault(v)}
                      className="cursor-pointer rounded-lg border p-3 transition-colors duration-normal ease-standard"
                      style={{
                        background: selectedVault?.id === v.id ? 'rgba(99, 102, 241, 0.08)' : colors.surface.card,
                        border: selectedVault?.id === v.id ? '1px solid rgba(99, 102, 241, 0.45)' : `1px solid ${colors.border.default}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm font-medium text-text-primary">{v.name}</span>
                        <span className="text-body-sm font-medium text-status-success">{v.apy}</span>
                      </div>
                      <div className="mt-1 text-caption font-medium text-text-secondary">
                        {v.protocol} · TVL ${v.tvlUsd}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-caption font-medium text-text-secondary">定投方式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInvestType('percentage')}
                  className="min-h-touch flex-1 rounded-lg border px-4 py-2 text-button-sm font-light transition-colors duration-normal ease-standard"
                  style={{ background: investType === 'percentage' ? colors.brand.primary : colors.surface.card, color: investType === 'percentage' ? colors.text.inverse : colors.text.primary, borderColor: investType === 'percentage' ? colors.brand.primary : colors.border.default }}
                >
                  百分比
                </button>
                <button
                  onClick={() => setInvestType('fixed')}
                  className="min-h-touch flex-1 rounded-lg border px-4 py-2 text-button-sm font-light transition-colors duration-normal ease-standard"
                  style={{ background: investType === 'fixed' ? colors.brand.primary : colors.surface.card, color: investType === 'fixed' ? colors.text.inverse : colors.text.primary, borderColor: investType === 'fixed' ? colors.brand.primary : colors.border.default }}
                >
                  固定金额
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-caption font-medium text-text-secondary">
                {investType === 'percentage' ? '占比（基点，1000 = 10%）' : '金额（USDC）'}
              </label>
              <input
                type="number"
                value={investValue}
                onChange={(e) => setInvestValue(e.target.value)}
                className="min-h-touch w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-body-sm font-light text-text-primary"
                placeholder={investType === 'percentage' ? '1000' : '50'}
              />
              {investType === 'percentage' && (
                <p className="mt-1 text-caption font-medium text-text-secondary">
                  薪资 {salaryAmount} USDC 的 {(Number(investValue) / 100).toFixed(1)}% ≈ {((Number(salaryAmount) * Number(investValue)) / 10000).toFixed(2)} USDC
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="min-h-touch flex-1 rounded-lg border border-border-interactive bg-surface-card px-4 py-2 text-button-sm font-light text-text-secondary transition-colors duration-normal ease-standard hover:border-border-interactive-strong"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (enabled && !selectedVault)}
            className="min-h-touch flex-1 rounded-lg bg-brand-primary px-4 py-2 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
