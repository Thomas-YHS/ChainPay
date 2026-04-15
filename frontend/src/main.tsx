import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'viem/chains'
import { createConfig } from '@lifi/sdk'
import App from './App'
import { applyThemeMode, getInitialThemeMode, ThemeProvider } from './features/shared/components/ThemeProvider'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'

// Li.Fi SDK — initialize once at app start
createConfig({ integrator: 'ChainPay' })

const wagmiConfig = getDefaultConfig({
  appName: 'ChainPay',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string,
  chains: [base],
})

const queryClient = new QueryClient()
applyThemeMode(getInitialThemeMode())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
