import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius, spacing } from '../theme/styles'

interface JobDetailPanelProps {
  /** Frame at which the panel appears */
  enterFrame: number
  /** Panel width */
  width: number
  /** Panel height */
  height: number
}

// Verbose job description that benefits from AI summarization
const jobDescriptionLines = [
  { type: 'heading', text: 'About TechCorp' },
  { type: 'paragraph', text: "TechCorp is a Series C funded technology company revolutionizing the enterprise software space. With over 500 employees across 12 global offices, we're committed to building best-in-class solutions that empower businesses to achieve operational excellence." },
  { type: 'heading', text: 'The Opportunity' },
  { type: 'paragraph', text: "We are seeking a highly motivated and experienced Senior Frontend Developer to join our dynamic Product Engineering team. In this role, you will be instrumental in driving the development of our next-generation platform, collaborating cross-functionally with stakeholders across the organization to deliver exceptional user experiences." },
  { type: 'heading', text: 'What You Will Do' },
  { type: 'bullet', text: 'Spearhead the architectural design and implementation of scalable, performant frontend solutions utilizing React.js ecosystem and TypeScript' },
  { type: 'bullet', text: 'Partner with Product Management and UX Design teams to translate business requirements into technical specifications' },
  { type: 'bullet', text: 'Drive engineering excellence through comprehensive code reviews, mentorship of junior team members, and establishment of best practices' },
  { type: 'bullet', text: 'Optimize application performance metrics including Core Web Vitals, accessibility compliance, and cross-browser compatibility' },
  { type: 'heading', text: 'Qualifications' },
  { type: 'bullet', text: "Bachelor's degree in Computer Science or equivalent practical experience with 5+ years in frontend development" },
  { type: 'bullet', text: 'Deep expertise in React, TypeScript, Next.js, and modern state management solutions (Redux, Zustand, or similar)' },
  { type: 'bullet', text: 'Demonstrated experience with RESTful APIs, GraphQL, and testing frameworks (Jest, React Testing Library, Cypress)' },
  { type: 'heading', text: 'Compensation & Benefits' },
  { type: 'bullet', text: 'Base salary range: $150,000 - $200,000 annually, commensurate with experience, plus equity participation' },
  { type: 'bullet', text: 'Comprehensive benefits package including unlimited PTO, 401(k) matching, and premium health/dental/vision coverage' },
  { type: 'bullet', text: 'Remote-first culture with optional access to state-of-the-art office facilities in major metropolitan areas' },
]

/**
 * Job detail panel matching the actual app layout
 */
export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
  enterFrame,
  width,
  height,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Fade-in animation
  const fadeProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: {
      damping: 20,
      stiffness: 80,
    },
  })

  const opacity = interpolate(fadeProgress, [0, 1], [0, 1])

  if (frame < enterFrame) {
    return null
  }

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.border.subtle}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity,
      }}
    >
      {/* Sticky header - matches actual app */}
      <div
        style={{
          padding: `${spacing[1]}px ${spacing[3]}px`,
          borderBottom: `1px solid ${colors.border.subtle}`,
          backgroundColor: colors.background.elevated,
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        {/* Back button */}
        <div
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: borderRadius.sm,
            backgroundColor: 'transparent',
          }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke={colors.text.muted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Job title and meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: fonts.sizes.sm,
              fontWeight: fonts.weights.semibold,
              color: colors.text.primary,
              fontFamily: fonts.family,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Senior Frontend Developer
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              color: colors.text.muted,
              fontFamily: fonts.family,
            }}
          >
            <span>TechCorp</span>
            <span>•</span>
            <svg width={8} height={8} viewBox="0 0 24 24" fill="none">
              <path
                d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"
                stroke={colors.text.muted}
                strokeWidth={2}
              />
              <circle cx={12} cy={10} r={3} stroke={colors.text.muted} strokeWidth={2} />
            </svg>
            <span>San Francisco (Remote)</span>
            {/* Job type badge */}
            <span
              style={{
                marginLeft: 4,
                padding: '1px 4px',
                fontSize: 8,
                borderRadius: 3,
                border: `1px solid ${colors.border.medium}`,
                color: colors.text.muted,
              }}
            >
              Full-time
            </span>
          </div>
        </div>
      </div>

      {/* Content area - Job Description */}
      <div
        style={{
          flex: 1,
          padding: spacing[3],
          overflow: 'hidden',
        }}
      >
        {/* Section header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[2],
          }}
        >
          <span
            style={{
              fontSize: fonts.sizes.xs,
              fontWeight: fonts.weights.semibold,
              color: colors.text.primary,
              fontFamily: fonts.family,
            }}
          >
            Job Description
          </span>
          <span
            style={{
              fontSize: 8,
              color: colors.text.faint,
              fontFamily: fonts.family,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <svg width={8} height={8} viewBox="0 0 24 24" fill="none">
              <rect x={3} y={4} width={18} height={18} rx={2} stroke={colors.text.faint} strokeWidth={2} />
              <line x1={16} y1={2} x2={16} y2={6} stroke={colors.text.faint} strokeWidth={2} />
              <line x1={8} y1={2} x2={8} y2={6} stroke={colors.text.faint} strokeWidth={2} />
              <line x1={3} y1={10} x2={21} y2={10} stroke={colors.text.faint} strokeWidth={2} />
            </svg>
            Jan 28, 2026
          </span>
        </div>

        {/* Job description content */}
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.5,
            color: colors.text.secondary,
            fontFamily: fonts.family,
          }}
        >
          {jobDescriptionLines.map((line, index) => {
            if (line.type === 'heading') {
              return (
                <div
                  key={index}
                  style={{
                    fontSize: 11,
                    fontWeight: fonts.weights.semibold,
                    color: colors.text.primary,
                    marginTop: index === 0 ? 0 : spacing[2],
                    marginBottom: spacing[1],
                  }}
                >
                  {line.text}
                </div>
              )
            }
            if (line.type === 'bullet') {
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ color: colors.text.muted }}>•</span>
                  <span>{line.text}</span>
                </div>
              )
            }
            return (
              <div key={index} style={{ marginBottom: spacing[1] }}>
                {line.text}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default JobDetailPanel
