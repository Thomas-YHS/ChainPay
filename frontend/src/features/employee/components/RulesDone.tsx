import TxLink from '../../shared/components/TxLink'

interface Props {
  txHash?: string
}


export default function RulesDone({ txHash }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: '#10b98120' }}>
        ✅
      </div>
      <h2 className="text-white text-xl font-bold mb-2">规则已生效</h2>
      <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>链上存储 · 透明可验证</p>

      <div className="w-full max-w-sm rounded-xl p-4 mb-4 text-left" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <p className="text-xs mb-2" style={{ color: '#94a3b8' }}>接收规则</p>
        <p className="text-sm" style={{ color: '#10b981' }}>已在链上配置 ✓</p>
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
