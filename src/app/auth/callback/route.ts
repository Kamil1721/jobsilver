import { createClient, createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { notifyWelcome } from "@/lib/email/triggers"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const inviteCode = searchParams.get("invite")
  const isTesterPage = searchParams.get("tester") === "true"
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && sessionData.user) {
      // Check if this is a new user (profile created in last 5 minutes) and send welcome email
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', sessionData.user.id)
          .single()

        if (profile) {
          const createdAt = new Date(profile.created_at)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
          if (createdAt > fiveMinutesAgo) {
            // New user - send welcome email (don't await, fire and forget)
            notifyWelcome(sessionData.user.id).catch(err =>
              console.error('[Auth Callback] Failed to send welcome email:', err)
            )
          }
        }
      } catch (welcomeError) {
        console.error('[Auth Callback] Error checking for new user:', welcomeError)
        // Continue even if welcome email check fails
      }

      // If coming from /tester page (tester=true), redirect to apply tester status
      // The invite code is stored in localStorage, so we redirect to a client-side page
      // that will call the API with the stored invite code
      if (isTesterPage) {
        return NextResponse.redirect(`${origin}/tester/complete`)
      }

      // If there's an invite code in URL params, apply tester status via invite
      if (inviteCode) {
        try {
          const applied = await applyTesterInvite(inviteCode, sessionData.user.id)
          if (applied) {
            // Redirect with success message - testers bypass plan selection
            return NextResponse.redirect(`${origin}${next}?tester=activated`)
          }
        } catch (inviteError) {
          console.error("Failed to apply tester invite:", inviteError)
          // Continue even if invite application fails
        }
      }

      // For regular users, check if they need to go through onboarding
      // The middleware will handle the redirect logic based on has_selected_plan and job_filters
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error("Auth callback error:", error?.message)
  }

  // Return to login with error if something went wrong
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

/**
 * Apply a tester invite code to a user (server-side version)
 */
async function applyTesterInvite(inviteCode: string, userId: string): Promise<boolean> {
  const supabaseService = createServiceClient()

  // Look up the invite code
  const { data: invite, error: inviteError } = await supabaseService
    .from("tester_invites")
    .select("*")
    .eq("invite_code", inviteCode.toUpperCase())
    .single()

  if (inviteError || !invite) {
    console.error("Invalid invite code:", inviteCode)
    return false
  }

  // Validate invite is usable
  if (!invite.is_active) {
    console.error("Invite is not active:", inviteCode)
    return false
  }

  if (invite.used_by) {
    console.error("Invite already used:", inviteCode)
    return false
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    console.error("Invite expired:", inviteCode)
    return false
  }

  // Check if user is already a tester
  const { data: profile } = await supabaseService
    .from("profiles")
    .select("is_tester")
    .eq("id", userId)
    .single()

  if (profile?.is_tester) {
    console.log("User already has tester status:", userId)
    return true // Already a tester, consider this a success
  }

  // Mark invite as used
  const { error: updateInviteError } = await supabaseService
    .from("tester_invites")
    .update({
      used_by: userId,
      used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)

  if (updateInviteError) {
    console.error("Error marking invite as used:", updateInviteError)
    return false
  }

  // Update user profile to be a tester with has_selected_plan=true
  // Testers get Pro plan and bypass plan selection
  const { error: updateProfileError } = await supabaseService
    .from("profiles")
    .update({
      is_tester: true,
      tester_invite_code: invite.invite_code,
      has_selected_plan: true,
      subscription_plan: "pro",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (updateProfileError) {
    console.error("Error updating user profile:", updateProfileError)
    // Try to rollback the invite update
    await supabaseService
      .from("tester_invites")
      .update({
        used_by: null,
        used_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
    return false
  }

  console.log("Successfully applied tester status to user:", userId)
  return true
}

// Note: applyAutoTesterStatus was removed for security reasons.
// Tester status now requires a valid invite code, validated via /api/auth/tester-auto
