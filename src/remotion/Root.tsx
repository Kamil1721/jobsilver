import React from 'react'
import { Composition } from 'remotion'
import { LandingHero, landingHeroConfig } from './compositions/LandingHero'
import {
  AIMatchingDemo,
  aiMatchingDemoConfig,
  JobTrackingDemo,
  jobTrackingDemoConfig,
  SmartFiltersDemo,
  smartFiltersDemoConfig,
  ApplicationFlowDemo,
  applicationFlowDemoConfig,
} from './compositions/features'

/**
 * Remotion Root component for development preview
 * Run with: npx remotion preview src/remotion/Root.tsx
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Main hero composition */}
      <Composition
        id={landingHeroConfig.id}
        component={LandingHero}
        durationInFrames={landingHeroConfig.durationInFrames}
        fps={landingHeroConfig.fps}
        width={landingHeroConfig.width}
        height={landingHeroConfig.height}
      />

      {/* Feature section compositions */}
      <Composition
        id={aiMatchingDemoConfig.id}
        component={AIMatchingDemo}
        durationInFrames={aiMatchingDemoConfig.durationInFrames}
        fps={aiMatchingDemoConfig.fps}
        width={aiMatchingDemoConfig.width}
        height={aiMatchingDemoConfig.height}
      />

      <Composition
        id={jobTrackingDemoConfig.id}
        component={JobTrackingDemo}
        durationInFrames={jobTrackingDemoConfig.durationInFrames}
        fps={jobTrackingDemoConfig.fps}
        width={jobTrackingDemoConfig.width}
        height={jobTrackingDemoConfig.height}
      />

      <Composition
        id={smartFiltersDemoConfig.id}
        component={SmartFiltersDemo}
        durationInFrames={smartFiltersDemoConfig.durationInFrames}
        fps={smartFiltersDemoConfig.fps}
        width={smartFiltersDemoConfig.width}
        height={smartFiltersDemoConfig.height}
      />

      <Composition
        id={applicationFlowDemoConfig.id}
        component={ApplicationFlowDemo}
        durationInFrames={applicationFlowDemoConfig.durationInFrames}
        fps={applicationFlowDemoConfig.fps}
        width={applicationFlowDemoConfig.width}
        height={applicationFlowDemoConfig.height}
      />
    </>
  )
}
