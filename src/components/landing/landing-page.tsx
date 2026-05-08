import { AmbientBackground } from "./ambient-background"
import { Nav } from "./nav"
import { Hero } from "./hero"
import { ThreeSteps } from "./three-steps"
import { AIDemoSection } from "./ai-demo-section"
import { PricingPreview } from "./pricing-preview"
import { Footer } from "./footer"

export function LandingPage() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background: "var(--bg-base)",
        color: "var(--fg-1)",
        fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      }}
    >
      <AmbientBackground />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <ThreeSteps />
        <AIDemoSection />
        <PricingPreview />
      </main>
      <Footer />
    </div>
  )
}
