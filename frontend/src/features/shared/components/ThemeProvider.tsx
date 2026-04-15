import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { colors } from '../../../styles/tokens'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'chainpay-theme-mode'

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return getSystemTheme()
}

function hasStoredThemePreference() {
  if (typeof window === 'undefined') {
    return false
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)
  return storedTheme === 'light' || storedTheme === 'dark'
}

export function applyThemeMode(themeMode: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = themeMode
  document.documentElement.style.colorScheme = themeMode
}

interface ThemeContextValue {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const [pinnedPreference, setPinnedPreference] = useState(() => hasStoredThemePreference())

  useEffect(() => {
    applyThemeMode(themeMode)
  }, [themeMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (pinnedPreference) {
      window.localStorage.setItem(STORAGE_KEY, themeMode)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [pinnedPreference, themeMode])

  useEffect(() => {
    if (pinnedPreference || typeof window === 'undefined' || !window.matchMedia) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setThemeMode(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [pinnedPreference])

  const rainbowTheme = useMemo(() => {
    return themeMode === 'dark'
      ? darkTheme({
          accentColor: colors.brand.primary,
          accentColorForeground: colors.text.inverse,
          borderRadius: 'large',
          fontStack: 'system',
        })
      : lightTheme({
          accentColor: colors.brand.primary,
          accentColorForeground: colors.text.inverse,
          borderRadius: 'large',
          fontStack: 'system',
        })
  }, [themeMode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      setThemeMode: (mode) => {
        setPinnedPreference(true)
        setThemeMode(mode)
      },
      toggleThemeMode: () => {
        setPinnedPreference(true)
        setThemeMode((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
      },
    }),
    [themeMode],
  )

  return (
    <ThemeContext.Provider value={value}>
      <RainbowKitProvider theme={rainbowTheme}>{children}</RainbowKitProvider>
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider')
  }

  return context
}