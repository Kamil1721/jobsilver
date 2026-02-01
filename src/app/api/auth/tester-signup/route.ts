import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseRequestBody } from '@/lib/security/validation'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * Zod schema for validating an invite code
 */
const validateInviteSchema = z.object({
  invite_code: z.string().min(1).max(20),
})

/**
 * Zod schema for applying an invite to a user
 */
const applyInviteSchema = z.object({
  invite_code: z.string().min(1).max(20),
})

/**
 * GET /api/auth/tester-signup?code=XXXX
 * Validate an invite code (public endpoint for signup page)
 * Returns whether the code is valid and can be used
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting (strict to prevent code enumeration)
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.auth, 'tester-validate')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json(
        { error: 'Missing invite code' },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    const validation = validateInviteSchema.safeParse({ invite_code: code })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid invite code format' },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    const supabaseService = createServiceClient()

    // Look up the invite code
    const { data: invite, error } = await supabaseService
      .from('tester_invites')
      .select('id, invite_code, used_by, expires_at, is_active')
      .eq('invite_code', code.toUpperCase())
      .single()

    // Security: Return generic response for all failure cases
    // to prevent invite code enumeration attacks
    if (error || !invite) {
      return NextResponse.json(
        { valid: false },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Check if invite is active
    if (!invite.is_active) {
      return NextResponse.json(
        { valid: false },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Check if already used
    if (invite.used_by) {
      return NextResponse.json(
        { valid: false },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Invite is valid
    return NextResponse.json(
      {
        valid: true,
        invite_code: invite.invite_code,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error validating invite code:', error)
    return NextResponse.json(
      { error: 'Failed to validate invite code' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/tester-signup
 * Apply an invite code to the current authenticated user
 * Called after user signs up to mark them as a tester
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.auth, 'tester-apply')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    // Validate request body
    const bodyValidation = await parseRequestBody(request, applyInviteSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { invite_code } = bodyValidation.data

    // Get the authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to apply an invite code',
          },
        },
        { status: 401 }
      )
    }

    // Use service client for the invite lookup and atomic redemption (bypasses RLS)
    const supabaseService = createServiceClient()

    // Check if user is already a tester
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('is_tester')
      .eq('id', user.id)
      .single()

    if (profile?.is_tester) {
      return NextResponse.json(
        {
          error: {
            code: 'ALREADY_TESTER',
            message: 'You already have tester access',
          },
        },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Use atomic function to redeem invite (prevents race conditions)
    const { data: redeemResult, error: redeemError } = await supabaseService.rpc(
      'redeem_tester_invite',
      {
        p_invite_code: invite_code,
        p_user_id: user.id,
      }
    )

    if (redeemError) {
      console.error('Error calling redeem_tester_invite:', redeemError)
      return NextResponse.json(
        { error: 'Failed to apply invite code' },
        { status: 500 }
      )
    }

    // Check if redemption was successful
    if (!redeemResult?.success) {
      // Return generic error to prevent information disclosure
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_INVITE',
            message: 'Invalid or unavailable invite code',
          },
        },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    return NextResponse.json(
      {
        success: true,
        is_tester: true,
        message: 'Tester access granted! You now have full feature access.',
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error applying invite code:', error)
    return NextResponse.json(
      { error: 'Failed to apply invite code' },
      { status: 500 }
    )
  }
}
