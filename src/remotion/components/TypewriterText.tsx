import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { fonts } from '../theme/fonts'
import { colors } from '../theme/colors'

interface TypewriterTextProps {
  /** The text to type out */
  text: string
  /** Frame at which typing starts */
  startFrame: number
  /** Characters typed per frame (default: 1.5) */
  charsPerFrame?: number
  /** Text style */
  style?: React.CSSProperties
  /** Show blinking cursor at the end */
  showCursor?: boolean
  /** Frame at which cursor stops blinking (hides) */
  cursorHideFrame?: number
}

/**
 * Text component that reveals characters one by one with a typewriter effect
 */
export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame,
  charsPerFrame = 1.5,
  style = {},
  showCursor = true,
  cursorHideFrame,
}) => {
  const frame = useCurrentFrame()

  // Calculate how many characters to show
  const framesElapsed = Math.max(0, frame - startFrame)
  const charsToShow = Math.min(
    Math.floor(framesElapsed * charsPerFrame),
    text.length
  )

  const displayedText = text.slice(0, charsToShow)
  const isTyping = charsToShow < text.length && frame >= startFrame

  // Cursor visibility
  const showCursorNow = showCursor && frame >= startFrame
  const hideCursor = cursorHideFrame !== undefined && frame >= cursorHideFrame

  // Blinking cursor animation (blinks every 15 frames)
  const cursorOpacity =
    showCursorNow && !hideCursor
      ? isTyping
        ? 1 // Solid while typing
        : Math.floor((frame - startFrame) / 15) % 2 === 0
        ? 1
        : 0
      : 0

  return (
    <span
      style={{
        fontFamily: fonts.family,
        ...style,
      }}
    >
      {displayedText}
      {showCursorNow && !hideCursor && (
        <span
          style={{
            opacity: cursorOpacity,
            color: colors.text.primary,
            marginLeft: 1,
          }}
        >
          |
        </span>
      )}
    </span>
  )
}

export default TypewriterText
