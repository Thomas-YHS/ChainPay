import { Link, useLocation } from 'react-router-dom'
import WalletButton from './WalletButton'

export default function TopNav() {
  const { pathname } = useLocation()
  const isEmployer = pathname.startsWith('/employer')
  const isEmployee = pathname.startsWith('/employee')

  return (
    <nav className="flex items-center px-6 h-14 border-b" style={{ background: '#0f1117', borderColor: '#1e2030' }}>
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mr-6">
        <span className="w-2 h-2 rounded-full bg-indigo-500" />
        <span className="text-white font-bold text-sm tracking-widest font-mono">CHAINPAY</span>
      </Link>

      {/* Role tabs */}
      <div className="flex gap-1">
        <Link
          to="/employer/employees"
          className="px-4 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            background: isEmployer ? '#6366f1' : 'transparent',
            color: isEmployer ? '#fff' : '#4b5563',
          }}
        >
          雇主端
        </Link>
        <Link
          to="/employee"
          className="px-4 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            background: isEmployee ? '#6366f1' : 'transparent',
            color: isEmployee ? '#fff' : '#4b5563',
          }}
        >
          员工端
        </Link>
      </div>

      {/* Wallet */}
      <div className="ml-auto">
        <WalletButton />
      </div>
    </nav>
  )
}
