import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAppStore } from '../store'
import WalletButton from '../features/shared/components/WalletButton'

export default function LandingPage() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { role, setRole } = useAppStore()

  // After wallet connects, redirect based on role
  useEffect(() => {
    if (!isConnected || !address || !role) return
    if (role === 'employer') {
      navigate('/employer/employees')
    } else {
      navigate('/employee')
    }
  }, [isConnected, address, role, navigate])

  function handleRoleClick(selected: 'employer' | 'employee') {
    setRole(selected)
    if (isConnected) {
      // Already connected — navigate directly
      navigate(selected === 'employer' ? '/employer/employees' : '/employee')
    } else {
      openConnectModal?.()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0f1117' }}>
      {/* Wallet button top right */}
      <div className="absolute top-4 right-4">
        <WalletButton />
      </div>

      {/* Badge */}
      <div
        className="mb-5 px-4 py-1 rounded-full text-xs font-medium border"
        style={{ background: '#1e2030', borderColor: '#2d3155', color: '#6366f1' }}
      >
        Powered by Li.Fi
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-center mb-3" style={{ color: '#fff' }}>
        跨链薪资，
        <span style={{ background: 'linear-gradient(90deg,#6366f1,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          一键路由
        </span>
      </h1>
      <p className="text-center text-sm mb-10 max-w-sm" style={{ color: '#94a3b8' }}>
        雇主单链发 USDC，员工自动收到多链多 Token 组合。规则透明上链，无需信任中间方。
      </p>

      {/* Role cards */}
      <div className="flex gap-4 w-full max-w-sm">
        <button
          onClick={() => handleRoleClick('employer')}
          className="flex-1 rounded-xl p-6 text-center cursor-pointer transition-transform hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#1e2030,#252840)', border: '1px solid #6366f1' }}
        >
          <div className="text-3xl mb-3">🏢</div>
          <div className="text-white font-semibold text-sm mb-1">我是雇主</div>
          <div className="text-xs mb-4" style={{ color: '#94a3b8' }}>添加员工、设置发薪</div>
          <div className="py-2 px-3 rounded-md text-xs font-semibold" style={{ background: '#6366f1', color: '#fff' }}>
            进入管理端 →
          </div>
        </button>

        <button
          onClick={() => handleRoleClick('employee')}
          className="flex-1 rounded-xl p-6 text-center cursor-pointer transition-transform hover:scale-105"
          style={{ background: '#1e2030', border: '1px solid #2d3155' }}
        >
          <div className="text-3xl mb-3">👷</div>
          <div className="text-white font-semibold text-sm mb-1">我是员工</div>
          <div className="text-xs mb-4" style={{ color: '#94a3b8' }}>设置接收规则</div>
          <div className="py-2 px-3 rounded-md text-xs" style={{ background: '#252840', color: '#94a3b8', border: '1px solid #2d3155' }}>
            进入配置页 →
          </div>
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-10 mt-12 pt-8" style={{ borderTop: '1px solid #1e2030' }}>
        {[
          { value: '$7.2K', label: '已路由' },
          { value: '4', label: '条链' },
          { value: '100%', label: '链上透明' },
        ].map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="text-white font-bold text-lg">{value}</div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
