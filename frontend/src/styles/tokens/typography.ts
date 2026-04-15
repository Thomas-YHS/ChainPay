export const typography = {
  fontFamily: {
    sans: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  },
  fontWeight: {
    light: 300,
    medium: 500,
  },
  fontSize: {
    display: '36px',
    h2: '24px',
    h3: '20px',
    h4: '14px',
    body: '16px',
    bodySmall: '14px',
    caption: '12px',
    button: '18px',
    buttonSmall: '14px',
    code: '12px',
  },
  lineHeight: {
    display: '40px',
    h2: '32px',
    h3: '28px',
    h4: '20px',
    body: '24px',
    bodySmall: '20px',
    caption: '16px',
    button: '28px',
    buttonSmall: '20px',
    code: '16px',
  },
  letterSpacing: {
    tightDisplay: '-0.02em',
    tightHeading: '-0.01em',
    normal: '0em',
    wideCaption: '0.02em',
    wideCode: '0.04em',
  },
} as const

export type TypographyTokens = typeof typography
