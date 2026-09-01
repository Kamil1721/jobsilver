import { createClient, createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { notifyWelcome } from "@/lib/email/triggers"
import { getAppOrigin, getSafeInternalPath } from "@/lib/security/urls"
import { ensureProfileForAuthenticatedUser } from "@/lib/supabase/ensure-profile"

const AUTH_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
}

function authRedirect(url: URL) {
  return NextResponse.redirect(url, { headers: AUTH_RESPONSE_HEADERS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getAppOrigin(request.url)
  const code = searchParams.get("code")
  const inviteCode = searchParams.get("invite")
  const isTesterPage = searchParams.get("tester") === "true"
  const next = getSafeInternalPath(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && sessionData.user) {
      let profile: Awaited<ReturnType<typeof ensureProfileForAuthenticatedUser>>

      try {
        profile = await ensureProfileForAuthenticatedUser(sessionData.user)
      } catch (profileError) {
        console.error("[Auth Callback] Failed to prepare profile:", profileError)
        await supabase.auth.signOut()
        const loginUrl = new URL("/login", origin)
        loginUrl.searchParams.set("error", "profile_setup_failed")
        return authRedirect(loginUrl)
      }

      // Check if this is a new user (profile created in last 5 minutes) and send welcome email
      try {
        const createdAt = new Date(profile.created_at)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        if (createdAt > fiveMinutesAgo) {
          // New user - send welcome email (don't await, fire and forget)
          notifyWelcome(sessionData.user.id).catch(err =>
            console.error('[Auth Callback] Failed to send welcome email:', err)
          )
        }
      } catch (welcomeError) {
        console.error('[Auth Callback] Error checking for new user:', welcomeError)
        // Continue even if welcome email check fails
      }

      // If coming from /tester page (tester=true), redirect to apply tester status
      // The invite code is stored in localStorage, so we redirect to a client-side page
      // that will call the API with the stored invite code
      if (isTesterPage) {
        return authRedirect(new URL("/tester/complete", origin))
      }

      // If there's an invite code in URL params, apply tester status via invite
      if (inviteCode) {
        try {
          const applied = await applyTesterInvite(inviteCode, sessionData.user.id)
          if (applied) {
            // Redirect with success message - testers bypass plan selection
            const redirectUrl = new URL(next, origin)
            redirectUrl.searchParams.set("tester", "activated")
            return authRedirect(redirectUrl)
          }
        } catch (inviteError) {
          console.error("Failed to apply tester invite:", inviteError)
          // Continue even if invite application fails
        }
      }

      // For regular users, check if they need to go through onboarding
      // The middleware will handle the redirect logic based on has_selected_plan and job_filters
      return authRedirect(new URL(next, origin))
    }

    console.error("Auth callback error:", error?.message)
  }

  // Return to login with error if something went wrong
  const loginUrl = new URL("/login", origin)
  loginUrl.searchParams.set("error", "auth_callback_failed")
  return authRedirect(loginUrl)
}

/**
 * Apply a tester invite code to a user (server-side version)
 */
async function applyTesterInvite(inviteCode: string, userId: string): Promise<boolean> {
  const supabaseService = createServiceClient()
  const { data: redeemResult, error: redeemError } = await supabaseService.rpc(
    "redeem_tester_invite",
    {
      p_invite_code: inviteCode,
      p_user_id: userId,
    }
  )

  if (redeemError) {
    console.error("Failed to redeem tester invite:", redeemError)
    return false
  }

  return redeemResult?.success === true
}

// Note: applyAutoTesterStatus was removed for security reasons.
// Tester status now requires a valid invite code, validated via /api/auth/tester-auto
