import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/fonts'
import { spacing } from '../../theme/styles'
import { AnimatedCursor } from '../../components/AnimatedCursor'
import { JobDetailPanel } from '../../components/JobDetailPanel'
import { AIChatPanel } from '../../components/AIChatPanel'

/**
 * Application Flow Demo - 12 second loop (360 frames @ 30fps)
 * Shows the job application workflow with AI assistance
 *
 * Timeline:
 * 0-30:     Fade in with split-screen layout
 * 40-120:   User types message in input field
 * 125:      Message sent
 * 130:      User message appears in chat
 * 150-280:  AI response streams in (shorter, scannable)
 * 290-340:  Cursor moves to Apply button and clicks
 * 340-360:  Fade out for seamless loop
 */

const userMessage = 'Summarize this job for me'

// Shorter, scannable AI response with bullet points
const aiResponse = `Senior Frontend Dev @ TechCorp (Remote)

• Salary: $150k-$200k + equity
• Need: 5+ yrs React, TypeScript, Next.js
• Role: Lead features, mentor devs, code reviews

Your React & TS experience is a strong match!`

// Chat messages - appear after user finishes typing in input
const chatMessages = [
  {
    text: userMessage,
    isUser: true,
    startFrame: 130,
    typewriter: false,
  },
  {
    text: aiResponse,
    isUser: false,
    startFrame: 150,
    typewriter: true,
  },
]

// Cursor keyframes - only appears for apply button interaction
// Right panel starts at x=504 (12 padding + 480 left panel + 12 gap)
// Apply button is in header, right-aligned: x ≈ 504 + 480 - 12 - 40 = 932
const cursorKeyframes = [
  // Hidden until needed
  { frame: 0, x: -50, y: -50 },
  { frame: 285, x: -50, y: -50 },
  // Move toward apply button (in the AI chat header, right side)
  { frame: 300, x: 850, y: 40 },
  // Hover on button center
  { frame: 320, x: 920, y: 28 },
  // Click
  { frame: 335, x: 920, y: 28, click: true },
]

export const ApplicationFlowDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // Loop fade in/out
  const loopOpacity = interpolate(
    frame,
    [0, 20, durationInFrames - 20, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Apply button highlight (when cursor approaches and clicks)
  const applyButtonHighlight = frame >= 295 && frame < 350

  // Input typing timing
  const inputTypingStartFrame = 40
  const inputSentFrame = 125

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background.base,
        fontFamily: fonts.family,
        opacity: loopOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Split-screen layout */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          gap: spacing[3],
          padding: spacing[3],
        }}
      >
        {/* Left panel - Job details */}
        <div style={{ flex: 1 }}>
          <JobDetailPanel
            enterFrame={0}
            width={480}
            height={574}
          />
        </div>

        {/* Right panel - AI Chat */}
        <div style={{ flex: 1 }}>
          <AIChatPanel
            enterFrame={5}
            messages={chatMessages}
            width={480}
            height={574}
            inputTypingText={userMessage}
            inputTypingStartFrame={inputTypingStartFrame}
            inputCharsPerFrame={0.4}
            inputSentFrame={inputSentFrame}
            applyButtonHighlight={applyButtonHighlight}
          />
        </div>
      </div>

      {/* Animated cursor for apply button */}
      <AnimatedCursor keyframes={cursorKeyframes} scale={1} />
    </AbsoluteFill>
  )
}

export const applicationFlowDemoConfig = {
  id: 'ApplicationFlowDemo',
  component: ApplicationFlowDemo,
  durationInFrames: 360, // 12 seconds at 30fps
  fps: 30,
  width: 1000,
  height: 600,
}
