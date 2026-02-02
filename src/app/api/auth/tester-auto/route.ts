import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/tester-auto
 *
 * Grants tester status to authenticated users with a valid invite code.
 *
 * Security: Requires both authentication AND a valid, unused invite code.
 * Uses atomic database operation to prevent race conditions.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body for invite code
    let inviteCode: string | undefined
    try {
      const body = await request.json()
      inviteCode = body.inviteCode
    } catch {
      // No body or invalid JSON
    }

    // Check if user is already a tester
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_tester')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // Already a tester
    if (profile?.is_tester) {
      return NextResponse.json({
        success: true,
        message: 'Already a tester',
        already_tester: true,
      })
    }

    // Use service role for database operations
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // SECURITY: Require a valid invite code
    if (!inviteCode) {
      return NextResponse.json(
        { success: false, error: 'Invite code required' },
        { status: 400 }
      )
    }

    // Normalize invite code to uppercase for consistent matching
    const normalizedInviteCode = inviteCode.toUpperCase()

    // SECURITY FIX: Use atomic operation to prevent race condition
    // This combines the check and update in a single transaction
    const { data: redeemResult, error: redeemError } = await supabaseService.rpc(
      'redeem_tester_invite',
      {
        p_invite_code: normalizedInviteCode,
        p_user_id: user.id,
      }
    )

    // If the RPC doesn't exist, fall back to the manual approach with optimistic locking
    if (redeemError?.code === '42883' || redeemError?.code === 'PGRST202') {
      // Function doesn't exist - use optimistic locking approach
      console.warn('redeem_tester_invite function not found, using fallback')

      // Atomically update the invite only if it's still unused
      const { data: updatedInvite, error: updateError } = await supabaseService
        .from('tester_invites')
        .update({
          used_by: user.id,
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('invite_code', normalizedInviteCode)
        .is('used_by', null)  // Only update if not already used (atomic check)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .select('id')
        .single()

      if (updateError || !updatedInvite) {
        // Check why it failed - get the invite details
        const { data: invite } = await supabaseService
          .from('tester_invites')
          .select('id, used_by, is_active, expires_at')
          .eq('invite_code', normalizedInviteCode)
          .single()

        if (!invite) {
          return NextResponse.json(
            { success: false, error: 'Invalid invite code' },
            { status: 400 }
          )
        }
        if (invite.used_by) {
          return NextResponse.json(
            { success: false, error: 'This invite code has already been used' },
            { status: 400 }
          )
        }
        if (!invite.is_active) {
          return NextResponse.json(
            { success: false, error: 'This invite code has been deactivated' },
            { status: 400 }
          )
        }
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          return NextResponse.json(
            { success: false, error: 'This invite code has expired' },
            { status: 400 }
          )
        }

        return NextResponse.json(
          { success: false, error: 'Failed to process invite code' },
          { status: 500 }
        )
      }
    } else if (redeemError) {
      console.error('Error redeeming invite:', redeemError)

      // Parse error message for user-friendly response
      const errorMessage = redeemError.message || 'Failed to process invite code'
      if (errorMessage.includes('not found') || errorMessage.includes('invalid')) {
        return NextResponse.json(
          { success: false, error: 'Invalid invite code' },
          { status: 400 }
        )
      }
      if (errorMessage.includes('already been used')) {
        return NextResponse.json(
          { success: false, error: 'This invite code has already been used' },
          { status: 400 }
        )
      }
      if (errorMessage.includes('expired')) {
        return NextResponse.json(
          { success: false, error: 'This invite code has expired' },
          { status: 400 }
        )
      }
      if (errorMessage.includes('deactivated') || errorMessage.includes('inactive')) {
        return NextResponse.json(
          { success: false, error: 'This invite code has been deactivated' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to process invite code' },
        { status: 500 }
      )
    }

    // Grant tester status with Pro plan and skip plan selection
    const { error: updateError } = await supabaseService
      .from('profiles')
      .update({
        is_tester: true,
        tester_invite_code: normalizedInviteCode,
        has_selected_plan: true,
        subscription_plan: 'pro',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to grant tester status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Tester status granted',
    })
  } catch (error) {
    console.error('Tester auto error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
