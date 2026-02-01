import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit"
import { logAccountEvent, createAuditContext } from "@/lib/security/audit-log"
import { getStripeClient } from "@/lib/stripe/client"

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

    // Cancel Stripe subscription and delete customer BEFORE deleting database records
    // This ensures we have the Stripe IDs before the records are deleted
    try {
      // Get subscription info first
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id, status")
        .eq("user_id", userId)
        .single()

      // Cancel active subscription in Stripe
      if (subscription?.stripe_subscription_id &&
          ["active", "trialing", "past_due"].includes(subscription.status)) {
        try {
          const stripe = getStripeClient()
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
          console.log(`Cancelled Stripe subscription ${subscription.stripe_subscription_id} for user ${userId}`)
        } catch (stripeError) {
          console.error("Error cancelling Stripe subscription:", stripeError)
          // Continue even if cancellation fails - subscription will be orphaned but user can contact support
        }
      }

      // Get and delete Stripe customer
      const { data: customer } = await supabase
        .from("customers")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .single()

      if (customer?.stripe_customer_id) {
        try {
          const stripe = getStripeClient()
          await stripe.customers.del(customer.stripe_customer_id)
          console.log(`Deleted Stripe customer ${customer.stripe_customer_id} for user ${userId}`)
        } catch (stripeError) {
          console.error("Error deleting Stripe customer:", stripeError)
          // Continue even if deletion fails
        }
      }
    } catch (stripeError) {
      console.error("Error in Stripe cleanup:", stripeError)
      // Continue with database cleanup even if Stripe fails
    }

    // Delete all user data from tables in order (respecting foreign keys)
    // Use admin client to bypass RLS policies for complete cleanup
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

    // COMPREHENSIVE list of all tables with user data
    // Order matters: delete tables with foreign keys first, then parent tables
    //
    // Phase 1: Tables that reference jobs (must delete before jobs)
    const tablesReferencingJobs = [
      { table: "job_chat_messages", column: "user_id" },
      { table: "user_favorite_jobs", column: "user_id" },
      { table: "user_interactions", column: "user_id" },
      { table: "scraped_questions", column: "job_id", useJobIds: true },
      { table: "application_queue", column: "user_id" },
      { table: "application_history", column: "user_id" },
    ]

    // Phase 2: Tables that reference profiles (must delete before profiles)
    const tablesReferencingProfiles = [
      { table: "user_learning_settings", column: "user_id" },
      { table: "user_ai_preferences", column: "user_id" },
      { table: "user_reports", column: "user_id" },
      { table: "saved_answers", column: "user_id" },
    ]

    // Phase 3: Tables that reference auth.users directly
    const tablesReferencingAuthUsers = [
      { table: "platform_credentials", column: "user_id" },
      { table: "scraper_failures", column: "user_id" },
      { table: "user_job_quotas", column: "user_id" },
      { table: "curation_logs", column: "user_id" },
      { table: "subscriptions", column: "user_id" },
      { table: "customers", column: "user_id" },
      { table: "notifications", column: "user_id" },
      { table: "user_ai_usage", column: "user_id" },
      { table: "api_request_log", column: "triggered_by_user_id" },
    ]

    // Phase 4: Main data tables
    const mainTables = [
      { table: "jobs", column: "user_id" },
      { table: "user_preferences", column: "user_id" },
      { table: "profiles", column: "id" },
      { table: "users", column: "id" }, // public.users table
    ]

    // Handle tester_invites specially (has both used_by and created_by)
    try {
      await supabaseAdmin.from("tester_invites").update({ used_by: null }).eq("used_by", userId)
      await supabaseAdmin.from("tester_invites").delete().eq("created_by", userId)
    } catch (error) {
      console.error("Error cleaning tester_invites:", error)
    }

    // Delete in order: jobs-dependent -> profiles-dependent -> auth-dependent -> main tables
    const allTables = [
      ...tablesReferencingJobs,
      ...tablesReferencingProfiles,
      ...tablesReferencingAuthUsers,
      ...mainTables,
    ]

    for (const { table, column, useJobIds } of allTables as { table: string; column: string; useJobIds?: boolean }[]) {
      try {
        if (useJobIds) {
          // For scraped_questions, delete by job_id (jobs belonging to user)
          const { data: userJobs } = await supabaseAdmin
            .from("jobs")
            .select("id")
            .eq("user_id", userId)

          if (userJobs && userJobs.length > 0) {
            const jobIds = userJobs.map(j => j.id)
            await supabaseAdmin.from(table).delete().in(column, jobIds)
          }
        } else {
          await supabaseAdmin.from(table).delete().eq(column, userId)
        }
      } catch (error) {
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

    // Delete the auth user (admin client already created above)
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
