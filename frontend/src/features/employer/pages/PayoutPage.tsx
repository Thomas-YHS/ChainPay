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
import { colors } from '../../../styles/tokens'

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
      <div className="max-w-content">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-h2 font-medium text-text-primary">
            发薪执行中 · {selectedEmployee?.name}
          </h1>
          <button
            onClick={() => { setStep('select'); setSelectedEmployee(null) }}
            className="ml-auto min-h-touch rounded-lg border border-border-interactive bg-surface-card px-3 py-2 text-body-sm font-light text-text-secondary transition-colors duration-normal ease-standard hover:border-border-interactive-strong"
          >
            ← 返回
          </button>
        </div>
        <RouteTimeline steps={routeSteps} employee={selectedEmployee!} />
      </div>
    )
  }

  return (
    <div className="max-w-content">
      <h1 className="mb-6 text-h2 font-medium text-text-primary">发薪</h1>

      <ApproveCard totalAmountUsdc={totalAmount} />

      <h2 className="mb-3 text-h4 font-medium text-text-secondary">选择员工</h2>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {employees.map((emp) => {
          const disabled = !emp.has_rules
          const selected = selectedEmployee?.id === emp.id
          return (
            <button
              key={emp.id}
              disabled={disabled}
              onClick={() => setSelectedEmployee(selected ? null : emp)}
              className="min-h-touch rounded-xl border p-4 text-left shadow-xs transition-all duration-normal ease-standard"
              style={{
                background: selected ? 'rgba(99, 102, 241, 0.08)' : colors.surface.card,
                border: selected ? '1px solid rgba(99, 102, 241, 0.45)' : `1px solid ${colors.border.default}`,
                opacity: disabled ? 0.55 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="text-body-sm font-medium text-text-primary">{emp.name}</div>
              <div className="mt-1 text-caption font-medium text-brand-primary">${emp.salary_amount} USDC</div>
              <div className="mt-1 text-caption font-medium" style={{ color: disabled ? colors.status.warning : colors.text.secondary }}>
                {disabled ? '待设置规则' : PAY_FREQUENCY_LABELS[emp.pay_frequency]}
              </div>
            </button>
          )
        })}
      </div>

      {employees.length === 0 && (
        <p className="mb-6 text-body-sm font-light text-text-secondary">暂无员工，请先在员工管理页添加员工</p>
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
    <div className="cp-card mt-4 rounded-xl p-4">
      <p className="mb-3 text-body-sm font-medium text-text-primary">已选：{employee.name} · ${employee.salary_amount} USDC</p>

      {lifiRoutes.length === 0 ? (
        <>
          <button
            onClick={fetchRoutes}
            disabled={loadingRoutes}
            className="min-h-touch w-full rounded-lg bg-brand-primary px-4 py-2.5 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingRoutes ? '获取路由中...' : '生成路由预览 →'}
          </button>
          {routeError && <p className="mt-2 text-caption font-medium text-status-error">{routeError}</p>}
        </>
      ) : (
        <>
          <div className="mb-3 rounded-lg border border-border bg-surface-canvas p-3">
            {lifiRoutes[0].steps.map((s, i) => (
              <div key={i} className="flex justify-between py-1 text-caption">
                <span className="font-medium text-text-secondary">{s.toolDetails?.name ?? s.tool}</span>
                <span className="font-medium text-brand-primary">≈ ${s.estimate?.toAmountUSD ?? '—'}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="min-h-touch w-full rounded-lg bg-brand-primary px-4 py-2.5 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {executing ? '执行中...' : '确认发薪'}
          </button>
        </>
      )}
    </div>
  )
}
