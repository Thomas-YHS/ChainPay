import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { getRoutes, executeRoute, type Route } from '@lifi/sdk'
import { parseUnits } from 'viem'
import { useAppStore } from '../../../store'
import { useBackend } from '../../shared/hooks/useBackend'
import ApproveCard from '../components/ApproveCard'
import RouteTimeline from '../components/RouteTimeline'
import type { Employee, RouteStepStatus } from '../../../store'
import { PAY_FREQUENCY_LABELS, USDC_BASE } from '../../../theme'

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

function RoutePreviewSection({ employee, onExecuting }: { employee: Employee | null; onExecuting: () => void }) {
  const { address } = useAccount()
  const { setRouteSteps, updateRouteStep } = useAppStore()
  const [lifiRoutes, setLifiRoutes] = useState<Route[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)

  if (!employee) return null

  async function fetchRoutes() {
    if (!address || !employee) return
    setLoadingRoutes(true)
    setRouteError(null)
    try {
      const amount = parseUnits(employee.salary_amount, 6)
      const result = await getRoutes({
        fromChainId: 8453,
        toChainId: 8453,
        fromTokenAddress: USDC_BASE,
        toTokenAddress: USDC_BASE,
        fromAmount: amount.toString(),
        fromAddress: address,
        toAddress: employee.wallet_address as `0x${string}`,
      })
      setLifiRoutes(result.routes.slice(0, 1))
    } catch (e: any) {
      setRouteError(e.message ?? '路由获取失败')
    } finally {
      setLoadingRoutes(false)
    }
  }

  async function handleExecute() {
    if (!address || lifiRoutes.length === 0 || !employee) return
    setExecuting(true)

    const initialSteps = lifiRoutes[0].steps.map((s, i) => ({
      label: `路由 ${i + 1} · ${s.toolDetails?.name ?? s.tool}`,
      status: 'pending' as const,
      description: `${s.action.fromAmount} → Chain ${s.action.toChainId}`,
    }))
    setRouteSteps([
      { label: '从雇主拉取 USDC', status: 'pending', description: `$${employee.salary_amount} USDC · Base` },
      ...initialSteps,
    ])
    onExecuting()

    try {
      updateRouteStep(0, { status: 'processing', description: `$${employee.salary_amount} USDC · Base` })

      await executeRoute(lifiRoutes[0], {
        updateRouteHook(updatedRoute) {
          updatedRoute.steps.forEach((step, i) => {
            const idx = i + 1
            const execution = step.execution
            if (!execution) return
            const status: RouteStepStatus =
              execution.status === 'DONE' ? 'completed'
              : execution.status === 'FAILED' ? 'failed'
              : 'processing'
            const txHash = execution.process?.find((p: any) => p.txHash)?.txHash
            updateRouteStep(idx, {
              status,
              txHash,
              description: status === 'processing' ? '桥接中...' : (step.toolDetails?.name ?? step.tool),
            })
          })
        },
      })

      updateRouteStep(0, { status: 'completed' })
    } catch (e: any) {
      updateRouteStep(0, { status: 'failed', description: e.message })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="mt-4 p-4 rounded-xl" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
      <p className="text-sm text-white mb-3">已选：{employee.name} · ${employee.salary_amount} USDC</p>

      {lifiRoutes.length === 0 ? (
        <>
          <button
            onClick={fetchRoutes}
            disabled={loadingRoutes}
            className="w-full py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: loadingRoutes ? '#4b5563' : '#6366f1', color: '#fff' }}
          >
            {loadingRoutes ? '获取路由中...' : '生成路由预览 →'}
          </button>
          {routeError && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{routeError}</p>}
        </>
      ) : (
        <>
          <div className="mb-3 p-3 rounded-lg" style={{ background: '#252840' }}>
            {lifiRoutes[0].steps.map((s, i) => (
              <div key={i} className="flex justify-between text-xs py-1">
                <span style={{ color: '#94a3b8' }}>{s.toolDetails?.name ?? s.tool}</span>
                <span style={{ color: '#6366f1' }}>≈ ${s.estimate?.toAmountUSD ?? '—'}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="w-full py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: executing ? '#4b5563' : '#6366f1', color: '#fff' }}
          >
            {executing ? '执行中...' : '确认发薪'}
          </button>
        </>
      )}
    </div>
  )
}
