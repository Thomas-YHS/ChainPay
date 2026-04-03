import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useContract, useUsdcAllowance } from '../../shared/hooks/useContract'
import { parseUnits, formatUnits } from 'viem'

interface Props {
  totalAmountUsdc: string  // e.g. "7200"
}

export default function ApproveCard({ totalAmountUsdc }: Props) {
  const { address } = useAccount()
  const { approveUsdc } = useContract()
  const { data: allowance, refetch } = useUsdcAllowance(address)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const required = parseUnits(totalAmountUsdc || '0', 6)
  const current = allowance ?? 0n
  const isApproved = current >= required

  async function handleApprove() {
    setLoading(true)
    setError(null)
    try {
      await approveUsdc(required)
      await refetch()
    } catch (e: any) {
      setError(e.shortMessage ?? e.message ?? '授权失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
      <div className="flex items-center mb-2">
        <span className="text-white font-semibold text-sm">USDC Approve</span>
        {isApproved ? (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#10b98120', color: '#10b981' }}>
            已授权 ${formatUnits(current, 6)}
          </span>
        ) : (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#ef444420', color: '#ef4444' }}>
            未授权
          </span>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>
        本次发薪总额：<span className="text-white font-mono">${totalAmountUsdc} USDC</span>
      </p>
      {!isApproved && (
        <>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-semibold"
            style={{ background: loading ? '#4b5563' : '#6366f1', color: '#fff' }}
          >
            {loading ? '授权中...' : `Approve $${totalAmountUsdc} USDC`}
          </button>
          {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}
        </>
      )}
    </div>
  )
}
