import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit"
import { logAccountEvent, createAuditContext } from "@/lib/security/audit-log"

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Rate limiting - stricter limits for account deletion (max 3 attempts per hour)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 3, windowSeconds: 3600, prefix: 'account-delete' }, 'account-delete')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many deletion attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Verify confirmation was sent
    const body = await request.json()
    if (body.confirmation !== "confirm") {
      return NextResponse.json(
        { error: "Invalid confirmation" },
        { status: 400 }
      )
    }

    const userId = user.id

    // Delete all user data from tables in order (respecting foreign keys)
    // Using the regular client with RLS policies

    // Delete user-related records from all tables
    const tablesToDelete = [
      "user_ai_usage",
      "user_learning_settings",
      "user_preferences",
      "user_interactions",
      "user_favorite_jobs",
      "notifications",
      "curation_logs",
      "user_reports",
      "saved_answers",
      "application_history",
      "user_job_quotas",
      "subscriptions",
      "customers",
      "jobs", // This will cascade to scraped_questions, application_queue via FK
      "profiles",
    ]

    for (const table of tablesToDelete) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(table === "profiles" ? "id" : "user_id", userId)

      if (error) {
        console.error(`Error deleting from ${table}:`, error)
        // Continue with other tables even if one fails
      }
    }

    // Delete CV files from storage
    const { data: files } = await supabase.storage
      .from("cvs")
      .list(userId)

    if (files && files.length > 0) {
      const filePaths = files.map((file) => `${userId}/${file.name}`)
      await supabase.storage.from("cvs").remove(filePaths)
    }

    // Delete the auth user using service role (requires admin client)
    // This needs the SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError)
      return NextResponse.json(
        { error: "Failed to delete account. Please try again or contact support." },
        { status: 500 }
      )
    }

    // Log successful account deletion
    const auditContext = createAuditContext(request)
    logAccountEvent('account.deleted', {
      userId,
      ip: auditContext.ip,
      details: {
        email: user.email,
        deletedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Account deletion error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
