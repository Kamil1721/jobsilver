import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { logAccountEvent, createAuditContext } from "@/lib/security/audit-log"
import { getStripeClient } from "@/lib/stripe/client"
import { deleteUserData } from "@/lib/account/delete-user-data"

export const dynamic = 'force-dynamic'

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

    // Shared, fail-closed deletion of every user-data table (including
    // public.users, whose UNIQUE email constraint would block this address from
    // re-registering if a row lingered) plus CV storage. Same helper as the
    // admin panel's delete, so the two paths cannot drift apart.
    const deleteFailures = await deleteUserData(supabaseAdmin, userId)

    // Abort BEFORE deleting the auth user if any personal data failed to delete —
    // the user can retry; telling them "deleted" while rows remain is the worse failure.
    if (deleteFailures.length > 0) {
      console.error("Account deletion incomplete, auth user NOT deleted:", deleteFailures)
      return NextResponse.json(
        { error: "Some of your data could not be deleted. Please try again or contact support." },
        { status: 500 }
      )
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
