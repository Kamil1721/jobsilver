import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { colors } from '../theme/colors'
import { borderRadius, shadows } from '../theme/styles'

interface GlassPanelProps {
  children: React.ReactNode
  width?: number | string
  height?: number | string
  delay?: number
  style?: React.CSSProperties
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  width = '100%',
  height = '100%',
  delay = 0,
  style = {},
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Fade in animation
  const opacity = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 20,
      stiffness: 60,
    },
  })

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: 'rgba(24, 24, 27, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRadius: borderRadius['2xl'],
        border: `1px solid ${colors.border.faint}`,
        boxShadow: shadows.elevated,
        position: 'relative',
        overflow: 'hidden',
        opacity,
        ...style,
      }}
    >
      {/* Top shine line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '25%',
          width: '50%',
          height: 1,
          background:
            'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent)',
        }}
      />

      {/* Content */}
      {children}
    </div>
  )
}
