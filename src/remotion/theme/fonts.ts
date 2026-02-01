/**
 * Font configuration for Remotion compositions
 * Uses Inter to match the main application
 */

import { loadFont } from '@remotion/google-fonts/Inter'

// Load Inter font for Remotion
const { fontFamily, waitUntilDone } = loadFont()

export const fonts = {
  family: fontFamily,
  waitUntilDone,
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
} as const

export type Fonts = typeof fonts
