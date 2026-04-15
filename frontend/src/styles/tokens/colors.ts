const rgb = (name: string) => `rgb(var(${name}))`
const rgbAlpha = (name: string) => `rgb(var(${name}) / <alpha-value>)`

export const colors = {
  brand: {
    primary: rgb('--cp-brand-primary'),
    primaryHover: rgb('--cp-brand-hover'),
    primaryActive: rgb('--cp-brand-active'),
  },
  text: {
    primary: rgb('--cp-text-primary'),
    secondary: rgb('--cp-text-secondary'),
    muted: rgb('--cp-text-muted'),
    inverse: rgb('--cp-text-inverse'),
  },
  surface: {
    canvas: rgb('--cp-surface-canvas'),
    card: rgb('--cp-surface-card'),
    soft: rgb('--cp-surface-soft'),
    separator: rgb('--cp-surface-separator'),
    overlay: rgb('--cp-surface-overlay'),
  },
  border: {
    default: rgb('--cp-border-default'),
    subtle: rgb('--cp-border-subtle'),
    interactive: rgb('--cp-border-interactive'),
    interactiveStrong: rgb('--cp-border-interactive-strong'),
  },
  status: {
    success: rgb('--cp-status-success'),
    error: rgb('--cp-status-error'),
    warning: rgb('--cp-status-warning'),
    warningAlt: rgb('--cp-status-warning-alt'),
    info: rgb('--cp-status-info'),
  },
  accent: {
    telegram: rgb('--cp-accent-telegram'),
    champagne: rgb('--cp-accent-champagne'),
    destructive: rgb('--cp-accent-destructive'),
  },
  grid: {
    dot: rgb('--cp-grid-dot'),
  },
} as const

export const tailwindColors = {
  brand: {
    primary: rgbAlpha('--cp-brand-primary'),
    hover: rgbAlpha('--cp-brand-hover'),
    active: rgbAlpha('--cp-brand-active'),
  },
  text: {
    primary: rgbAlpha('--cp-text-primary'),
    secondary: rgbAlpha('--cp-text-secondary'),
    muted: rgbAlpha('--cp-text-muted'),
    inverse: rgbAlpha('--cp-text-inverse'),
  },
  surface: {
    canvas: rgbAlpha('--cp-surface-canvas'),
    card: rgbAlpha('--cp-surface-card'),
    soft: rgbAlpha('--cp-surface-soft'),
    separator: rgbAlpha('--cp-surface-separator'),
    overlay: rgbAlpha('--cp-surface-overlay'),
  },
  border: {
    DEFAULT: rgbAlpha('--cp-border-default'),
    subtle: rgbAlpha('--cp-border-subtle'),
    interactive: rgbAlpha('--cp-border-interactive'),
    'interactive-strong': rgbAlpha('--cp-border-interactive-strong'),
  },
  status: {
    success: rgbAlpha('--cp-status-success'),
    error: rgbAlpha('--cp-status-error'),
    warning: rgbAlpha('--cp-status-warning'),
    'warning-alt': rgbAlpha('--cp-status-warning-alt'),
    info: rgbAlpha('--cp-status-info'),
  },
  accent: {
    telegram: rgbAlpha('--cp-accent-telegram'),
    champagne: rgbAlpha('--cp-accent-champagne'),
    destructive: rgbAlpha('--cp-accent-destructive'),
  },
} as const

export type ColorTokens = typeof colors
