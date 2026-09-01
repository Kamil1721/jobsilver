import React from 'react'
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion'
import { colors } from '../theme/colors'

interface AnimatedCursorProps {
  /** Array of positions the cursor moves through, with timing */
  keyframes: Array<{
    frame: number
    x: number
    y: number
    click?: boolean
  }>
  /** Optional scale multiplier */
  scale?: number
}

/**
 * Animated mouse cursor with smooth movement and click animations
 */
export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({
  keyframes,
  scale = 1,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Find current position based on keyframes
  let currentX = keyframes[0]?.x ?? 0
  let currentY = keyframes[0]?.y ?? 0
  let isClicking = false

  for (let i = 0; i < keyframes.length; i++) {
    const current = keyframes[i]
    const next = keyframes[i + 1]

    if (next && frame >= current.frame && frame < next.frame) {
      // Interpolate between current and next keyframe
      // Apply smooth easing
      const easedProgress = spring({
        frame: frame - current.frame,
        fps,
        config: {
          damping: 20,
          stiffness: 100,
        },
        durationInFrames: next.frame - current.frame,
      })

      currentX = interpolate(easedProgress, [0, 1], [current.x, next.x])
      currentY = interpolate(easedProgress, [0, 1], [current.y, next.y])
      break
    } else if (frame >= current.frame && !next) {
      // After last keyframe
      currentX = current.x
      currentY = current.y
    }
  }

  // Check if we're in a clicking state
  const clickKeyframe = keyframes.find(
    (kf) => kf.click && frame >= kf.frame && frame < kf.frame + 10
  )
  isClicking = !!clickKeyframe

  // Click animation
  const clickScale = isClicking
    ? interpolate(
        frame - (clickKeyframe?.frame ?? 0),
        [0, 3, 6, 10],
        [1, 0.8, 1.1, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 1

  // Click ripple effect
  const rippleOpacity = isClicking
    ? interpolate(
        frame - (clickKeyframe?.frame ?? 0),
        [0, 10],
        [0.6, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0

  const rippleScale = isClicking
    ? interpolate(
        frame - (clickKeyframe?.frame ?? 0),
        [0, 10],
        [0, 2],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0

  const cursorSize = 24 * scale

  return (
    <div
      style={{
        position: 'absolute',
        left: currentX,
        top: currentY,
        transform: `scale(${clickScale})`,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      {/* Click ripple effect */}
      {rippleOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: -15,
            top: -15,
            width: 30,
            height: 30,
            borderRadius: '50%',
            backgroundColor: colors.status.interview,
            opacity: rippleOpacity,
            transform: `scale(${rippleScale})`,
          }}
        />
      )}

      {/* Cursor SVG */}
      <svg
        width={cursorSize}
        height={cursorSize}
        viewBox="0 0 24 24"
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }}
      >
        {/* Cursor shape - pointer arrow */}
        <path
          d="M5 3l14 11-6.5 1.5L10 22l-5-19z"
          fill="white"
          stroke={colors.metallic.dark}
          strokeWidth={1}
        />
        {/* Inner highlight */}
        <path
          d="M7 6l9 7-4.5 1L10 18l-3-12z"
          fill="rgba(255,255,255,0.3)"
        />
      </svg>
    </div>
  )
}

export default AnimatedCursor
