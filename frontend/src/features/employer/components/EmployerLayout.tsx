import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import TopNav from '../../shared/components/TopNav'

const navItems = [
  { to: '/employer/employees', icon: '👥', label: '员工' },
  { to: '/employer/payout', icon: '💸', label: '发薪' },
  { to: '/employer/history', icon: '📋', label: '记录' },
]

export default function EmployerLayout() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (!isConnected) navigate('/')
  }, [isConnected, navigate])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1117' }}>
      <TopNav />
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-20 flex flex-col py-4 gap-1" style={{ background: '#0d1017', borderRight: '1px solid #1e2030' }}>
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center py-3 px-2 rounded-md mx-1 text-center transition-colors"
              style={({ isActive }) => ({
                background: isActive ? '#1e2030' : 'transparent',
                borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
                color: isActive ? '#fff' : '#4b5563',
              })}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </aside>
        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
