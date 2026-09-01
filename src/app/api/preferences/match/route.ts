import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canAccessFeature, getRequiredPlan, formatPlanName } from "@/lib/features/config"
import type { SubscriptionPlan } from "@/lib/supabase/types"

// Force dynamic rendering since this route uses request.url
export const dynamic = 'force-dynamic'

// GET /api/preferences/match?jobId=xxx - Get preference match reasons for a specific job
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAM", message: "jobId is required" } },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      )
    }

    // Check feature access (Pro/Ultra only, or testers)
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_plan, is_tester")
      .eq("id", user.id)
      .single()

    const plan = (profile?.subscription_plan || "free") as SubscriptionPlan
    const isTester = profile?.is_tester || false
    const hasAccess = canAccessFeature(plan, "ai_learning", isTester)

    if (!hasAccess) {
      const requiredPlan = getRequiredPlan("ai_learning")
      return NextResponse.json(
        { error: { code: "FEATURE_LOCKED", message: `This feature requires the ${formatPlanName(requiredPlan)} plan or higher` } },
        { status: 403 }
      )
    }

    // Fetch the job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      )
    }

    // Fetch user preferences
    const { data: preferences } = await supabase
      .from("user_ai_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!preferences) {
      // No preferences yet - return empty reasons
      return NextResponse.json({ reasons: [], score: 0 })
    }

    // Generate match reasons based on job and preferences
    const reasons: string[] = []
    let score = 0

    // Check industry match
    const industries = preferences.industries as { name: string; weight: number }[] | null
    if (industries && industries.length > 0 && job.industry_category) {
      const matchingIndustry = industries.find(
        (ind) => job.industry_category?.toLowerCase().includes(ind.name.toLowerCase())
      )
      if (matchingIndustry) {
        reasons.push(`Matches your ${matchingIndustry.name} industry preference`)
        score += matchingIndustry.weight * 0.2
      }
    }

    // Check salary match
    if (preferences.salary_min || preferences.salary_max) {
      if (job.salary_min && job.salary_max) {
        const prefMin = preferences.salary_min || 0
        const prefMax = preferences.salary_max || Infinity
        const jobMid = (job.salary_min + job.salary_max) / 2

        if (jobMid >= prefMin && jobMid <= prefMax) {
          reasons.push("Salary is within your preferred range")
          score += 0.15
        }
      }
    }

    // Check remote preference
    if (preferences.remote_preference !== null && preferences.remote_preference !== undefined) {
      const isRemote = job.remote || job.location?.toLowerCase().includes("remote")
      const prefersRemote = preferences.remote_preference > 0.5

      if (isRemote && prefersRemote) {
        reasons.push("Matches your remote work preference")
        score += 0.15
      } else if (!isRemote && !prefersRemote) {
        reasons.push("Matches your on-site/hybrid preference")
        score += 0.1
      }
    }

    // Check positive keywords
    const positiveKeywords = preferences.positive_keywords as string[] | null
    if (positiveKeywords && positiveKeywords.length > 0) {
      const jobText = `${job.title} ${job.description || ""} ${job.company || ""}`.toLowerCase()
      const matchedKeywords = positiveKeywords.filter((kw) =>
        jobText.includes(kw.toLowerCase())
      )
      if (matchedKeywords.length > 0) {
        const keywordsStr = matchedKeywords.slice(0, 3).join(", ")
        reasons.push(`Contains keywords you like: ${keywordsStr}`)
        score += Math.min(matchedKeywords.length * 0.1, 0.3)
      }
    }

    // Check for negative keywords (reduce score)
    const negativeKeywords = preferences.negative_keywords as string[] | null
    if (negativeKeywords && negativeKeywords.length > 0) {
      const jobText = `${job.title} ${job.description || ""} ${job.company || ""}`.toLowerCase()
      const matchedNegative = negativeKeywords.filter((kw) =>
        jobText.includes(kw.toLowerCase())
      )
      if (matchedNegative.length > 0) {
        // Don't add as reason, but reduce score
        score -= Math.min(matchedNegative.length * 0.1, 0.2)
      }
    }

    // Check company preference
    const preferredCompanies = preferences.preferred_companies as string[] | null
    if (preferredCompanies && preferredCompanies.length > 0 && job.company) {
      const isPreferred = preferredCompanies.some(
        (comp) => job.company?.toLowerCase().includes(comp.toLowerCase())
      )
      if (isPreferred) {
        reasons.push(`From ${job.company}, a company you like`)
        score += 0.2
      }
    }

    // Normalize score to 0-1
    const normalizedScore = Math.max(0, Math.min(1, score))

    return NextResponse.json({
      reasons,
      score: normalizedScore,
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    )
  }
}
