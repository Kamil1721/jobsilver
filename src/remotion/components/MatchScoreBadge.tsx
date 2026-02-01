import React from 'react'
import {
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius } from '../theme/styles'

interface MatchScoreBadgeProps {
  score: number
  delay?: number
  animateCount?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const MatchScoreBadge: React.FC<MatchScoreBadgeProps> = ({
  score,
  delay = 0,
  animateCount = true,
  size = 'md',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Determine color based on score
  const getScoreColors = () => {
    if (score >= 80) return colors.matchScore.high
    if (score >= 60) return colors.matchScore.medium
    return colors.matchScore.low
  }

  const scoreColors = getScoreColors()

  // Spring animation for entrance
  const enterScale = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 12,
      stiffness: 150,
      mass: 0.5,
    },
  })

  // Count-up animation
  const displayScore = animateCount
    ? Math.round(
        interpolate(frame - delay, [0, 30], [0, score], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        })
      )
    : score

  // Pulse animation when count completes
  const pulseProgress = interpolate(frame - delay, [28, 35, 42], [1, 1.1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Size configurations
  const sizes = {
    sm: { padding: '2px 6px', fontSize: 10 },
    md: { padding: '3px 8px', fontSize: 12 },
    lg: { padding: '4px 12px', fontSize: 14 },
  }

  const sizeConfig = sizes[size]

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: sizeConfig.padding,
        borderRadius: borderRadius.md,
        backgroundColor: scoreColors.bg,
        border: `1px solid ${scoreColors.border}`,
        transform: `scale(${enterScale * pulseProgress})`,
        opacity: enterScale,
      }}
    >
      <span
        style={{
          fontFamily: fonts.family,
          fontSize: sizeConfig.fontSize,
          fontWeight: fonts.weights.semibold,
          color: scoreColors.text,
          letterSpacing: '-0.01em',
        }}
      >
        {displayScore}%
      </span>
    </div>
  )
}
