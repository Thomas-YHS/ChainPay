import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAppStore } from '../store'
import WalletButton from '../features/shared/components/WalletButton'
import { colors } from '../styles/tokens'

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
    <div className="cp-shell min-h-screen px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto flex w-full max-w-[1100px] justify-end">
        <WalletButton />
      </div>

      <section className="mx-auto mt-8 w-full max-w-[900px] text-center md:mt-11">
        <div className="mb-4 inline-flex items-center rounded-full border border-border-interactive bg-surface-card/90 px-4 py-1 text-caption font-medium text-brand-primary shadow-sm">
          Powered by Li.Fi
        </div>

        <h1 className="mx-auto max-w-[760px] text-display font-medium tracking-[-0.02em] text-text-primary">
          跨链薪资，
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(90deg, ${colors.brand.primary} 0%, ${colors.brand.primaryHover} 100%)` }}
          >
            一键路由
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-[560px] text-body-sm font-light text-text-secondary">
          雇主单链发 USDC，员工自动收到多链多 Token 组合。规则透明上链，无需信任中间方。
        </p>
      </section>

      <section className="mx-auto mt-8 grid w-full max-w-[900px] gap-4 md:mt-12 md:grid-cols-2">
        <button
          onClick={() => handleRoleClick('employer')}
          className="group cp-card min-h-touch rounded-xl border-border-interactive p-6 text-left transition-transform duration-normal ease-standard hover:-translate-y-0.5"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[26px]">🏢</span>
            <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-caption font-medium text-brand-primary">Employer</span>
          </div>
          <h2 className="text-h3 font-medium text-text-primary">我是雇主</h2>
          <p className="mt-2 text-body-sm font-light text-text-secondary">添加员工、设置发薪、跟踪执行状态</p>
          <div className="mt-5 inline-flex min-h-touch items-center rounded-lg bg-brand-primary px-4 py-2 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard group-hover:bg-brand-hover">
            进入管理端 →
          </div>
        </button>

        <button
          onClick={() => handleRoleClick('employee')}
          className="group cp-card min-h-touch rounded-xl p-6 text-left transition-transform duration-normal ease-standard hover:-translate-y-0.5"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[26px]">👷</span>
            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-caption font-medium text-text-secondary">Employee</span>
          </div>
          <h2 className="text-h3 font-medium text-text-primary">我是员工</h2>
          <p className="mt-2 text-body-sm font-light text-text-secondary">配置收款规则，链上透明可验证</p>
          <div className="mt-5 inline-flex min-h-touch items-center rounded-lg border border-border-interactive bg-surface-card px-4 py-2 text-button-sm font-light text-text-primary transition-colors duration-normal ease-standard group-hover:border-border-interactive-strong">
            进入配置页 →
          </div>
        </button>
      </section>

      <section className="mx-auto mt-11 w-full max-w-[760px] border-t border-border pt-7">
        <div className="grid grid-cols-3 gap-3 text-left">
          {[
            { value: '$7.2K', label: '已路由金额' },
            { value: '4', label: '支持链路' },
            { value: '100%', label: '链上透明' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-lg bg-surface-card/80 p-3 shadow-xs">
              <div className="text-h3 font-medium text-text-primary">{value}</div>
              <div className="mt-1 text-caption font-medium text-text-secondary">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
