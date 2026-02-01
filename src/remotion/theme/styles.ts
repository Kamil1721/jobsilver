/**
 * Shared style constants for Remotion compositions
 * Includes shadows, gradients, and animation easings
 */

import { Easing } from 'remotion'
import { colors } from './colors'

export const shadows = {
  // Subtle shadow for cards
  subtle: '0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
  // Elevated shadow
  elevated: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
  // Glow effect
  glow: '0 0 20px rgba(255, 255, 255, 0.1), 0 0 40px rgba(255, 255, 255, 0.05)',
} as const

export const gradients = {
  // Metallic horizontal gradient
  metallic: `linear-gradient(to right, ${colors.metallic.dark}, ${colors.metallic.mid}, ${colors.metallic.dark})`,
  // Metallic button background
  metallicButton: `linear-gradient(to bottom, ${colors.metallic.darker}, ${colors.metallic.darkest})`,
  // Shine sweep effect
  shine: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)',
  // Card top glow
  cardGlow: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 0%, transparent 100%)',
  // Background gradient
  background: `linear-gradient(to bottom, ${colors.background.base}, ${colors.background.elevated})`,
} as const

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const

// Custom easing functions for animations
export const easings = {
  // Spring-like easing
  spring: Easing.bezier(0.175, 0.885, 0.32, 1.275),
  // Smooth in-out
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
  // Fast out, slow in
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  // Slow out, fast in
  accelerate: Easing.bezier(0.4, 0, 1, 1),
  // Elastic bounce
  bounce: Easing.bezier(0.68, -0.55, 0.265, 1.55),
} as const

// Animation timing presets (in frames at 30fps)
export const timing = {
  instant: 3,
  fast: 6,
  normal: 12,
  slow: 18,
  verySlow: 30,
} as const

// Common style mixins
export const mixins = {
  // Metallic card style
  metallicCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.subtle}`,
    overflow: 'hidden' as const,
  },
  // Glass panel style
  glassPanel: {
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
    backdropFilter: 'blur(12px)',
    borderRadius: borderRadius.xl,
    border: `1px solid ${colors.border.faint}`,
  },
  // Column container
  columnContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: borderRadius.xl,
    border: `1px solid ${colors.border.faint}`,
  },
} as const
