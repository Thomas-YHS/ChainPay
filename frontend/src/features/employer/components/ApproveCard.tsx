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
    <div className="cp-card mb-5 rounded-xl p-4">
      <div className="mb-2 flex items-center">
        <span className="text-h4 font-medium text-text-primary">USDC Approve</span>
        {isApproved ? (
          <span className="ml-auto rounded-full bg-status-success/10 px-2 py-0.5 text-caption font-medium text-status-success">
            已授权 ${formatUnits(current, 6)}
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-status-error/10 px-2 py-0.5 text-caption font-medium text-status-error">
            未授权
          </span>
        )}
      </div>
      <p className="mb-3 text-body-sm font-light text-text-secondary">
        本次发薪总额：<span className="cp-text-code text-text-primary">${totalAmountUsdc} USDC</span>
      </p>
      {!isApproved && (
        <>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="min-h-touch w-full rounded-lg bg-brand-primary px-4 py-2 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '授权中...' : `Approve $${totalAmountUsdc} USDC`}
          </button>
          {error && <p className="mt-2 text-caption font-medium text-status-error">{error}</p>}
        </>
      )}
    </div>
  )
}
