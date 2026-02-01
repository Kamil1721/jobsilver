import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius, spacing } from '../theme/styles'

interface ApplyButtonProps {
  /** X position */
  x: number
  /** Y position */
  y: number
  /** Width of the button */
  width?: number
  /** Frame at which button appears */
  enterFrame?: number
  /** Frame at which button gets clicked */
  clickFrame?: number
  /** Whether the button should pulse/glow */
  pulse?: boolean
}

/**
 * Apply Now button with pulse/glow animation
 */
export const ApplyButton: React.FC<ApplyButtonProps> = ({
  x,
  y,
  width = 120,
  enterFrame = 0,
  clickFrame,
  pulse = false,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entrance animation
  const entrance = spring({
    frame: frame - enterFrame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  })

  if (frame < enterFrame) {
    return null
  }

  // Pulse animation
  const pulsePhase = (frame / 15) * Math.PI * 2
  const glowIntensity = pulse ? 0.2 + Math.sin(pulsePhase) * 0.1 : 0
  const scaleOffset = pulse ? Math.sin(pulsePhase) * 0.02 : 0

  // Click animation
  let clickScale = 1
  let clickGlow = 0
  if (clickFrame && frame >= clickFrame) {
    const clickProgress = frame - clickFrame
    clickScale = interpolate(
      clickProgress,
      [0, 3, 6, 10],
      [1, 0.9, 1.05, 1],
      { extrapolateRight: 'clamp' }
    )
    clickGlow = interpolate(
      clickProgress,
      [0, 5, 15],
      [0, 0.5, 0],
      { extrapolateRight: 'clamp' }
    )
  }

  const totalScale = entrance * (1 + scaleOffset) * clickScale

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${totalScale})`,
        transformOrigin: 'center',
      }}
    >
      {/* Outer glow */}
      <div
        style={{
          position: 'absolute',
          inset: -15,
          background: `radial-gradient(ellipse at center, ${colors.status.interview} 0%, transparent 70%)`,
          opacity: glowIntensity + clickGlow,
          borderRadius: borderRadius['2xl'],
        }}
      />

      {/* Button */}
      <button
        style={{
          position: 'relative',
          width,
          padding: `${spacing[2]}px ${spacing[4]}px`,
          backgroundColor: colors.status.interview,
          color: 'white',
          fontSize: fonts.sizes.sm,
          fontWeight: fonts.weights.medium,
          border: 'none',
          borderRadius: borderRadius.md,
          cursor: 'pointer',
          fontFamily: fonts.family,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          boxShadow: `0 4px 12px rgba(52, 211, 153, 0.3)`,
        }}
      >
        Apply Now
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

export default ApplyButton
