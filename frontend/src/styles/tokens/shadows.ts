export const shadows = {
  flat: 'none',
  xs: 'rgba(0, 0, 0, 0.04) 2px 2px 4px 0px',
  sm: 'rgba(99, 102, 241, 0.1) 0px 8px 32px 0px',
  md: 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px',
  lg: 'rgba(99, 102, 241, 0.18) 0px 4px 24px 0px, rgba(0, 0, 0, 0.06) 0px 1px 3px 0px',
} as const

export type ShadowTokens = typeof shadows
