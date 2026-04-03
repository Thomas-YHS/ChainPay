import TxLink from '../../shared/components/TxLink'
import { SUPPORTED_CHAINS } from '../../../theme'

interface OnChainRule {
  chainId: bigint
  tokenAddress: `0x${string}`
  basisPoints: bigint
}

interface Props {
  rules: readonly OnChainRule[]
  txHash?: string
}

function chainName(id: bigint) {
  return SUPPORTED_CHAINS.find((c) => BigInt(c.id) === id)?.label ?? `Chain ${id}`
}

export default function RulesDone({ rules, txHash }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: '#10b98120' }}>
        ✅
      </div>
      <h2 className="text-white text-xl font-bold mb-2">规则已生效</h2>
      <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>链上存储 · 透明可验证</p>

      <div className="w-full max-w-sm rounded-xl p-4 mb-4 text-left" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>接收规则</p>
        {rules.map((rule, i) => (
          <div key={i} className="flex justify-between py-1.5" style={{ borderTop: i > 0 ? '1px solid #252840' : undefined }}>
            <span className="text-white text-sm">{Number(rule.basisPoints) / 100}%</span>
            <span className="text-sm" style={{ color: '#94a3b8' }}>
              {rule.tokenAddress === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'Token'} · {chainName(rule.chainId)}
            </span>
          </div>
        ))}
      </div>

      {txHash && (
        <div className="w-full max-w-sm rounded-xl p-4 text-left" style={{ background: '#1a1f35', border: '1px solid #2d3155' }}>
          <p className="text-xs mb-1" style={{ color: '#94a3b8' }}>链上交易</p>
          <TxLink hash={txHash} />
        </div>
      )}
    </div>
  )
}
