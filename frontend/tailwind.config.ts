import { tailwindColors, motion, radius, shadows, spacing, typography } from './src/styles/tokens'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: spacing[4],
        sm: spacing[4],
        lg: spacing[8],
        xl: spacing[8],
      },
      screens: {
        xl: '1400px',
      },
    },
    extend: {
      colors: {
        brand: {
          primary: tailwindColors.brand.primary,
          hover: tailwindColors.brand.hover,
          active: tailwindColors.brand.active,
        },
        text: {
          primary: tailwindColors.text.primary,
          secondary: tailwindColors.text.secondary,
          muted: tailwindColors.text.muted,
          inverse: tailwindColors.text.inverse,
        },
        surface: {
          canvas: tailwindColors.surface.canvas,
          card: tailwindColors.surface.card,
          soft: tailwindColors.surface.soft,
          separator: tailwindColors.surface.separator,
          overlay: tailwindColors.surface.overlay,
        },
        border: {
          DEFAULT: tailwindColors.border.DEFAULT,
          subtle: tailwindColors.border.subtle,
          interactive: tailwindColors.border.interactive,
          'interactive-strong': tailwindColors.border['interactive-strong'],
        },
        status: {
          success: tailwindColors.status.success,
          error: tailwindColors.status.error,
          warning: tailwindColors.status.warning,
          'warning-alt': tailwindColors.status['warning-alt'],
          info: tailwindColors.status.info,
        },
        accent: {
          telegram: tailwindColors.accent.telegram,
          champagne: tailwindColors.accent.champagne,
          destructive: tailwindColors.accent.destructive,
        },
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      fontWeight: {
        light: String(typography.fontWeight.light),
        medium: String(typography.fontWeight.medium),
      },
      fontSize: {
        display: [typography.fontSize.display, { lineHeight: typography.lineHeight.display, letterSpacing: typography.letterSpacing.tightDisplay }],
        h2: [typography.fontSize.h2, { lineHeight: typography.lineHeight.h2, letterSpacing: typography.letterSpacing.tightHeading }],
        h3: [typography.fontSize.h3, { lineHeight: typography.lineHeight.h3, letterSpacing: typography.letterSpacing.normal }],
        h4: [typography.fontSize.h4, { lineHeight: typography.lineHeight.h4, letterSpacing: typography.letterSpacing.wideCaption }],
        body: [typography.fontSize.body, { lineHeight: typography.lineHeight.body, letterSpacing: typography.letterSpacing.normal }],
        'body-sm': [typography.fontSize.bodySmall, { lineHeight: typography.lineHeight.bodySmall, letterSpacing: typography.letterSpacing.normal }],
        caption: [typography.fontSize.caption, { lineHeight: typography.lineHeight.caption, letterSpacing: typography.letterSpacing.wideCaption }],
        button: [typography.fontSize.button, { lineHeight: typography.lineHeight.button, letterSpacing: typography.letterSpacing.normal }],
        'button-sm': [typography.fontSize.buttonSmall, { lineHeight: typography.lineHeight.buttonSmall, letterSpacing: typography.letterSpacing.normal }],
        code: [typography.fontSize.code, { lineHeight: typography.lineHeight.code, letterSpacing: typography.letterSpacing.wideCode }],
      },
      spacing,
      borderRadius: {
        none: radius.none,
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        full: radius.full,
      },
      boxShadow: {
        flat: shadows.flat,
        xs: shadows.xs,
        sm: shadows.sm,
        md: shadows.md,
        lg: shadows.lg,
      },
      transitionDuration: {
        fast: motion.duration.fast,
        normal: motion.duration.normal,
        slow: motion.duration.slow,
      },
      transitionTimingFunction: {
        standard: motion.easing.standard,
        emphasize: motion.easing.emphasize,
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, rgb(var(--cp-grid-dot) / 0.55) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '24px 24px',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      maxWidth: {
        content: '1100px',
      },
    },
  },
} satisfies import('tailwindcss').Config
