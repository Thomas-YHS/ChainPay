import { PAY_FREQUENCY_LABELS } from '../../../theme'
import type { Employee } from '../../../store'

// Deterministic gradient based on first letter
const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#818cf8)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#06b6d4,#22d3ee)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#ef4444,#f87171)',
]
function avatarGradient(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

interface Props {
  employee: Employee
}

export default function EmployeeRow({ employee }: Props) {
  const initial = (employee.nickname || employee.name)[0].toUpperCase()
  const freqLabel = PAY_FREQUENCY_LABELS[employee.pay_frequency] ?? employee.pay_frequency

  return (
    <div
      className="flex items-center px-4 py-3 border-b"
      style={{ borderColor: '#252840' }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold mr-3 flex-shrink-0"
        style={{ background: avatarGradient(employee.name) }}
      >
        {initial}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-semibold truncate">{employee.name}</div>
        <div className="text-xs" style={{ color: '#94a3b8' }}>
          ${employee.salary_amount} USDC · {freqLabel}
        </div>
      </div>
      {/* Wallet */}
      <div className="text-xs mr-4 font-mono hidden md:block" style={{ color: '#4b5563' }}>
        {employee.wallet_address.slice(0, 6)}...{employee.wallet_address.slice(-4)}
      </div>
      {/* Status badge */}
      {employee.has_rules ? (
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#10b98120', color: '#10b981' }}>
          规则已设
        </span>
      ) : (
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
          待设置
        </span>
      )}
    </div>
  )
}
