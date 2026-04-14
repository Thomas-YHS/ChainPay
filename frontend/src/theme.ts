export const colors = {
  bg: '#0f1117',
  bgSidebar: '#0d1017',
  card: '#1e2030',
  cardDeep: '#252840',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  text: '#ffffff',
  textMuted: '#94a3b8',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#2d3155',
} as const

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const LIFI_DIAMOND_BASE = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'
export const CHAIN_PAY_CONTRACT = import.meta.env.VITE_CHAIN_PAY_CONTRACT as `0x${string}`
export const API_URL = import.meta.env.VITE_API_URL as string

export const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', label: 'Base' },
  { id: 42161, name: 'Arbitrum', label: 'Arbitrum' },
  { id: 100, name: 'Gnosis', label: 'Gnosis' },
  { id: 10, name: 'Optimism', label: 'Optimism' },
] as const

export const SUPPORTED_TOKENS: Record<number, { symbol: string; address: string }[]> = {
  8453: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: USDC_BASE },
  ],
  42161: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  ],
  100: [
    { symbol: 'xDAI', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83' },
  ],
  10: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  ],
}

export const PAY_FREQUENCY_LABELS: Record<string, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
}

export const LIFI_API_KEY = (import.meta.env.VITE_LIFI_API_KEY as string) ?? ''
