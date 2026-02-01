import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius, spacing } from '../theme/styles'

type ColumnType = 'discovered' | 'applied' | 'offer'

interface KanbanColumnProps {
  type: ColumnType
  title: string
  count: number
  children: React.ReactNode
  delay?: number
  emptyText?: string
  style?: React.CSSProperties
}

// Status dot colors matching the actual dashboard
const statusDotColors: Record<ColumnType, string> = {
  discovered: colors.text.muted, // Gray
  applied: colors.text.secondary, // Gray
  offer: '#34d399', // Emerald/green
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  type,
  title,
  count,
  children,
  delay = 0,
  emptyText,
  style = {},
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Column entrance animation
  const enterOpacity = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 20,
      stiffness: 60,
    },
  })

  const enterY = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
  })

  const translateY = (1 - enterY) * 20
  const dotColor = statusDotColors[type]

  return (
    <div
      style={{
        flex: 1,
        minWidth: 200,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: borderRadius.xl,
        border: `1px solid ${colors.border.faint}`,
        display: 'flex',
        flexDirection: 'column',
        opacity: enterOpacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing[3]}px ${spacing[4]}px`,
          borderBottom: `1px solid ${colors.border.faint}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Status dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: dotColor,
            }}
          />
          <span
            style={{
              fontFamily: fonts.family,
              fontSize: fonts.sizes.xs,
              fontWeight: fonts.weights.semibold,
              color: colors.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {title}
          </span>
        </div>

        {/* Count badge */}
        <span
          style={{
            fontFamily: fonts.family,
            fontSize: fonts.sizes.xs,
            fontWeight: fonts.weights.medium,
            color: colors.text.muted,
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          {count}
        </span>
      </div>

      {/* Column content */}
      <div
        style={{
          padding: spacing[2],
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 150,
        }}
      >
        {React.Children.count(children) > 0 ? (
          children
        ) : emptyText ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              padding: spacing[4],
            }}
          >
            <span
              style={{
                fontFamily: fonts.family,
                fontSize: fonts.sizes.sm,
                color: colors.text.muted,
              }}
            >
              No jobs yet
            </span>
            <span
              style={{
                fontFamily: fonts.family,
                fontSize: fonts.sizes.xs,
                color: colors.text.faint,
                marginTop: 4,
              }}
            >
              {emptyText}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
