"use client"

import { Player } from "@remotion/player"
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { useHydrated } from "@/hooks/use-hydrated"

const COMPOSITION_SIZE = 1000
const BREATH_CYCLE_SECONDS = 4
const BREATH_PIVOT = { x: 590, y: 620 } as const

const ARRIVALS = [
  { label: "Product Designer", x: 583, y: 326, start: 80 },
  { label: "Frontend Engineer", x: 614, y: 154, start: 110 },
  { label: "Growth Marketer", x: 772, y: 236, start: 140 },
] as const

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const

const arrivalEase = Easing.bezier(0.16, 1, 0.3, 1)
const travelEase = Easing.bezier(0.32, 0.72, 0, 1)

function DawnHeroBreathingLayer({
  frame,
  fps,
}: {
  frame: number
  fps: number
}) {
  const cycleInFrames = BREATH_CYCLE_SECONDS * fps
  const phase = ((frame % cycleInFrames) / cycleInFrames) * Math.PI * 2
  const breath = (1 - Math.cos(phase)) / 2
  const lift = interpolate(breath, [0, 1], [0, -5.5], clamp)
  const scaleX = interpolate(breath, [0, 1], [1, 1.004], {
    ...clamp,
    output: "perceptual-scale",
  })
  const scaleY = interpolate(breath, [0, 1], [1, 1.012], {
    ...clamp,
    output: "perceptual-scale",
  })

  return (
    <svg
      aria-hidden="true"
      className="dawn-hero-overlay-svg"
      data-dawn-hero-breath="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${COMPOSITION_SIZE} ${COMPOSITION_SIZE}`}
    >
      <defs>
        <filter
          id="dawn-hero-breath-feather"
          colorInterpolationFilters="sRGB"
          height="150%"
          width="150%"
          x="-25%"
          y="-25%"
        >
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <mask
          id="dawn-hero-breath-mask"
          height={COMPOSITION_SIZE}
          maskContentUnits="userSpaceOnUse"
          maskUnits="userSpaceOnUse"
          width={COMPOSITION_SIZE}
          x="0"
          y="0"
        >
          <path
            d="M374 624C407 548 482 490 577 470C649 455 717 484 750 535C773 572 760 617 724 655C634 684 511 683 418 648Z"
            fill="white"
            filter="url(#dawn-hero-breath-feather)"
          />
        </mask>
      </defs>

      <image
        height={COMPOSITION_SIZE}
        href={staticFile("illustrations/hero-dawn.png")}
        mask="url(#dawn-hero-breath-mask)"
        preserveAspectRatio="xMidYMid meet"
        transform={`translate(0 ${lift}) translate(${BREATH_PIVOT.x} ${BREATH_PIVOT.y}) scale(${scaleX} ${scaleY}) translate(${-BREATH_PIVOT.x} ${-BREATH_PIVOT.y})`}
        width={COMPOSITION_SIZE}
        x="0"
        y="0"
      />
    </svg>
  )
}

function getArrivalMotion(frame: number, start: number) {
  if (frame <= 43) {
    return {
      opacity: interpolate(frame, [19, 43], [1, 0], {
        ...clamp,
        easing: arrivalEase,
      }),
      translateY: 0,
      scale: 1,
      pulseOpacity: 0,
      pulseScale: 1.7,
    }
  }

  if (frame < start) {
    return {
      opacity: 0,
      translateY: 5,
      scale: 0.68,
      pulseOpacity: 0,
      pulseScale: 0.8,
    }
  }

  return {
    opacity: interpolate(frame, [start, start + 8], [0, 1], {
      ...clamp,
      easing: arrivalEase,
    }),
    translateY: interpolate(frame, [start, start + 12], [5, 0], {
      ...clamp,
      easing: arrivalEase,
    }),
    scale: interpolate(
      frame,
      [start, start + 10, start + 17],
      [0.68, 1.08, 1],
      {
        ...clamp,
        easing: [arrivalEase, arrivalEase],
        output: "perceptual-scale",
      }
    ),
    pulseOpacity: interpolate(frame, [start, start + 18], [0.34, 0], clamp),
    pulseScale: interpolate(frame, [start, start + 18], [0.8, 1.7], {
      ...clamp,
      easing: arrivalEase,
      output: "perceptual-scale",
    }),
  }
}

function getFinderPosition(frame: number) {
  if (frame <= 19) {
    return { x: 772, y: 236 }
  }

  if (frame <= 79) {
    return {
      x: interpolate(frame, [56, 79], [495, 583], {
        ...clamp,
        easing: travelEase,
      }),
      y: interpolate(frame, [56, 79], [435, 326], {
        ...clamp,
        easing: travelEase,
      }),
    }
  }

  if (frame < 92) return { x: 583, y: 326 }

  if (frame <= 109) {
    return {
      x: interpolate(frame, [92, 109], [583, 614], {
        ...clamp,
        easing: travelEase,
      }),
      y: interpolate(frame, [92, 109], [326, 154], {
        ...clamp,
        easing: travelEase,
      }),
    }
  }

  if (frame < 122) return { x: 614, y: 154 }

  if (frame <= 139) {
    return {
      x: interpolate(frame, [122, 139], [614, 772], {
        ...clamp,
        easing: travelEase,
      }),
      y: interpolate(frame, [122, 139], [154, 236], {
        ...clamp,
        easing: travelEase,
      }),
    }
  }

  return { x: 772, y: 236 }
}

