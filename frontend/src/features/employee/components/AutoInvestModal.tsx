import { useState, useEffect } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import type { Vault } from '../../../store'

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
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <h2 className="text-white text-lg font-bold mb-1">开启定投理财</h2>
        <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
          每次收到薪资，自动将 {investType === 'percentage' ? `${(Number(investValue) / 100).toFixed(1)}%` : `${investValue} USDC`} 存入收益 vault
        </p>

        {/* Enable toggle */}
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <div
            onClick={() => setEnabled(!enabled)}
            className="w-10 h-6 rounded-full transition-colors flex items-center"
            style={{ background: enabled ? '#6366f1' : '#374151' }}
          >
            <div className="w-4 h-4 rounded-full bg-white mx-1 transition-transform" style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }} />
          </div>
          <span className="text-sm text-white">启用自动定投</span>
        </label>

        {enabled && (
          <>
            {/* Vault selector */}
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: '#94a3b8' }}>选择 Vault</label>
              {loading ? (
                <p style={{ color: '#94a3b8' }}>加载中...</p>
              ) : vaults.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>暂无可用 vault</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {vaults.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVault(v)}
                      className="p-3 rounded-lg cursor-pointer transition-colors"
                      style={{
                        background: selectedVault?.id === v.id ? '#2d3155' : '#16171f',
                        border: selectedVault?.id === v.id ? '1px solid #6366f1' : '1px solid #2d3155',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium">{v.name}</span>
                        <span className="text-sm font-bold" style={{ color: '#22c55e' }}>{v.apy}</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: '#64748b' }}>
                        {v.protocol} · TVL ${v.tvlUsd}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy type */}
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: '#94a3b8' }}>定投方式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInvestType('percentage')}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: investType === 'percentage' ? '#6366f1' : '#16171f', color: '#fff', border: '1px solid #2d3155' }}
                >
                  百分比
                </button>
                <button
                  onClick={() => setInvestType('fixed')}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: investType === 'fixed' ? '#6366f1' : '#16171f', color: '#fff', border: '1px solid #2d3155' }}
                >
                  固定金额
                </button>
              </div>
            </div>

            {/* Value input */}
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: '#94a3b8' }}>
                {investType === 'percentage' ? '占比（基点，1000 = 10%）' : '金额（USDC）'}
              </label>
              <input
                type="number"
                value={investValue}
                onChange={(e) => setInvestValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: '#16171f', color: '#fff', border: '1px solid #2d3155', outline: 'none' }}
                placeholder={investType === 'percentage' ? '1000' : '50'}
              />
              {investType === 'percentage' && (
                <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                  薪资 {salaryAmount} USDC 的 {(Number(investValue) / 100).toFixed(1)}% ≈ {((Number(salaryAmount) * Number(investValue)) / 10000).toFixed(2)} USDC
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: '#16171f', color: '#94a3b8', border: '1px solid #2d3155' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (enabled && !selectedVault)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: '#6366f1' }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
