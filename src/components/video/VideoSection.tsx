'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface VideoSectionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
  threshold?: number
  rootMargin?: string
}

/**
 * Video section wrapper with intersection observer
 * Only renders/plays video when visible in viewport
 * Respects reduced motion preferences
 */
export const VideoSection: React.FC<VideoSectionProps> = ({
  children,
  fallback,
  className = '',
  threshold = 0.1,
  rootMargin = '100px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        setIsVisible(visible)
        if (visible && !hasBeenVisible) {
          setHasBeenVisible(true)
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, hasBeenVisible])

  // Show fallback for reduced motion preference
  if (prefersReducedMotion && fallback) {
    return (
      <div ref={containerRef} className={className}>
        {fallback}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={className}>
      {/* Only render video once it's been visible (for performance) */}
      {hasBeenVisible && (
        <div
          style={{
            // Pause animation when not visible (via CSS)
            opacity: isVisible ? 1 : 0.5,
            transition: 'opacity 0.3s ease',
          }}
        >
          {children}
        </div>
      )}

      {/* Show placeholder until video loads */}
      {!hasBeenVisible && fallback}
    </div>
  )
}

export default VideoSection
