import type { Employee, RouteStep } from '../../../store'
import TxLink from '../../shared/components/TxLink'

interface Props {
  steps: RouteStep[]
  employee: Employee
}

export default function RouteTimeline({ steps, employee }: Props) {
  if (steps.length === 0) {
    return <p style={{ color: '#94a3b8' }}>准备路由中...</p>
  }

  return (
    <div className="max-w-lg">
      <div className="relative pl-5">
        <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: '#2d3155' }} />
        {steps.map((step, i) => (
          <div key={i} className="relative mb-5 last:mb-0">
            <div
              className="absolute -left-3.5 top-1 w-3 h-3 rounded-full"
              style={{
                background: step.status === 'completed' ? '#10b981' : step.status === 'processing' ? '#f59e0b' : '#2d3155',
                border: step.status === 'pending' ? '1px solid #4b5563' : 'none',
              }}
            />
            <div
              className="text-sm font-semibold"
              style={{ color: step.status === 'pending' ? '#4b5563' : '#fff' }}
            >
              {step.label}
            </div>
            <div className="text-xs mt-0.5" style={{ color: step.status === 'processing' ? '#f59e0b' : '#94a3b8' }}>
              {step.description}
              {step.txHash && <span className="ml-2"><TxLink hash={step.txHash} /></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
