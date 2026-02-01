import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius, spacing } from '../theme/styles'
import { ChatMessage } from './ChatMessage'

interface Message {
  text: string
  isUser: boolean
  startFrame: number
  typewriter?: boolean
}

interface AIChatPanelProps {
  /** Frame at which the panel slides in */
  enterFrame: number
  /** Messages to display */
  messages: Message[]
  /** Panel width */
  width: number
  /** Panel height */
  height: number
  /** Text being typed in input (for animation) */
  inputTypingText?: string
  /** Frame when input typing starts */
  inputTypingStartFrame?: number
  /** Characters per frame for input typing */
  inputCharsPerFrame?: number
  /** Frame when input is "sent" (clears) */
  inputSentFrame?: number
  /** Whether to highlight the Apply button */
  applyButtonHighlight?: boolean
}

// Purple gradient for AI elements
const aiPurple = '#a78bfa'
const aiPurpleDark = '#7c3aed'

/**
 * AI Chat panel matching the actual app layout
 */
export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  enterFrame,
  messages,
  width,
  height,
  inputTypingText = '',
  inputTypingStartFrame = 0,
  inputCharsPerFrame = 1,
  inputSentFrame,
  applyButtonHighlight = false,
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

  // Calculate what's shown in input field
  let inputDisplayText = ''
  const inputSent = inputSentFrame !== undefined && frame >= inputSentFrame

  if (!inputSent && inputTypingText && frame >= inputTypingStartFrame) {
    const framesElapsed = frame - inputTypingStartFrame
    const charsToShow = Math.min(
      Math.floor(framesElapsed * inputCharsPerFrame),
      inputTypingText.length
    )
    inputDisplayText = inputTypingText.slice(0, charsToShow)
  }

  // Blinking cursor for input
  const isTyping = inputDisplayText.length < inputTypingText.length
  const showInputCursor = !inputSent && frame >= inputTypingStartFrame
  const cursorBlink = isTyping || Math.floor(frame / 15) % 2 === 0

  // Button pulse animation
  const pulsePhase = (frame / 20) * Math.PI * 2
  const buttonGlow = applyButtonHighlight ? 0.4 + Math.sin(pulsePhase) * 0.15 : 0

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
      {/* Header - matches actual app */}
      <div
        style={{
          padding: `${spacing[1]}px ${spacing[3]}px`,
          borderBottom: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[1],
          }}
        >
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
              stroke={colors.text.muted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: fonts.sizes.xs,
              fontWeight: fonts.weights.semibold,
              color: colors.text.primary,
              fontFamily: fonts.family,
            }}
          >
            AI Application Assistant
          </span>
        </div>

        {/* Apply Now button - outlined style */}
        <div style={{ position: 'relative' }}>
          {buttonGlow > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: -8,
                background: `radial-gradient(ellipse at center, ${aiPurple} 0%, transparent 70%)`,
                opacity: buttonGlow,
                borderRadius: borderRadius.lg,
              }}
            />
          )}
          <button
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              fontSize: 9,
              fontWeight: fonts.weights.medium,
              color: colors.text.primary,
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border.medium}`,
              borderRadius: borderRadius.sm,
              fontFamily: fonts.family,
            }}
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
              <path
                d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                stroke={colors.text.primary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Apply Now
          </button>
        </div>
      </div>

      {/* Sub-header with AI assistant info */}
      <div
        style={{
          padding: `${spacing[2]}px ${spacing[3]}px`,
          borderBottom: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        {/* Purple gradient AI icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.md,
            background: `linear-gradient(135deg, ${aiPurple} 0%, ${aiPurpleDark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: fonts.sizes.sm,
              fontWeight: fonts.weights.semibold,
              color: colors.text.primary,
              fontFamily: fonts.family,
            }}
          >
            AI Application Assistant
          </div>
          <div
            style={{
              fontSize: 9,
              color: colors.text.muted,
              fontFamily: fonts.family,
            }}
          >
            Helping with Senior Frontend Developer at TechCorp
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          padding: spacing[3],
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.map((msg, index) => (
          <ChatMessage
            key={index}
            text={msg.text}
            isUser={msg.isUser}
            startFrame={msg.startFrame}
            typewriter={msg.typewriter}
            charsPerFrame={1.2}
          />
        ))}
      </div>

      {/* Quick actions */}
      <div
        style={{
          padding: `0 ${spacing[3]}px ${spacing[2]}px`,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: colors.text.muted,
            fontFamily: fonts.family,
            marginBottom: spacing[1],
          }}
        >
          Quick actions:
        </div>
        <div
          style={{
            display: 'flex',
            gap: spacing[1],
            flexWrap: 'wrap',
          }}
        >
          {['Write cover letter', 'Why I\'m a good fit', 'Salary negotiation tips'].map((action) => (
            <div
              key={action}
              style={{
                padding: '4px 8px',
                fontSize: 9,
                color: colors.text.secondary,
                fontFamily: fonts.family,
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border.medium}`,
                borderRadius: borderRadius.full,
              }}
            >
              {action}
            </div>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div
        style={{
          padding: spacing[2],
          borderTop: `1px solid ${colors.border.subtle}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            padding: `${spacing[2]}px ${spacing[3]}px`,
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.md,
            border: `1px solid ${
              inputDisplayText ? colors.border.medium : colors.border.faint
            }`,
            minHeight: 36,
          }}
        >
          {/* Image upload icon */}
          <div
            style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <rect x={3} y={3} width={18} height={18} rx={2} stroke={colors.text.muted} strokeWidth={2} />
              <circle cx={8.5} cy={8.5} r={1.5} fill={colors.text.muted} />
              <path d="M21 15l-5-5L5 21" stroke={colors.text.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {inputDisplayText ? (
            <span
              style={{
                fontSize: fonts.sizes.xs,
                color: colors.text.primary,
                fontFamily: fonts.family,
                flex: 1,
              }}
            >
              {inputDisplayText}
              {showInputCursor && cursorBlink && (
                <span style={{ color: aiPurple }}>|</span>
              )}
            </span>
          ) : (
            <span
              style={{
                fontSize: fonts.sizes.xs,
                color: colors.text.faint,
                fontFamily: fonts.family,
                flex: 1,
              }}
            >
              Paste application questions or ask for help...
            </span>
          )}

          {/* Send button - purple when active */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: borderRadius.sm,
              background: inputDisplayText
                ? `linear-gradient(135deg, ${aiPurple} 0%, ${aiPurpleDark} 100%)`
                : colors.metallic.dark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24">
              <path
                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                stroke={inputDisplayText ? 'white' : colors.text.muted}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Tip text */}
        <div
          style={{
            marginTop: 4,
            fontSize: 8,
            color: colors.text.faint,
            fontFamily: fonts.family,
          }}
        >
          <span style={{ color: aiPurple }}>Tip:</span> Upload a screenshot or paste application questions for personalized answers
        </div>
      </div>
    </div>
  )
}

export default AIChatPanel
