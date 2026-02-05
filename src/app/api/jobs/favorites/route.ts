import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canAccessFeature, getRequiredPlan, formatPlanName } from "@/lib/features/config"
import type { SubscriptionPlan } from "@/lib/supabase/types"

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic'

// GET /api/jobs/favorites - Get all favorite job IDs for the current user
export async function GET() {
  try {
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
    const hasAccess = canAccessFeature(plan, "favorites", isTester)

    if (!hasAccess) {
      const requiredPlan = getRequiredPlan("favorites")
      return NextResponse.json(
        { error: { code: "FEATURE_LOCKED", message: `This feature requires the ${formatPlanName(requiredPlan)} plan or higher` } },
        { status: 403 }
      )
    }

    // Fetch all favorite job IDs
    const { data: favorites, error } = await supabase
      .from("user_favorite_jobs")
      .select("job_id")
      .eq("user_id", user.id)

    if (error) {
      console.error("Error fetching favorites:", error)
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Failed to fetch favorites" } },
        { status: 500 }
      )
    }

    const favoriteIds = favorites?.map((f) => f.job_id) || []

    return NextResponse.json({ favoriteIds })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    )
  }
}
