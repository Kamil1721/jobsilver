'use client'

import React from 'react'
import { Player } from '@remotion/player'
import { useHydrated } from '@/hooks/use-hydrated'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import {
  AIMatchingDemo,
  aiMatchingDemoConfig,
  JobTrackingDemo,
  jobTrackingDemoConfig,
  SmartFiltersDemo,
  smartFiltersDemoConfig,
  ApplicationFlowDemo,
  applicationFlowDemoConfig,
} from '@/remotion/compositions/features'

type FeatureType = 'ai-matching' | 'job-tracking' | 'smart-filters' | 'application-flow'

interface FeatureVideoPlayerProps {
  feature: FeatureType
  className?: string
}

const featureConfigs = {
  'ai-matching': {
    component: AIMatchingDemo,
    config: aiMatchingDemoConfig,
  },
  'job-tracking': {
    component: JobTrackingDemo,
    config: jobTrackingDemoConfig,
  },
  'smart-filters': {
    component: SmartFiltersDemo,
    config: smartFiltersDemoConfig,
  },
  'application-flow': {
    component: ApplicationFlowDemo,
    config: applicationFlowDemoConfig,
  },
}

export const FeatureVideoPlayer: React.FC<FeatureVideoPlayerProps> = ({
  feature,
  className = '',
}) => {
  const isClient = useHydrated()
  const prefersReducedMotion = useReducedMotion()

  const featureData = featureConfigs[feature]

  if (!featureData) {
    console.warn(`Unknown feature: ${feature}`)
    return null
  }

  const { component: Component, config } = featureData

  // Show static fallback for SSR or reduced motion
  if (!isClient || prefersReducedMotion) {
    return (
      <div
        className={`bg-zinc-900/50 rounded-xl border border-white/[0.08] ${className}`}
        style={{
          aspectRatio: `${config.width} / ${config.height}`,
        }}
      />
    )
  }

  return (
    <div className={`relative ${className}`}>
      <Player
        component={Component}
        durationInFrames={config.durationInFrames}
        fps={config.fps}
        compositionWidth={config.width}
        compositionHeight={config.height}
        loop
        autoPlay
        style={{
          width: '100%',
          aspectRatio: `${config.width} / ${config.height}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
        controls={false}
        showVolumeControls={false}
        clickToPlay={false}
      />
    </div>
  )
}

export default FeatureVideoPlayer
