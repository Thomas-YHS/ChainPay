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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/60 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-card p-6 shadow-md">
        <div className="mb-5 flex items-center">
          <h2 className="text-h2 font-medium text-text-primary">添加员工</h2>
          <button onClick={onClose} className="ml-auto min-h-touch px-3 text-body font-light text-text-secondary transition-colors duration-normal ease-standard hover:text-brand-primary">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-caption font-medium text-text-secondary">姓名 *</label>
            <input
              className="min-h-touch w-full rounded-lg border border-border px-3 py-2 text-body-sm font-light text-text-primary"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="张三"
            />
          </div>
          <div>
            <label className="mb-1 block text-caption font-medium text-text-secondary">昵称</label>
            <input
              className="min-h-touch w-full rounded-lg border border-border px-3 py-2 text-body-sm font-light text-text-primary"
              value={form.nickname}
              onChange={e => set('nickname', e.target.value)}
              placeholder="Alex（可选）"
            />
          </div>
          <div>
            <label className="mb-1 block text-caption font-medium text-text-secondary">钱包地址 *</label>
            <input
              className="cp-text-code min-h-touch w-full rounded-lg border border-border px-3 py-2 text-text-primary"
              value={form.wallet_address}
              onChange={e => set('wallet_address', e.target.value)}
              placeholder="0x..."
            />
          </div>
          <div>
            <label className="mb-1 block text-caption font-medium text-text-secondary">合约金额（USDC）*</label>
            <input
              className="min-h-touch w-full rounded-lg border border-border px-3 py-2 text-body-sm font-light text-text-primary"
              type="number"
              min="1"
              value={form.salary_amount}
              onChange={e => set('salary_amount', e.target.value)}
              placeholder="2400"
            />
          </div>
          <div>
            <label className="mb-1 block text-caption font-medium text-text-secondary">发薪频率 *</label>
            <select
              className="min-h-touch w-full cursor-pointer rounded-lg border border-border-interactive bg-surface-card px-3 py-2 text-body-sm font-light text-text-primary shadow-sm"
              value={form.pay_frequency}
              onChange={e => set('pay_frequency', e.target.value)}
            >
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {error && <p className="text-body-sm font-light text-status-error">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-touch flex-1 rounded-lg border border-border-interactive bg-surface-card px-4 py-2.5 text-button-sm font-light text-text-secondary transition-colors duration-normal ease-standard hover:border-border-interactive-strong"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-touch flex-1 rounded-lg bg-brand-primary px-4 py-2.5 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '添加中...' : '确认添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
