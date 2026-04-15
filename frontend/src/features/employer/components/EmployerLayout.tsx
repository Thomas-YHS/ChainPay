import { Outlet, NavLink } from 'react-router-dom'
import TopNav from '../../shared/components/TopNav'
import { colors } from '../../../styles/tokens'

const navItems = [
  { to: '/employer/employees', icon: '👥', label: '员工' },
  { to: '/employer/payout', icon: '💸', label: '发薪' },
  { to: '/employer/history', icon: '📋', label: '记录' },
]

export default function EmployerLayout() {
  return (
    <div className="cp-shell flex min-h-screen flex-col">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-4 px-3 py-4 md:px-4 lg:gap-6 lg:px-8">
        <aside className="w-[88px] shrink-0 rounded-xl border border-border bg-surface-card p-2 shadow-xs md:w-[220px] md:p-3">
          <p className="mb-2 hidden px-2 text-caption font-medium uppercase text-text-secondary md:block">Employer Console</p>
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="mb-1.5 flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-body-sm font-light transition-colors duration-normal ease-standard last:mb-0"
              style={({ isActive }) => ({
                background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid transparent',
                color: isActive ? colors.brand.primary : colors.text.primary,
                fontWeight: isActive ? 500 : 300,
              })}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </aside>

        <main className="cp-card w-full flex-1 overflow-y-auto rounded-xl p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
