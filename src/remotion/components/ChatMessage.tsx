import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'
import { borderRadius, spacing } from '../theme/styles'
import { TypewriterText } from './TypewriterText'

interface ChatMessageProps {
  /** Message content */
  text: string
  /** Whether this is from the user or AI */
  isUser: boolean
  /** Frame at which message appears */
  startFrame: number
  /** Whether to use typewriter effect (for AI messages) */
  typewriter?: boolean
  /** Characters per frame for typewriter effect */
  charsPerFrame?: number
}

// Purple gradient for AI elements (matching actual app)
const aiPurple = '#a78bfa'
const aiPurpleDark = '#7c3aed'

/**
 * Chat message bubble with entrance animation
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  text,
  isUser,
  startFrame,
  typewriter = false,
  charsPerFrame = 2,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entrance animation
  const entrance = spring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  })

  // Only show if past start frame
  if (frame < startFrame) {
    return null
  }

  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const translateY = interpolate(entrance, [0, 1], [10, 0])
  const scale = interpolate(entrance, [0, 1], [0.95, 1])

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        marginBottom: spacing[2],
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      {/* Avatar - always on left like in the app */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: borderRadius.sm,
          background: isUser
            ? colors.metallic.dark
            : `linear-gradient(135deg, ${aiPurple} 0%, ${aiPurpleDark} 100%)`,
          marginRight: spacing[2],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUser ? (
          // User icon
          <svg width={14} height={14} viewBox="0 0 24 24" fill={colors.text.muted}>
            <circle cx={12} cy={8} r={4} />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        ) : (
          // AI icon
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Message bubble */}
      <div
        style={{
          maxWidth: '85%',
          padding: `${spacing[2]}px ${spacing[3]}px`,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.background.card,
          border: `1px solid ${colors.border.subtle}`,
        }}
      >
        {typewriter ? (
          <TypewriterText
            text={text}
            startFrame={startFrame + 5}
            charsPerFrame={charsPerFrame}
            showCursor={true}
            style={{
              fontSize: fonts.sizes.sm,
              color: colors.text.primary,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          />
        ) : (
          <span
            style={{
              fontSize: fonts.sizes.sm,
              color: colors.text.primary,
              lineHeight: 1.5,
              fontFamily: fonts.family,
            }}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  )
}

export default ChatMessage
