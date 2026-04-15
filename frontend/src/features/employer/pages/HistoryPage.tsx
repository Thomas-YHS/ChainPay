import { useState, useEffect, useCallback } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import TxLink from '../../shared/components/TxLink'
import type { PayrollLog } from '../../../store'
import { colors } from '../../../styles/tokens'

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: 'rgba(0, 136, 71, 0.1)', color: colors.status.success, label: '完成' },
  processing: { bg: 'rgba(255, 184, 0, 0.12)', color: colors.status.warning, label: '进行中' },
  pending: { bg: 'rgba(99, 102, 241, 0.12)', color: colors.brand.primary, label: '待执行' },
  failed: { bg: 'rgba(223, 74, 52, 0.1)', color: colors.status.error, label: '失败' },
}

export default function HistoryPage() {
  const { getPayrollLogs } = useBackend()
  const [logs, setLogs] = useState<PayrollLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPayrollLogs()
      setLogs(data)
    } catch { /* backend not ready */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-content">
      <h1 className="mb-6 text-h2 font-medium text-text-primary">发薪记录</h1>
      {loading && <p className="cp-text-meta">加载中...</p>}
      {!loading && (
        <div className="cp-card overflow-hidden rounded-xl">
          {logs.length === 0 ? (
            <div className="py-16 text-center text-body-sm font-light text-text-secondary">暂无发薪记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-body-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-canvas">
                  {['时间', '员工', '金额', '状态', '交易'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-h4 font-medium text-text-secondary">{h}</th>
                  ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const s = STATUS_STYLES[log.status] ?? STATUS_STYLES.pending
                    return (
                      <tr key={log.id} className="border-b border-border transition-colors duration-normal ease-standard hover:bg-brand-primary/[0.04]">
                        <td className="px-4 py-3">
                          <span className="cp-text-code text-text-secondary">{new Date(log.created_at).toLocaleString('zh-CN')}</span>
                        </td>
                        <td className="px-4 py-3 text-body-sm font-medium text-text-primary">{log.employee_name}</td>
                        <td className="px-4 py-3">
                          <span className="cp-text-code text-brand-primary">${log.amount} USDC</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2 py-0.5 text-caption font-medium" style={{ background: s.bg, color: s.color }}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.tx_hash ? <TxLink hash={log.tx_hash} /> : <span className="text-body-sm text-text-muted">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
