import { useState, useEffect, useCallback } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'
import EmployeeRow from '../components/EmployeeRow'
import AddEmployeeModal from '../components/AddEmployeeModal'
import type { Employee } from '../../../store'

export default function EmployeesPage() {
  const { getEmployees } = useBackend()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch (e) {
      setError('无法加载员工列表，请确认后端已启动')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center mb-6">
        <h1 className="text-white text-xl font-bold">员工列表</h1>
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#6366f1' }}
        >
          + 添加员工
        </button>
      </div>

      {loading && <p style={{ color: '#94a3b8' }}>加载中...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
          {employees.length === 0 ? (
            <div className="py-12 text-center" style={{ color: '#94a3b8' }}>
              还没有员工，点击「添加员工」开始
            </div>
          ) : (
            employees.map((emp) => <EmployeeRow key={emp.id} employee={emp} />)
          )}
        </div>
      )}

      {showModal && (
        <AddEmployeeModal
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
