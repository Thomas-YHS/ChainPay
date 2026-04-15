import { PAY_FREQUENCY_LABELS } from '../../../theme'
import type { Employee } from '../../../store'
import { colors } from '../../../styles/tokens'

// Deterministic gradient based on first letter
const GRADIENTS = [
  `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.primaryHover})`,
  `linear-gradient(135deg, ${colors.status.info}, #38bdf8)`,
  `linear-gradient(135deg, ${colors.status.success}, #34d399)`,
  `linear-gradient(135deg, ${colors.status.warning}, ${colors.accent.destructive})`,
  `linear-gradient(135deg, ${colors.status.error}, #ff7a6a)`,
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
      className="flex items-center border-b border-border px-4 py-3 transition-colors duration-normal ease-standard hover:bg-brand-primary/[0.04]"
    >
      <div
        className="mr-3 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-body-sm font-medium text-text-inverse"
        style={{ background: avatarGradient(employee.name) }}
      >
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <div className="truncate text-body-sm font-medium text-text-primary">{employee.name}</div>
        <div className="text-caption font-medium text-text-secondary">
          ${employee.salary_amount} USDC · {freqLabel}
        </div>
      </div>

      <div className="cp-text-code mr-4 hidden text-text-secondary md:block">
        {employee.wallet_address.slice(0, 6)}...{employee.wallet_address.slice(-4)}
      </div>

      {employee.has_rules ? (
        <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-caption font-medium text-status-success">
          规则已设
        </span>
      ) : (
        <span className="rounded-full border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-caption font-medium text-status-warning">
          待设置
        </span>
      )}
    </div>
  )
}
