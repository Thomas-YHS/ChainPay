import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../../store'
import { useBackend } from '../../shared/hooks/useBackend'
import ApproveCard from '../components/ApproveCard'
import RouteTimeline from '../components/RouteTimeline'
import type { Employee } from '../../../store'
import { PAY_FREQUENCY_LABELS } from '../../../theme'

type Step = 'select' | 'executing'

export default function PayoutPage() {
  const { getEmployees } = useBackend()
  const { selectedEmployee, setSelectedEmployee, routeSteps } = useAppStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [step, setStep] = useState<Step>('select')

  const load = useCallback(async () => {
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch { /* backend not ready */ }
  }, [])

  useEffect(() => { load() }, [load])

  const totalAmount = selectedEmployee ? selectedEmployee.salary_amount : '0'

  if (step === 'executing') {
    return (
      <div>
        <div className="flex items-center mb-6">
          <h1 className="text-white text-xl font-bold">
            发薪执行中 · {selectedEmployee?.name}
          </h1>
          <button
            onClick={() => { setStep('select'); setSelectedEmployee(null) }}
            className="ml-auto text-sm"
            style={{ color: '#94a3b8' }}
          >
            ← 返回
          </button>
        </div>
        <RouteTimeline steps={routeSteps} employee={selectedEmployee!} />
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-white text-xl font-bold mb-6">发薪</h1>

      <ApproveCard totalAmountUsdc={totalAmount} />

      <h2 className="text-sm font-semibold mb-3" style={{ color: '#94a3b8' }}>选择员工</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {employees.map((emp) => {
          const disabled = !emp.has_rules
          const selected = selectedEmployee?.id === emp.id
          return (
            <button
              key={emp.id}
              disabled={disabled}
              onClick={() => setSelectedEmployee(selected ? null : emp)}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: selected ? '#1e2030' : '#1a1f35',
                border: selected ? '1px solid #6366f1' : '1px solid #2d3155',
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="text-white text-sm font-semibold">{emp.name}</div>
              <div className="text-xs mt-1" style={{ color: '#6366f1' }}>${emp.salary_amount} USDC</div>
              <div className="text-xs mt-1" style={{ color: disabled ? '#f59e0b' : '#94a3b8' }}>
                {disabled ? '待设置规则' : PAY_FREQUENCY_LABELS[emp.pay_frequency]}
              </div>
            </button>
          )
        })}
      </div>

      {employees.length === 0 && (
        <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>暂无员工，请先在员工管理页添加员工</p>
      )}

      <RoutePreviewSection
        employee={selectedEmployee}
        onExecuting={() => setStep('executing')}
      />
    </div>
  )
}

// Placeholder — will be replaced in Task 10 with Li.Fi route generation
function RoutePreviewSection({ employee, onExecuting }: { employee: Employee | null; onExecuting: () => void }) {
  if (!employee) return null
  return (
    <div className="mt-4 p-4 rounded-xl" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
      <p className="text-sm text-white mb-3">已选：{employee.name} · ${employee.salary_amount} USDC</p>
      <button
        onClick={onExecuting}
        className="w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: '#6366f1', color: '#fff' }}
      >
        生成路由预览 →
      </button>
    </div>
  )
}
