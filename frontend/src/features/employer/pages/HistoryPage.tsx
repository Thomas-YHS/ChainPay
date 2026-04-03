import { useState, useEffect, useCallback } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import TxLink from '../../shared/components/TxLink'
import type { PayrollLog } from '../../../store'

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: '#10b98120', color: '#10b981', label: '完成' },
  processing: { bg: '#f59e0b20', color: '#f59e0b', label: '进行中' },
  pending: { bg: '#6366f120', color: '#6366f1', label: '待执行' },
  failed: { bg: '#ef444420', color: '#ef4444', label: '失败' },
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
    <div>
      <h1 className="text-white text-xl font-bold mb-6">发薪记录</h1>
      {loading && <p style={{ color: '#94a3b8' }}>加载中...</p>}
      {!loading && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
          {logs.length === 0 ? (
            <div className="py-12 text-center" style={{ color: '#94a3b8' }}>暂无发薪记录</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #252840' }}>
                  {['时间', '员工', '金额', '状态', '交易'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const s = STATUS_STYLES[log.status] ?? STATUS_STYLES.pending
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #252840' }}>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#94a3b8' }}>
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-white">{log.employee_name}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#6366f1' }}>${log.amount} USDC</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {log.tx_hash ? <TxLink hash={log.tx_hash} /> : <span style={{ color: '#4b5563' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
