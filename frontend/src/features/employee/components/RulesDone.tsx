import TxLink from '../../shared/components/TxLink'

interface Props {
  txHash?: string
}


export default function RulesDone({ txHash }: Props) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center px-4 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-success/10 text-3xl">
        ✅
      </div>
      <h2 className="mb-2 text-h2 font-medium text-text-primary">规则已生效</h2>
      <p className="mb-6 text-body-sm font-light text-text-secondary">链上存储 · 透明可验证</p>

      <div className="cp-card mb-4 w-full max-w-sm rounded-xl p-4 text-left">
        <p className="mb-2 text-caption font-medium text-text-secondary">接收规则</p>
        <p className="text-body-sm font-medium text-status-success">已在链上配置 ✓</p>
      </div>

      {txHash && (
        <div className="cp-card w-full max-w-sm rounded-xl p-4 text-left">
          <p className="mb-1 text-caption font-medium text-text-secondary">链上交易</p>
          <TxLink hash={txHash} />
        </div>
      )}
    </div>
  )
}
