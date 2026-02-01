'use client'

import React, { Suspense, lazy } from 'react'

// Lazy load the video players
const HeroVideoPlayer = lazy(() => import('./HeroVideoPlayer'))
const FeatureVideoPlayer = lazy(() => import('./FeatureVideoPlayer'))

interface LazyHeroVideoPlayerProps {
  className?: string
  fallback?: React.ReactNode
}

interface LazyFeatureVideoPlayerProps {
  feature: 'ai-matching' | 'job-tracking' | 'smart-filters'
  className?: string
  fallback?: React.ReactNode
}

/**
 * Lazy-loading wrapper for hero video player
 */
export const LazyHeroVideoPlayer: React.FC<LazyHeroVideoPlayerProps> = ({
  className = '',
  fallback,
}) => {
  const defaultFallback = (
    <div
      className={`bg-zinc-900/50 animate-pulse rounded-2xl aspect-video ${className}`}
    />
  )

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <HeroVideoPlayer className={className} />
    </Suspense>
  )
}

/**
 * Lazy-loading wrapper for feature video player
 */
export const LazyFeatureVideoPlayer: React.FC<LazyFeatureVideoPlayerProps> = ({
  feature,
  className = '',
  fallback,
}) => {
  const defaultFallback = (
    <div
      className={`bg-zinc-900/50 animate-pulse rounded-xl aspect-video ${className}`}
    />
  )

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <FeatureVideoPlayer feature={feature} className={className} />
    </Suspense>
  )
}

export default LazyHeroVideoPlayer
