import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion'
import { JobCard } from '../components/JobCard'
import { KanbanColumn } from '../components/KanbanColumn'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius, spacing } from '../theme/styles'

// Sample job data matching real dashboard format
const newMatchesJobs = [
  {
    company: 'Bamboo Works',
    title: 'AI Clone & Avatar Specialist',
    location: 'Remote',
    jobType: 'contractor',
  },
  {
    company: 'GitLab',
    title: 'Senior Frontend Engineer, AI Engineering',
    location: 'Remote',
    jobType: 'FT',
  },
  {
    company: 'Visma',
    title: 'Cyber Security Engineer (DevSecOps)',
    location: 'Remote',
    jobType: 'FT',
  },
  {
    company: 'Flatiron School',
    title: 'AI Engineer Career Starter Program',
    location: 'Remote',
    jobType: 'contractor',
  },
]

const appliedJobs = [
  {
    company: 'Stripe',
    title: 'Senior Frontend Engineer',
    location: 'San Francisco, CA',
    jobType: 'FT',
  },
]

const offerJobs = [
  {
    company: 'Linear',
    title: 'Product Engineer',
    location: 'Remote',
    jobType: 'FT',
  },
]

export const LandingHero: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Background fade in
  const bgOpacity = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 40 },
  })

  // Drag animation timing (frames 180-270 = 6-9 seconds)
  const dragStartFrame = 180
  const dragEndFrame = 270
  const isDragging = frame >= dragStartFrame && frame <= dragEndFrame

  // Calculate drag progress
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

  // Card position during drag - moving from NEW MATCHES to APPLIED
  // Move right by approximately one column width
  const dragX = dragProgress * 340
  const dragY = dragProgress * 30 + Math.sin(dragProgress * Math.PI) * -20
  const dragScale = 1 + Math.sin(dragProgress * Math.PI) * 0.02
  const dragShadow = Math.sin(dragProgress * Math.PI) * 20

  // Success pulse after drop (frames 280-320)
  const successFrame = 280
  const successOpacity = interpolate(
    frame,
    [successFrame, successFrame + 15, successFrame + 40],
    [0, 0.3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Loop transition (last 60 frames)
  const loopFadeStart = durationInFrames - 60
  const loopOpacity = interpolate(
    frame,
    [0, 30, loopFadeStart, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Determine counts based on animation state
  const newMatchesCount = frame > dragEndFrame ? 3 : 4
  const appliedCount = frame > dragEndFrame ? 2 : 1

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background.base,
        fontFamily: fonts.family,
        opacity: bgOpacity * loopOpacity,
      }}
    >
      {/* Main container - NO overflow hidden to prevent clipping */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: 24,
        }}
      >
        {/* Browser chrome header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: `1px solid ${colors.border.faint}`,
          }}
        >
          {/* Window controls */}
          <div style={{ display: 'flex', gap: 6, marginRight: 'auto' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: colors.metallic.dark,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>

          {/* URL bar - centered */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 20px',
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colors.border.faint}`,
            }}
          >
            <span
              style={{
                fontFamily: fonts.family,
                fontSize: 11,
                color: colors.text.faint,
              }}
            >
              jobsilver.com/dashboard
            </span>
          </div>
        </div>

        {/* Kanban board - relative positioning for drag overlay */}
        <div
          style={{
            display: 'flex',
            gap: spacing[4],
            flex: 1,
            position: 'relative',
          }}
        >
          {/* NEW MATCHES column */}
          <KanbanColumn
            type="discovered"
            title="NEW MATCHES"
            count={newMatchesCount}
            delay={15}
          >
            {newMatchesJobs.map((job, index) => {
              // First job gets dragged after dragStartFrame
              if (index === 0) {
                // Before drag starts, show in place
                if (frame < dragStartFrame) {
                  return (
                    <JobCard
                      key={job.company}
                      {...job}
                      delay={60 + index * 15}
                    />
                  )
                }
                // During drag, hide from column (it's shown as overlay)
                if (frame <= dragEndFrame) {
                  return null
                }
                // After drag completes, don't show (moved to Applied)
                return null
              }

              // Other jobs - slide up after first card is removed
              const slideUp = frame > dragEndFrame
              return (
                <div
                  key={job.company}
                  style={{
                    transform: slideUp ? 'translateY(-4px)' : 'none',
                    transition: 'transform 0.3s ease',
                  }}
                >
                  <JobCard {...job} delay={60 + index * 15} />
                </div>
              )
            })}
          </KanbanColumn>

          {/* APPLIED column */}
          <KanbanColumn
            type="applied"
            title="APPLIED"
            count={appliedCount}
            delay={25}
            emptyText="Drag jobs here when you apply"
          >
            {/* Show the dropped card after drag completes */}
            {frame > dragEndFrame && (
              <div
                style={{
                  position: 'relative',
                }}
              >
                <JobCard
                  {...newMatchesJobs[0]}
                  delay={0}
                  style={{
                    opacity: interpolate(
                      frame,
                      [dragEndFrame, dragEndFrame + 10],
                      [0, 1],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                    ),
                  }}
                />
                {/* Success highlight overlay */}
                {successOpacity > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#34d399',
                      opacity: successOpacity,
                      borderRadius: borderRadius.lg,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            )}

            {/* Existing applied jobs */}
            {appliedJobs.map((job, index) => (
              <JobCard key={job.company} {...job} delay={120 + index * 15} />
            ))}
          </KanbanColumn>

          {/* OFFERS column */}
          <KanbanColumn
            type="offer"
            title="OFFERS"
            count={1}
            delay={35}
            emptyText="Move jobs here when you get an offer"
          >
            {offerJobs.map((job, index) => (
              <JobCard key={job.company} {...job} delay={150 + index * 15} />
            ))}
          </KanbanColumn>

          {/* Dragging card overlay - rendered outside columns to prevent clipping */}
          {isDragging && (
            <div
              style={{
                position: 'absolute',
                top: 45, // Offset for header
                left: spacing[2],
                zIndex: 100,
                transform: `translate(${dragX}px, ${dragY}px) scale(${dragScale})`,
                boxShadow: `0 ${dragShadow}px ${dragShadow * 2}px rgba(0, 0, 0, 0.3)`,
                backgroundColor: colors.background.elevated,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.border.medium}`,
              }}
            >
              <JobCard {...newMatchesJobs[0]} delay={0} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// Export composition config
export const landingHeroConfig = {
  id: 'LandingHero',
  component: LandingHero,
  durationInFrames: 450, // 15 seconds at 30fps
  fps: 30,
  width: 1280,
  height: 720,
}
