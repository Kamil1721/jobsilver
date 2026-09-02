"use client"

import Image from "next/image"
import { CtaButton } from "./cta-button"
import { DawnHeroMotionOverlay } from "./dawn-hero-motion"
import { geist } from "./fonts"

export function DawnHero() {
  return (
    <section
      aria-labelledby="dawn-hero-heading"
      className={`${geist.className} relative overflow-hidden bg-[var(--dawn-hero)] pt-[68px]`}
    >
      <div className="mx-auto grid min-h-[calc(100dvh-68px)] max-w-[var(--dawn-content)] items-center gap-9 px-[var(--dawn-gutter)] pb-12 pt-10 sm:pb-16 sm:pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:py-16 xl:gap-16">
        <div className="relative z-10 max-w-[590px]">
          <h1
            id="dawn-hero-heading"
            className="dawn-hero-copy max-w-[11ch] text-balance text-[clamp(42px,6.2vw,72px)] font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--dawn-ink)]"
          >
            Wake up to jobs worth your time.
          </h1>

          <p
            style={{ animationDelay: "80ms" }}
            className="dawn-hero-copy mt-6 max-w-[48ch] text-pretty text-[clamp(17px,1.25vw,19px)] leading-[1.58] text-[var(--dawn-ink-2)]"
          >
            Each morning, JobSilver adds fresh matches to your dashboard based
            on the roles, locations, and work preferences you choose. When one
            stands out, it helps you prepare the application.
          </p>

          <div
            style={{ animationDelay: "160ms" }}
            className="dawn-hero-copy mt-8 flex flex-col items-stretch gap-3 min-[390px]:flex-row min-[390px]:items-center"
          >
            <CtaButton href="/login" variant="coral" size="lg">
              Start free
            </CtaButton>
            <CtaButton href="/#sample-shortlist" variant="ghost" size="lg">
              See a sample shortlist
            </CtaButton>
          </div>

          <p
            style={{ animationDelay: "240ms" }}
            className="dawn-hero-copy mt-5 text-[13px] leading-relaxed text-[var(--dawn-ink-2)]"
          >
            Free plan available. Pro starts at $3.99 a week.
          </p>
        </div>

        <div
          className="dawn-hero-frame relative mx-auto w-full max-w-[580px] overflow-hidden rounded-[26px] bg-[var(--dawn-hero-art)] shadow-[0_26px_80px_-48px_rgba(31,27,24,0.42)] lg:max-w-none"
        >
          <Image
            src="/illustrations/hero-dawn.png"
            alt="A person sleeping while three job matches are organized for the morning"
            width={1254}
            height={1254}
            priority
            sizes="(max-width: 1024px) 92vw, 560px"
            className="h-auto w-full select-none"
          />
          <DawnHeroMotionOverlay />
        </div>
      </div>
    </section>
  )
}
