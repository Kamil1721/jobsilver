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

/**
 * AI Matching Demo - 5 second loop
 * Shows neural network visualization with connecting lines and match scores appearing
 */

const nodes = [
  { x: 50, y: 100, label: 'Skills' },
  { x: 50, y: 200, label: 'Experience' },
  { x: 50, y: 300, label: 'Location' },
  { x: 250, y: 150, label: 'AI', isCenter: true },
  { x: 250, y: 250, label: 'Engine', isCenter: true },
  { x: 450, y: 100, label: '94%', isScore: true },
  { x: 450, y: 200, label: '87%', isScore: true },
  { x: 450, y: 300, label: '76%', isScore: true },
]

const connections = [
  { from: 0, to: 3 },
  { from: 1, to: 3 },
  { from: 2, to: 4 },
  { from: 0, to: 4 },
  { from: 3, to: 5 },
  { from: 3, to: 6 },
  { from: 4, to: 6 },
  { from: 4, to: 7 },
]

export const AIMatchingDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Pulse animation for the center nodes
  const pulsePhase = (frame / 30) * Math.PI * 2
  const centerPulse = 1 + Math.sin(pulsePhase) * 0.05

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
        opacity: loopOpacity,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 500 400">
        {/* Connection lines */}
        {connections.map((conn, i) => {
          const fromNode = nodes[conn.from]
          const toNode = nodes[conn.to]

          // Animate line drawing
          const lineProgress = spring({
            frame: frame - i * 3,
            fps,
            config: { damping: 20, stiffness: 50 },
          })

          // Data flow pulse along the line
          const pulseOffset = ((frame * 3 + i * 15) % 100) / 100
          const gradientId = `pulse-${i}`

          return (
            <g key={i}>
              <defs>
                <linearGradient
                  id={gradientId}
                  gradientUnits="userSpaceOnUse"
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                >
                  <stop
                    offset={Math.max(0, pulseOffset - 0.1)}
                    stopColor={colors.border.subtle}
                  />
                  <stop offset={pulseOffset} stopColor={colors.status.interview} />
                  <stop
                    offset={Math.min(1, pulseOffset + 0.1)}
                    stopColor={colors.border.subtle}
                  />
                </linearGradient>
              </defs>
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={fromNode.x + (toNode.x - fromNode.x) * lineProgress}
                y2={fromNode.y + (toNode.y - fromNode.y) * lineProgress}
                stroke={`url(#${gradientId})`}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.6}
              />
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const nodeDelay = i * 5 + 10
          const nodeScale = spring({
            frame: frame - nodeDelay,
            fps,
            config: { damping: 12, stiffness: 100 },
          })

          const isCenter = node.isCenter
          const isScore = node.isScore
          const size = isCenter ? 45 : isScore ? 40 : 35

          // Score count-up animation
          let displayLabel = node.label
          if (isScore) {
            const scoreValue = parseInt(node.label)
            const countUp = interpolate(
              frame - nodeDelay,
              [0, 30],
              [0, scoreValue],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )
            displayLabel = `${Math.round(countUp)}%`
          }

          // Score color
          const getScoreColor = () => {
            if (!isScore) return colors.text.secondary
            const score = parseInt(node.label)
            if (score >= 80) return colors.matchScore.high.text
            if (score >= 60) return colors.matchScore.medium.text
            return colors.matchScore.low.text
          }

          return (
            <g
              key={i}
              transform={`translate(${node.x}, ${node.y}) scale(${
                isCenter ? nodeScale * centerPulse : nodeScale
              })`}
            >
              {/* Glow for center nodes */}
              {isCenter && (
                <circle
                  r={size + 10}
                  fill={colors.status.interview}
                  opacity={0.15 * centerPulse}
                />
              )}

              {/* Node circle */}
              <circle
                r={size}
                fill={isCenter ? colors.background.elevated : colors.background.card}
                stroke={isCenter ? colors.status.interview : colors.border.medium}
                strokeWidth={isCenter ? 2 : 1}
              />

              {/* Label */}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isScore ? getScoreColor() : colors.text.secondary}
                fontSize={isScore ? 14 : isCenter ? 12 : 10}
                fontWeight={isScore ? 600 : 500}
                fontFamily={fonts.family}
              >
                {displayLabel}
              </text>
            </g>
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}

export const aiMatchingDemoConfig = {
  id: 'AIMatchingDemo',
  component: AIMatchingDemo,
  durationInFrames: 150, // 5 seconds at 30fps
  fps: 30,
  width: 500,
  height: 400,
}
