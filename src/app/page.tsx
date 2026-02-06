import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LandingPage } from "@/components/landing/landing-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JobSilver - AI-Powered Job Search Assistant",
  description: "Find your dream job faster with AI-powered matching, smart curation, and an intelligent assistant that helps you craft perfect applications.",
  keywords: ["job search", "AI job matching", "AI assistant", "job tracker", "application tracking", "cover letter generator"],
  openGraph: {
    title: "JobSilver - AI-Powered Job Search Assistant",
    description: "Find your dream job faster with AI-powered matching, smart curation, and an intelligent assistant that helps you craft perfect applications.",
    type: "website",
    url: "https://jobsilver.com",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JobSilver - AI-Powered Job Search Assistant',
      },
    ],
  },
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return <LandingPage />
}
