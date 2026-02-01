import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/fonts'
import { borderRadius, spacing } from '../../theme/styles'

/**
 * Job Tracking Demo - 5 second loop
 * Shows cards being dragged between Kanban columns
 */

const columns = ['New', 'Applied', 'Interview']

export const JobTrackingDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Drag animation timing (frames 30-90)
  const dragStartFrame = 30
  const dragEndFrame = 90

  const dragProgress = interpolate(
    frame,
    [dragStartFrame, dragEndFrame],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }
  )

  // Card being dragged
  const isDragging = frame >= dragStartFrame && frame <= dragEndFrame
  const cardDragX = dragProgress * 180 // Move one column to the right
  const cardDragY = Math.sin(dragProgress * Math.PI) * -15 // Arc motion
  const cardRotation = Math.sin(dragProgress * Math.PI * 2) * 2

  // Success highlight after drop
  const successFrame = 95
  const successOpacity = interpolate(
    frame,
    [successFrame, successFrame + 10, successFrame + 25],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Loop fade
  const loopOpacity = interpolate(
    frame,
    [0, 10, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Column entrance
  const columnEntrance = (index: number) =>
    spring({
      frame: frame - index * 5,
      fps,
      config: { damping: 15, stiffness: 80 },
    })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background.base,
        fontFamily: fonts.family,
        padding: spacing[4],
        opacity: loopOpacity,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: spacing[3],
          height: '100%',
        }}
      >
        {columns.map((column, colIndex) => {
          const entrance = columnEntrance(colIndex)
          const isTargetColumn = colIndex === 1 // Applied column

          return (
            <div
              key={column}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: borderRadius.lg,
                border: `1px solid ${
                  isTargetColumn && isDragging
                    ? colors.status.interview
                    : colors.border.faint
                }`,
                padding: spacing[2],
                opacity: entrance,
                transform: `translateY(${(1 - entrance) * 20}px)`,
                transition: 'border-color 0.2s ease',
                position: 'relative',
              }}
            >
              {/* Success highlight */}
              {isTargetColumn && successOpacity > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: colors.status.interview,
                    opacity: successOpacity * 0.1,
                    borderRadius: borderRadius.lg,
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Column header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[2],
                  paddingBottom: spacing[2],
                  borderBottom: `1px solid ${colors.border.faint}`,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: fonts.weights.medium,
                    color: colors.text.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {column}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: colors.text.faint,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '1px 6px',
                    borderRadius: 8,
                  }}
                >
                  {colIndex === 0
                    ? frame > dragEndFrame
                      ? 1
                      : 2
                    : colIndex === 1
                    ? frame > dragEndFrame
                      ? 3
                      : 2
                    : 1}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Static cards in each column */}
                {colIndex === 0 && (
                  <>
                    {/* Draggable card */}
                    {frame <= dragEndFrame && (
                      <div
                        style={{
                          position: isDragging ? 'absolute' : 'relative',
                          zIndex: isDragging ? 100 : 1,
                          transform: `translate(${cardDragX}px, ${cardDragY}px) rotate(${cardRotation}deg)`,
                          boxShadow: isDragging
                            ? '0 10px 30px rgba(0, 0, 0, 0.4)'
                            : 'none',
                        }}
                      >
                        <MiniJobCard company="Stripe" score={94} />
                      </div>
                    )}
                    <MiniJobCard company="Linear" score={87} />
                  </>
                )}
                {colIndex === 1 && (
                  <>
                    {/* Card appears after drag */}
                    {frame > dragEndFrame && (
                      <div
                        style={{
                          opacity: interpolate(
                            frame,
                            [dragEndFrame, dragEndFrame + 10],
                            [0, 1],
                            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                          ),
                        }}
                      >
                        <MiniJobCard company="Stripe" score={94} />
                      </div>
                    )}
                    <MiniJobCard company="Vercel" score={89} />
                    <MiniJobCard company="Notion" score={82} />
                  </>
                )}
                {colIndex === 2 && <MiniJobCard company="Figma" score={78} />}
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// Mini job card component
const MiniJobCard: React.FC<{ company: string; score: number }> = ({
  company,
  score,
}) => {
  const getScoreColor = () => {
    if (score >= 80) return colors.matchScore.high
    if (score >= 60) return colors.matchScore.medium
    return colors.matchScore.low
  }

  const scoreColors = getScoreColor()

  return (
    <div
      style={{
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.md,
        border: `1px solid ${colors.border.subtle}`,
        padding: spacing[2],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: colors.metallic.mid,
              opacity: 0.3,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: fonts.weights.medium,
              color: colors.text.primary,
            }}
          >
            {company}
          </span>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: fonts.weights.semibold,
            color: scoreColors.text,
            backgroundColor: scoreColors.bg,
            padding: '1px 5px',
            borderRadius: 4,
            border: `1px solid ${scoreColors.border}`,
          }}
        >
          {score}%
        </span>
      </div>
    </div>
  )
}

export const jobTrackingDemoConfig = {
  id: 'JobTrackingDemo',
  component: JobTrackingDemo,
  durationInFrames: 150, // 5 seconds at 30fps
  fps: 30,
  width: 450,
  height: 300,
}
