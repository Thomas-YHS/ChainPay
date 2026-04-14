import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useSendTransaction } from 'wagmi'
import { useEnsureAllowance } from '../../shared/hooks/useEnsureAllowance'
import TopNav from '../../shared/components/TopNav'
import TxLink from '../../shared/components/TxLink'
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS, USDC_BASE, LIFI_DIAMOND_BASE, LIFI_API_KEY } from '../../../theme'

interface EarnVault {
  id: string
  address: string
  protocol: string
  name: string
  chainId: number
  apy: string
  tvlUsd: string
  isTransactional: boolean
}

type DepositState = 'idle' | 'approving' | 'quoting' | 'depositing' | 'success' | 'error'

function formatAPY(apy: string): string {
  const raw = parseFloat(apy)
  if (isNaN(raw)) return 'N/A'
  const pct = raw < 1 ? raw * 100 : raw
  return pct.toFixed(2) + '%'
}

function formatTVL(tvl: string): string {
  const n = parseFloat(tvl)
  if (isNaN(n)) return 'N/A'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

const CHAIN_META: Record<number, { label: string; color: string; bg: string }> = {
  8453:  { label: 'Base',     color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  42161: { label: 'Arbitrum', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  100:   { label: 'Gnosis',   color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  10:    { label: 'Optimism', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

const DEPOSIT_STATUS_LABEL: Record<DepositState, string> = {
  idle:      '',
  approving: '授权 USDC 中，请在钱包确认...',
  quoting:   '获取最优路由中...',
  depositing:'存入中，请在钱包确认...',
  success:   '存入成功！',
  error:     '',
}

export default function EarnDashboard() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const { ensureAllowance } = useEnsureAllowance()

  const [vaults, setVaults] = useState<EarnVault[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [depositState, setDepositState] = useState<DepositState>('idle')
  const [depositError, setDepositError] = useState<string | null>(null)
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null)

  function loadVaults() {
    setLoading(true)
    setLoadError(null)
    Promise.all(
      SUPPORTED_CHAINS.map(chain =>
        fetch(
          `https://earn.li.fi/v1/earn/vaults?chainId=${chain.id}&asset=USDC&sortBy=apy`,
          { headers: { 'x-lifi-api-key': LIFI_API_KEY } }
        )
          .then(r => r.json())
          .then(j => (j.data ?? []) as EarnVault[])
          .catch(() => [] as EarnVault[])
      )
    )
      .then(results => {
        const all = results.flat().filter(v => v.isTransactional)
        all.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy))
        setVaults(all)
      })
      .catch(e => setLoadError(e.message ?? 'Failed to load vaults'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadVaults() }, [])

  function selectVault(id: string) {
    if (selectedId === id) {
      setSelectedId(null)
      return
    }
    setSelectedId(id)
    setAmount('')
    setDepositState('idle')
    setDepositError(null)
    setDepositTxHash(null)
  }

  async function handleDeposit(vault: EarnVault) {
    if (!address || !amount || parseFloat(amount) <= 0) return
    setDepositState('approving')
    setDepositError(null)
    setDepositTxHash(null)
    try {
      const amountRaw = BigInt(Math.floor(parseFloat(amount) * 1e6))
      const usdcAddress = (SUPPORTED_TOKENS[vault.chainId]?.find(t => t.symbol === 'USDC')?.address ?? USDC_BASE) as `0x${string}`

      await ensureAllowance(usdcAddress, LIFI_DIAMOND_BASE as `0x${string}`, amountRaw)

      setDepositState('quoting')
      const params = new URLSearchParams({
        fromChain: String(vault.chainId),
        toChain: String(vault.chainId),
        fromToken: usdcAddress,
        toToken: vault.address,
        fromAmount: String(amountRaw),
        fromAddress: address,
        toAddress: address,
      })
      const res = await fetch(`https://li.quest/v1/quote?${params}`)
      if (!res.ok) throw new Error(`LiFi quote error: ${res.status}`)
      const lifiData = await res.json()
      const txReq = lifiData.transactionRequest

      setDepositState('depositing')
      const txHash = await sendTransactionAsync({
        to: txReq.to,
        data: txReq.data,
        value: BigInt(txReq.value || '0'),
        gas: txReq.gasLimit ? BigInt(txReq.gasLimit) : undefined,
        gasPrice: txReq.gasPrice ? BigInt(txReq.gasPrice) : undefined,
        maxFeePerGas: txReq.maxFeePerGas ? BigInt(txReq.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: txReq.maxPriorityFeePerGas ? BigInt(txReq.maxPriorityFeePerGas) : undefined,
      })
      setDepositTxHash(txHash)
      setDepositState('success')
    } catch (e: any) {
      if (e.message?.includes('User rejected') || e.message?.includes('user rejected')) {
        setDepositState('idle')
      } else {
        setDepositError(e.message ?? '存入失败')
        setDepositState('error')
      }
    }
  }

  const inputStyle = {
    background: '#0f1117',
    border: '1px solid #2d3155',
    borderRadius: 8,
    color: '#fff',
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1117' }}>
      <TopNav />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/employee')}
            className="flex items-center justify-center rounded-lg text-sm transition-opacity hover:opacity-70"
            style={{ background: '#1e2030', border: '1px solid #2d3155', color: '#94a3b8', padding: '6px 12px' }}
          >
            ← 返回
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Earn 收益</h1>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
              将 USDC 存入 vault，自动赚取链上利息
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-xl p-5 animate-pulse"
                style={{ background: '#1e2030', border: '1px solid #2d3155', height: 96 }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="rounded-xl p-6 text-center" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
            <p className="text-sm mb-4" style={{ color: '#ef4444' }}>⚠ {loadError}</p>
            <button
              onClick={loadVaults}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: '#6366f1', color: '#fff' }}
            >
              重试
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && vaults.length === 0 && (
          <div className="rounded-xl p-8 text-center" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
            <p style={{ color: '#94a3b8' }} className="text-sm">暂无可用 vault</p>
          </div>
        )}

        {/* Vault list */}
        {!loading && !loadError && vaults.length > 0 && (
          <div className="flex flex-col gap-3">
            {vaults.map(vault => {
              const chain = CHAIN_META[vault.chainId]
              const isOpen = selectedId === vault.id
              const isThisDepositing = isOpen && depositState !== 'idle'

              return (
                <div
                  key={vault.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: '#1e2030', border: `1px solid ${isOpen ? '#6366f1' : '#2d3155'}` }}
                >
                  {/* Vault summary row */}
                  <button
                    className="w-full p-4 text-left flex items-center gap-4"
                    onClick={() => selectVault(vault.id)}
                  >
                    {/* Protocol initial */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: '#252840', color: '#6366f1', fontFamily: 'monospace' }}
                    >
                      {vault.protocol.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-semibold truncate">{vault.name}</span>
                        {chain && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: chain.bg, color: chain.color, border: `1px solid ${chain.color}30` }}
                          >
                            {chain.label}
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: '#6366f1' }}>{vault.protocol}</span>
                    </div>

                    {/* APY + TVL */}
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-lg font-bold"
                        style={{
                          color: '#10b981',
                          textShadow: '0 0 12px rgba(16,185,129,0.4)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatAPY(vault.apy)}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                        TVL {formatTVL(vault.tvlUsd)}
                      </div>
                    </div>

                    <div className="flex-shrink-0 ml-2" style={{ color: '#4b5563', fontSize: 12 }}>
                      {isOpen ? '▲' : '▼'}
                    </div>
                  </button>

                  {/* Deposit form */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: '#2d3155' }}>
                      {depositState === 'success' ? (
                        <div className="py-3">
                          <p className="text-sm mb-2" style={{ color: '#10b981' }}>✅ 存入成功</p>
                          {depositTxHash && <TxLink hash={depositTxHash} />}
                          <button
                            onClick={() => { setDepositState('idle'); setAmount('') }}
                            className="mt-3 text-xs"
                            style={{ color: '#94a3b8' }}
                          >
                            再次存入
                          </button>
                        </div>
                      ) : (
                        <div className="pt-3 flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="输入 USDC 金额"
                              value={amount}
                              onFocus={e => e.target.select()}
                              onChange={e => setAmount(e.target.value)}
                              disabled={isThisDepositing}
                              style={{ ...inputStyle, opacity: isThisDepositing ? 0.5 : 1 }}
                            />
                            <span className="text-sm flex-shrink-0" style={{ color: '#94a3b8' }}>USDC</span>
                          </div>

                          {depositState !== 'idle' && depositState !== 'error' && (
                            <p className="text-xs" style={{ color: '#f59e0b' }}>
                              ⏳ {DEPOSIT_STATUS_LABEL[depositState]}
                            </p>
                          )}

                          {depositState === 'error' && depositError && (
                            <p className="text-xs" style={{ color: '#ef4444' }}>❌ {depositError}</p>
                          )}

                          <button
                            onClick={() => handleDeposit(vault)}
                            disabled={isThisDepositing || !amount || parseFloat(amount) <= 0}
                            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                            style={{
                              background: isThisDepositing || !amount || parseFloat(amount) <= 0
                                ? '#252840' : '#6366f1',
                              color: isThisDepositing || !amount || parseFloat(amount) <= 0
                                ? '#4b5563' : '#fff',
                              cursor: isThisDepositing ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isThisDepositing ? '处理中...' : '存入 →'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Disclaimer */}
        {!loading && vaults.length > 0 && (
          <p className="text-center text-xs mt-8" style={{ color: '#4b5563' }}>
            Powered by Li.Fi Earn · 收益率为实时数据，仅供参考
          </p>
        )}
      </div>
    </div>
  )
}
