import { useState } from 'react'
import { useBackend } from '../../shared/hooks/useBackend'

interface Props {
  onClose: () => void
  onAdded: () => void
}

const FREQUENCIES = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
]

export default function AddEmployeeModal({ onClose, onAdded }: Props) {
  const { addEmployee } = useBackend()
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    wallet_address: '',
    salary_amount: '',
    pay_frequency: 'monthly',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.wallet_address || !form.salary_amount) {
      setError('姓名、钱包地址、合约金额为必填项')
      return
    }
    if (!form.wallet_address.startsWith('0x') || form.wallet_address.length !== 42) {
      setError('钱包地址格式错误（需要 0x 开头，42位）')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await addEmployee(form)
      onAdded()
    } catch (e: any) {
      setError(e.message ?? '添加失败')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#252840',
    border: '1px solid #2d3155',
    borderRadius: 6,
    color: '#fff',
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  }

  const labelStyle = { color: '#94a3b8', fontSize: 11, marginBottom: 4, display: 'block' }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: '#1e2030', border: '1px solid #2d3155' }}>
        <div className="flex items-center mb-5">
          <h2 className="text-white font-bold">添加员工</h2>
          <button onClick={onClose} className="ml-auto text-lg" style={{ color: '#4b5563' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>姓名 *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="张三" />
          </div>
          <div>
            <label style={labelStyle}>昵称</label>
            <input style={inputStyle} value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="Alex（可选）" />
          </div>
          <div>
            <label style={labelStyle}>钱包地址 *</label>
            <input style={inputStyle} value={form.wallet_address} onChange={e => set('wallet_address', e.target.value)} placeholder="0x..." className="font-mono" />
          </div>
          <div>
            <label style={labelStyle}>合约金额（USDC）*</label>
            <input style={inputStyle} type="number" min="1" value={form.salary_amount} onChange={e => set('salary_amount', e.target.value)} placeholder="2400" />
          </div>
          <div>
            <label style={labelStyle}>发薪频率 *</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.pay_frequency} onChange={e => set('pay_frequency', e.target.value)}>
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ background: '#252840', color: '#94a3b8', border: '1px solid #2d3155' }}>
              取消
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: loading ? '#4b5563' : '#6366f1', color: '#fff' }}>
              {loading ? '添加中...' : '确认添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
