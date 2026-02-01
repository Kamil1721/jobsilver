import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion'
import { colors } from '../theme/colors'
import { borderRadius, shadows, gradients } from '../theme/styles'

interface MetallicCardProps {
  children: React.ReactNode
  width?: number | string
  height?: number | string
  delay?: number
  showShine?: boolean
  shineDelay?: number
  style?: React.CSSProperties
}

export const MetallicCard: React.FC<MetallicCardProps> = ({
  children,
  width = '100%',
  height = 'auto',
  delay = 0,
  showShine = true,
  shineDelay = 0,
  style = {},
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Spring animation for card entrance
  const enterScale = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
      mass: 0.8,
    },
  })

  const enterOpacity = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 20,
      stiffness: 80,
    },
  })

  // Shine sweep animation
  const shineProgress = interpolate(
    frame - delay - shineDelay,
    [0, 45],
    [-100, 200],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  )

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.border.subtle}`,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: shadows.subtle,
        transform: `scale(${enterScale})`,
        opacity: enterOpacity,
        ...style,
      }}
    >
      {/* Top glow gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '40%',
          background: gradients.cardGlow,
          pointerEvents: 'none',
        }}
      />

      {/* Shine sweep effect */}
      {showShine && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${shineProgress}%`,
            width: '50px',
            height: '100%',
            background: gradients.shine,
            transform: 'skewX(-20deg)',
            pointerEvents: 'none',
            opacity: shineProgress > -50 && shineProgress < 150 ? 1 : 0,
          }}
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
