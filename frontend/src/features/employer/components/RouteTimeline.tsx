import type { Employee, RouteStep } from '../../../store'
import TxLink from '../../shared/components/TxLink'
import { colors } from '../../../styles/tokens'

interface Props {
  steps: RouteStep[]
  employee: Employee
}

export default function RouteTimeline({ steps, employee: _employee }: Props) {
  if (steps.length === 0) {
    return <p className="cp-text-meta">准备路由中...</p>
  }

  return (
    <div className="cp-card max-w-[780px] rounded-xl p-5 md:p-6">
      <div className="relative pl-5">
        <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
        {steps.map((step, i) => (
          <div key={i} className="relative mb-5 last:mb-0">
            <div
              className="absolute -left-3.5 top-1 h-3 w-3 rounded-full"
              style={{
                background:
                  step.status === 'completed'
                    ? colors.status.success
                    : step.status === 'processing'
                    ? colors.status.warning
                    : step.status === 'failed'
                    ? colors.status.error
                    : colors.border.default,
                border: step.status === 'pending' ? `1px solid ${colors.border.subtle}` : 'none',
              }}
            />
            <div
              className="text-body-sm font-medium"
              style={{ color: step.status === 'pending' ? colors.text.secondary : colors.text.primary }}
            >
              {step.label}
            </div>
            <div
              className="mt-0.5 text-caption font-medium"
              style={{
                color:
                  step.status === 'processing'
                    ? colors.status.warning
                    : step.status === 'failed'
                    ? colors.status.error
                    : colors.text.secondary,
              }}
            >
              {step.description}
              {step.txHash && <span className="ml-2"><TxLink hash={step.txHash} /></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
