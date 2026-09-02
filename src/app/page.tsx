import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LandingPage } from "@/components/landing/landing-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JobSilver: Wake Up to Jobs Worth Your Time",
  description: "Get fresh job matches based on your preferences each day. Draft cover letters, prepare application answers, and generate a tailored CV before you apply.",
  keywords: ["job search", "daily job shortlist", "job matching", "job tracker", "application tracking", "cover letter preparation", "CV preparation"],
  openGraph: {
    title: "JobSilver: Wake Up to Jobs Worth Your Time",
    description: "Get fresh job matches based on your preferences each day. Draft cover letters, prepare application answers, and generate a tailored CV before you apply.",
    siteName: "JobSilver",
    type: "website",
    url: "https://jobsilver.com",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JobSilver: Wake Up to Jobs Worth Your Time',
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
