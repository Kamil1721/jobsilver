'use client'

import React, { useEffect, useState } from 'react'
import { Player } from '@remotion/player'
import { LandingHero, landingHeroConfig } from '@/remotion/compositions/LandingHero'

interface HeroVideoPlayerProps {
  className?: string
}

export const HeroVideoPlayer: React.FC<HeroVideoPlayerProps> = ({
  className = '',
}) => {
  const [isClient, setIsClient] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Show static fallback for SSR or reduced motion
  if (!isClient || prefersReducedMotion) {
    return <HeroStaticFallback className={className} />
  }

  return (
    <div className={`relative w-full ${className}`}>
      <Player
        component={LandingHero}
        durationInFrames={landingHeroConfig.durationInFrames}
        fps={landingHeroConfig.fps}
        compositionWidth={landingHeroConfig.width}
        compositionHeight={landingHeroConfig.height}
        loop
        autoPlay
        style={{
          width: '100%',
          aspectRatio: `${landingHeroConfig.width} / ${landingHeroConfig.height}`,
        }}
        controls={false}
        showVolumeControls={false}
        clickToPlay={false}
      />
    </div>
  )
}

// Static fallback matching the actual dashboard design
const HeroStaticFallback: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <div
      className={`relative w-full aspect-video bg-[#0a0a0b] rounded-2xl border border-white/[0.04] overflow-hidden ${className}`}
    >
      {/* Browser header */}
      <div className="flex items-center px-6 py-4 border-b border-white/[0.04]">
        <div className="flex gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.04]">
            <span className="text-[11px] text-zinc-600">
              jobsilver.com/dashboard
            </span>
          </div>
        </div>
      </div>

      {/* Static Kanban preview */}
      <div className="p-6 grid grid-cols-3 gap-4 h-[calc(100%-60px)]">
        {/* NEW MATCHES column */}
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                NEW MATCHES
              </span>
            </div>
            <span className="text-xs text-zinc-600 bg-white/[0.05] px-1.5 py-0.5 rounded">
              4
            </span>
          </div>
          <div className="p-2 space-y-1">
            {[
              { company: 'Bamboo Works', title: 'AI Clone & Avatar Specialist', meta: 'Remote · contractor' },
              { company: 'GitLab', title: 'Senior Frontend Engineer', meta: 'Remote · FT' },
              { company: 'Visma', title: 'Cyber Security Engineer', meta: 'Remote · FT' },
            ].map((job) => (
              <div key={job.company} className="px-3 py-2.5">
                <div className="text-sm font-medium text-white">{job.company}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{job.title}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{job.meta}</div>
              </div>
            ))}
          </div>
        </div>

        {/* APPLIED column */}
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                APPLIED
              </span>
            </div>
            <span className="text-xs text-zinc-600 bg-white/[0.05] px-1.5 py-0.5 rounded">
              1
            </span>
          </div>
          <div className="p-2">
            <div className="px-3 py-2.5">
              <div className="text-sm font-medium text-white">Stripe</div>
              <div className="text-xs text-zinc-400 mt-0.5">Senior Frontend Engineer</div>
              <div className="text-xs text-zinc-500 mt-0.5">San Francisco, CA · FT</div>
            </div>
          </div>
        </div>

        {/* OFFERS column */}
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                OFFERS
              </span>
            </div>
            <span className="text-xs text-zinc-600 bg-white/[0.05] px-1.5 py-0.5 rounded">
              1
            </span>
          </div>
          <div className="p-2">
            <div className="px-3 py-2.5">
              <div className="text-sm font-medium text-white">Linear</div>
              <div className="text-xs text-zinc-400 mt-0.5">Product Engineer</div>
              <div className="text-xs text-zinc-500 mt-0.5">Remote · FT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HeroVideoPlayer
