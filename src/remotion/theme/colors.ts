/**
 * JobSilver Metallic Color Palette
 * Matches the existing design system from globals.css
 */

export const colors = {
  // Background colors
  background: {
    base: '#0a0a0b',
    elevated: '#111113',
    card: 'rgba(24, 24, 27, 0.8)',
    panel: 'rgba(24, 24, 27, 0.5)',
  },

  // Border colors
  border: {
    faint: 'rgba(255, 255, 255, 0.04)',
    subtle: 'rgba(255, 255, 255, 0.06)',
    medium: 'rgba(255, 255, 255, 0.10)',
    strong: 'rgba(255, 255, 255, 0.15)',
  },

  // Text colors
  text: {
    primary: '#fafafa',
    secondary: '#a1a1aa',
    muted: '#71717a',
    faint: '#52525b',
  },

  // Metallic gradient colors
  metallic: {
    light: '#a1a1aa',
    mid: '#71717a',
    dark: '#3f3f46',
    darker: '#27272a',
    darkest: '#18181b',
  },

  // Status colors
  status: {
    new: '#a1a1aa',
    applied: '#a78bfa',
    interview: '#34d399',
    offer: '#22c55e',
    rejected: '#f87171',
  },

  // Accent colors for effects
  shine: 'rgba(255, 255, 255, 0.20)',
  glow: 'rgba(255, 255, 255, 0.08)',

  // Match score colors
  matchScore: {
    high: {
      bg: 'rgba(52, 211, 153, 0.10)',
      text: '#34d399',
      border: 'rgba(52, 211, 153, 0.20)',
    },
    medium: {
      bg: 'rgba(251, 191, 36, 0.10)',
      text: '#fbbf24',
      border: 'rgba(251, 191, 36, 0.20)',
    },
    low: {
      bg: 'rgba(161, 161, 170, 0.10)',
      text: '#a1a1aa',
      border: 'rgba(161, 161, 170, 0.20)',
    },
  },
} as const

export type Colors = typeof colors
