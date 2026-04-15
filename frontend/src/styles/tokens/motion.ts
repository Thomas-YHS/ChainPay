export const motion = {
  duration: {
    fast: '120ms',
    normal: '180ms',
    slow: '260ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasize: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
} as const

export type MotionTokens = typeof motion
