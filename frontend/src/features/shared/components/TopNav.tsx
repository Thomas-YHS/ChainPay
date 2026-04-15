import { Link, useLocation } from 'react-router-dom'
import WalletButton from './WalletButton'
import { colors } from '../../../styles/tokens'
import { useThemeMode } from './ThemeProvider'

export default function TopNav() {
  const { pathname } = useLocation()
  const isEmployer = pathname.startsWith('/employer')
  const isEmployee = pathname.startsWith('/employee')
  const { themeMode, toggleThemeMode } = useThemeMode()

  return (
    <nav
      className="cp-nav sticky top-0 z-50 flex h-16 items-center border-b border-border px-4 shadow-md backdrop-blur lg:px-8"
    >
      <Link to="/" className="mr-4 flex items-center gap-2 lg:mr-8">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
        <span className="font-mono text-sm font-medium tracking-[0.18em] text-text-primary">CHAINPAY</span>
      </Link>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-1 shadow-sm">
        <Link
          to="/employer/employees"
          className="min-w-touch rounded-md px-3 py-2 text-body-sm font-light transition-colors duration-normal ease-standard"
          style={{
            background: isEmployer ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
            color: isEmployer ? colors.brand.primary : colors.text.primary,
            fontWeight: isEmployer ? 500 : 300,
          }}
        >
          雇主端
        </Link>
        <Link
          to="/employee"
          className="min-w-touch rounded-md px-3 py-2 text-body-sm font-light transition-colors duration-normal ease-standard"
          style={{
            background: isEmployee ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
            color: isEmployee ? colors.brand.primary : colors.text.primary,
            fontWeight: isEmployee ? 500 : 300,
          }}
        >
          员工端
        </Link>
      </div>

      <div className="ml-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleThemeMode}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-lg border border-border-interactive bg-surface-card px-2 text-caption font-medium text-text-secondary shadow-sm transition-colors duration-normal ease-standard hover:border-border-interactive-strong hover:text-brand-primary"
            aria-label={`切换到${themeMode === 'dark' ? '浅色' : '深色'}主题`}
            title={`切换到${themeMode === 'dark' ? '浅色' : '深色'}主题`}
            aria-pressed={themeMode === 'dark'}
          >
            <span aria-hidden="true">{themeMode === 'dark' ? '☀' : '🌙'}</span>
          </button>
          <WalletButton />
        </div>
      </div>
    </nav>
  )
}