function DawnHeroOverlayVisual({ frame }: { frame: number }) {
  const finder = getFinderPosition(frame)
  const finderOpacity =
    frame < 56
      ? 0
      : frame <= 64
        ? interpolate(frame, [56, 64], [0, 0.72], {
            ...clamp,
            easing: travelEase,
          })
        : frame <= 151
          ? 0.72
          : interpolate(frame, [152, 169], [0.72, 0], {
              ...clamp,
              easing: arrivalEase,
            })
  const finderScale =
    frame <= 19
      ? 1
      : interpolate(frame, [56, 70], [0.82, 1], {
          ...clamp,
          easing: travelEase,
          output: "perceptual-scale",
        })

  const badgeIsSeam = frame <= 43
  const badgeOpacity = badgeIsSeam
    ? interpolate(frame, [19, 43], [1, 0], {
        ...clamp,
        easing: arrivalEase,
      })
    : interpolate(frame, [170, 188], [0, 1], {
        ...clamp,
        easing: arrivalEase,
      })
  const badgeTranslateY = badgeIsSeam
    ? 0
    : interpolate(frame, [170, 188], [-10, 0], {
        ...clamp,
        easing: arrivalEase,
      })
  const badgeScale = badgeIsSeam
    ? 1
    : interpolate(frame, [170, 188], [0.97, 1], {
        ...clamp,
        easing: arrivalEase,
        output: "perceptual-scale",
      })
  const dotScale = interpolate(frame, [176, 180, 184], [1, 1.55, 1], {
    ...clamp,
    easing: [arrivalEase, arrivalEase],
    output: "perceptual-scale",
  })

  return (
    <svg
      aria-hidden="true"
      className="dawn-hero-overlay-svg"
      data-dawn-hero-frame={frame}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${COMPOSITION_SIZE} ${COMPOSITION_SIZE}`}
    >
      <g
        data-dawn-hero-finder="true"
        opacity={finderOpacity}
        transform={`translate(${finder.x} ${finder.y}) scale(${finderScale})`}
      >
        <g className="dawn-hero-finder-chrome">
          <circle className="dawn-hero-finder-outer" cx="0" cy="0" r="31" />
          <circle className="dawn-hero-finder-ring" cx="0" cy="0" r="23" />
        </g>
      </g>

      {ARRIVALS.map((arrival) => {
        const motion = getArrivalMotion(frame, arrival.start)

        return (
          <g
            key={arrival.label}
            data-dawn-hero-arrival={arrival.label}
            transform={`translate(${arrival.x} ${arrival.y})`}
          >
            <g
              data-dawn-hero-check={arrival.label}
              opacity={motion.opacity}
              transform={`translate(0 ${motion.translateY}) scale(${motion.scale})`}
            >
              <foreignObject
                className="dawn-hero-check-viewport"
                height="34"
                overflow="visible"
                width="34"
                x="-17"
                y="-17"
              >
                <div className="dawn-hero-check">
                  <span
                    className="dawn-hero-check-pulse"
                    style={{
                      opacity: motion.pulseOpacity,
                      transform: `scale(${motion.pulseScale})`,
                    }}
                  />
                  <svg
                    aria-hidden="true"
                    className="dawn-hero-check-icon"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M20 6 9 17l-5-5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.4"
                    />
                  </svg>
                </div>
              </foreignObject>
            </g>
          </g>
        )
      })}

      <foreignObject
        className="dawn-hero-ready-viewport"
        height={COMPOSITION_SIZE}
        overflow="visible"
        width={COMPOSITION_SIZE}
        x="0"
        y="0"
      >
        <div className="dawn-hero-ready-align">
          <div
            className="dawn-hero-ready-badge"
            data-dawn-hero-status="ready"
            style={{
              opacity: badgeOpacity,
              transform: `translateY(${badgeTranslateY}px) scale(${badgeScale})`,
            }}
          >
            <span
              className="dawn-hero-ready-dot"
              style={{ transform: `scale(${dotScale})` }}
            />
            <span>Shortlist ready</span>
            <span className="dawn-hero-ready-time">&middot; 07:30</span>
          </div>
        </div>
      </foreignObject>
    </svg>
  )
}

function DawnHeroComposition() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <AbsoluteFill
      data-dawn-hero-composition="true"
      style={{ backgroundColor: "transparent" }}
    >
      <DawnHeroBreathingLayer fps={fps} frame={frame} />
      <DawnHeroOverlayVisual frame={frame} />
    </AbsoluteFill>
  )
}

function DawnHeroStaticOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      data-dawn-hero-overlay="static"
    >
      <DawnHeroOverlayVisual frame={0} />
    </div>
  )
}

export function DawnHeroMotionOverlay() {
  const prefersReducedMotion = useReducedMotion()
  const isHydrated = useHydrated()

  const mediaQueryRequestsReducedMotion =
    isHydrated &&
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  if (
    !isHydrated ||
    prefersReducedMotion ||
    mediaQueryRequestsReducedMotion
  ) {
    return <DawnHeroStaticOverlay />
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      data-dawn-hero-overlay="motion"
    >
      <Player
        allowFullscreen={false}
        autoPlay
        clickToPlay={false}
        component={DawnHeroComposition}
        compositionHeight={COMPOSITION_SIZE}
        compositionWidth={COMPOSITION_SIZE}
        controls={false}
        durationInFrames={240}
        fps={30}
        initiallyMuted
        loop
        numberOfSharedAudioTags={0}
        showVolumeControls={false}
        spaceKeyToPlayOrPause={false}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "transparent",
          overflow: "hidden",
        }}
      />
    </div>
  )
}
