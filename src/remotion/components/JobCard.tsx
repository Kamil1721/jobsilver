import React from 'react'
import {
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius, spacing } from '../theme/styles'

interface JobCardProps {
  company: string
  title: string
  location: string
  jobType?: string
  delay?: number
  style?: React.CSSProperties
}

/**
 * Job card matching the actual dashboard design:
 * - Company name (bold)
 * - Job title
 * - Location · Job type
 * No match scores or avatars
 */
export const JobCard: React.FC<JobCardProps> = ({
  company,
  title,
  location,
  jobType,
  delay = 0,
  style = {},
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Spring animation for card entrance
  const enterOpacity = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 20,
      stiffness: 80,
    },
  })

  const enterY = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  })

  const translateY = (1 - enterY) * 8

  return (
    <div
      style={{
        padding: `${spacing[2] + 2}px ${spacing[3]}px`,
        borderRadius: borderRadius.lg,
        backgroundColor: 'transparent',
        border: `1px solid transparent`,
        opacity: enterOpacity,
        transform: `translateY(${translateY}px)`,
        transition: 'background-color 0.2s, border-color 0.2s',
        ...style,
      }}
    >
      {/* Company name - prominent */}
      <div
        style={{
          fontFamily: fonts.family,
          fontSize: fonts.sizes.sm,
          fontWeight: fonts.weights.medium,
          color: colors.text.primary,
          marginBottom: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {company}
      </div>

      {/* Job title */}
      <div
        style={{
          fontFamily: fonts.family,
          fontSize: fonts.sizes.xs,
          color: colors.text.secondary,
          marginBottom: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>

      {/* Location · Job type */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: fonts.family,
          fontSize: fonts.sizes.xs,
          color: colors.text.muted,
        }}
      >
        {location && <span>{location}</span>}
        {location && jobType && (
          <span style={{ color: colors.text.faint }}>·</span>
        )}
        {jobType && <span>{jobType}</span>}
      </div>
    </div>
  )
}
