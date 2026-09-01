import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/fonts'
import { borderRadius, spacing } from '../../theme/styles'

/**
 * Smart Filters Demo - 5 second loop
 * Shows filter chips appearing and jobs filtering in real-time
 */

const filterChips = [
  { label: 'Remote', delay: 10 },
  { label: 'Senior', delay: 20 },
  { label: '$150k+', delay: 30 },
]

const allJobs = [
  { company: 'Stripe', title: 'Senior Engineer', remote: true, salary: 180 },
  { company: 'Google', title: 'Junior Dev', remote: false, salary: 90 },
  { company: 'Vercel', title: 'Senior Developer', remote: true, salary: 170 },
  { company: 'Meta', title: 'Engineer', remote: false, salary: 160 },
  { company: 'Linear', title: 'Senior Engineer', remote: true, salary: 165 },
  { company: 'Notion', title: 'Developer', remote: true, salary: 120 },
]

export const SmartFiltersDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Determine which filters are active based on frame
  const activeFilters = filterChips.filter((chip) => frame >= chip.delay + 15)

  // Filter jobs based on active filters
  const filteredJobs = allJobs.filter((job) => {
    if (activeFilters.length === 0) return true
    let match = true
    if (activeFilters.find((f) => f.label === 'Remote')) {
      match = match && job.remote
    }
    if (activeFilters.find((f) => f.label === 'Senior')) {
      match = match && job.title.includes('Senior')
    }
    if (activeFilters.find((f) => f.label === '$150k+')) {
      match = match && job.salary >= 150
    }
    return match
  })

  // Loop fade
  const loopOpacity = interpolate(
    frame,
    [0, 10, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background.base,
        fontFamily: fonts.family,
        padding: spacing[4],
        opacity: loopOpacity,
      }}
    >
      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: spacing[2],
          marginBottom: spacing[4],
          flexWrap: 'wrap',
        }}
      >
        {filterChips.map((chip) => {
          const chipScale = spring({
            frame: frame - chip.delay,
            fps,
            config: { damping: 12, stiffness: 150, mass: 0.5 },
          })

          const isActive = activeFilters.includes(chip)
          const activateProgress = interpolate(
            frame - chip.delay,
            [0, 15],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )

          return (
            <div
              key={chip.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: `${spacing[1]}px ${spacing[3]}px`,
                borderRadius: 9999,
                backgroundColor: isActive
                  ? `rgba(52, 211, 153, ${activateProgress * 0.15})`
                  : colors.background.card,
                border: `1px solid ${
                  isActive
                    ? `rgba(52, 211, 153, ${activateProgress * 0.5})`
                    : colors.border.medium
                }`,
                transform: `scale(${chipScale})`,
                opacity: chipScale,
                transition: 'background-color 0.2s, border-color 0.2s',
              }}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: isActive
                    ? colors.status.interview
                    : 'transparent',
                  border: `1.5px solid ${
                    isActive ? colors.status.interview : colors.border.strong
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isActive && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: `scale(${activateProgress})`,
                    }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span
                style={{
                  fontSize: fonts.sizes.xs,
                  fontWeight: fonts.weights.medium,
                  color: isActive ? colors.status.interview : colors.text.secondary,
                }}
              >
                {chip.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Job list */}
      <div
        style={{
          backgroundColor: colors.background.card,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.subtle}`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: `${spacing[2]}px ${spacing[3]}px`,
            borderBottom: `1px solid ${colors.border.faint}`,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: fonts.sizes.xs,
              fontWeight: fonts.weights.medium,
              color: colors.text.muted,
            }}
          >
            Results
          </span>
          <span
            style={{
              fontSize: fonts.sizes.xs,
              color: colors.text.faint,
            }}
          >
            {filteredJobs.length} jobs
          </span>
        </div>

        {/* Job items */}
        <div style={{ maxHeight: 200, overflow: 'hidden' }}>
          {allJobs.map((job) => {
            const isVisible = filteredJobs.includes(job)
            const itemOpacity = spring({
              frame: isVisible ? frame : frame - 5,
              fps,
              from: isVisible ? 0 : 1,
              to: isVisible ? 1 : 0,
              config: { damping: 15, stiffness: 100 },
            })

            if (!isVisible && itemOpacity < 0.1) return null

            return (
              <div
                key={job.company}
                style={{
                  padding: `${spacing[2]}px ${spacing[3]}px`,
                  borderBottom: `1px solid ${colors.border.faint}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: itemOpacity,
                  transform: `translateY(${(1 - itemOpacity) * 10}px)`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      backgroundColor: colors.metallic.mid,
                      opacity: 0.3,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: fonts.sizes.sm,
                        fontWeight: fonts.weights.medium,
                        color: colors.text.primary,
                      }}
                    >
                      {job.company}
                    </div>
                    <div
                      style={{
                        fontSize: fonts.sizes.xs,
                        color: colors.text.muted,
                      }}
                    >
                      {job.title}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {job.remote && (
                    <span
                      style={{
                        fontSize: 9,
                        color: colors.status.interview,
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      Remote
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: fonts.sizes.xs,
                      color: colors.text.faint,
                    }}
                  >
                    ${job.salary}k
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const smartFiltersDemoConfig = {
  id: 'SmartFiltersDemo',
  component: SmartFiltersDemo,
  durationInFrames: 150, // 5 seconds at 30fps
  fps: 30,
  width: 400,
  height: 350,
}
