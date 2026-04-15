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
    <div className="max-w-content">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-h2 font-medium text-text-primary">员工列表</h1>
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto min-h-touch rounded-lg bg-brand-primary px-4 py-2 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover"
        >
          + 添加员工
        </button>
      </div>

      {loading && <p className="cp-text-meta">加载中...</p>}
      {error && <p className="text-body-sm font-light text-status-error">{error}</p>}

      {!loading && !error && (
        <div className="cp-card overflow-hidden rounded-xl">
          <div className="flex items-center border-b border-border bg-surface-canvas px-4 py-3 text-h4 font-medium text-text-secondary">
            <span className="flex-1">员工信息</span>
            <span className="hidden w-[200px] md:block">钱包地址</span>
            <span className="w-[84px] text-left">规则</span>
          </div>
          {employees.length === 0 ? (
            <div className="py-16 text-center text-body-sm font-light text-text-secondary">
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
