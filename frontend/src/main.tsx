import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import { base } from 'viem/chains'
import { createConfig } from '@lifi/sdk'
import App from './App'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: '#6366f1' })}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
