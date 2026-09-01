import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin/auth'
import {
  uuidSchema,
  parseRequestBody,
  parseQueryParams,
  paginationSchema,
} from '@/lib/security/validation'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'
import { z } from 'zod'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Generate a unique invite code
 * Format: 8 alphanumeric characters (easy to type/share)
 */
function generateInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase()
}

/**
 * Zod schema for creating a tester invite
 */
const createTesterInviteSchema = z.object({
  expires_at: z.string().datetime().optional().nullable(),
})

/**
 * Zod schema for revoking a tester invite
 */
const revokeTesterInviteSchema = z.object({
  invite_id: uuidSchema,
})

/**
 * GET /api/admin/testers
 * List all testers and invite codes (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: adminAuth.error || 'Forbidden' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'testers-get')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url)
    const queryValidation = parseQueryParams(searchParams, paginationSchema)

    if (!queryValidation.success) {
      return NextResponse.json(queryValidation.error, { status: 400 })
    }

    const { limit, offset } = queryValidation.data

    const supabase = createServiceClient()

    // Get all tester invites with creator and user info
    const { data: invites, count: invitesCount, error: invitesError } = await supabase
      .from('tester_invites')
      .select(`
        *,
        creator:profiles!tester_invites_created_by_fkey(email, full_name),
        user:profiles!tester_invites_used_by_fkey(email, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (invitesError) {
      console.error('Error fetching tester invites:', invitesError)
      return NextResponse.json({ error: 'Failed to fetch tester invites' }, { status: 500 })
    }

    // Get all tester profiles
    const { data: testers, count: testersCount, error: testersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_tester, tester_invite_code, created_at', { count: 'exact' })
      .eq('is_tester', true)
      .order('created_at', { ascending: false })

    if (testersError) {
      console.error('Error fetching testers:', testersError)
      return NextResponse.json({ error: 'Failed to fetch testers' }, { status: 500 })
    }

    // Get stats
    const stats = {
      total_invites: invitesCount || 0,
      active_invites: invites?.filter(i => i.is_active && !i.used_by).length || 0,
      used_invites: invites?.filter(i => i.used_by).length || 0,
      expired_invites: invites?.filter(i => i.expires_at && new Date(i.expires_at) < new Date()).length || 0,
      total_testers: testersCount || 0,
    }

    return NextResponse.json(
      {
        invites: invites || [],
        testers: testers || [],
        stats,
        pagination: {
          limit,
          offset,
          total: invitesCount || 0,
          hasMore: (invitesCount || 0) > offset + limit,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in testers GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch testers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/testers
 * Generate a new tester invite code (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'testers-post')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    // Validate request body (optional fields)
    const bodyValidation = await parseRequestBody(request, createTesterInviteSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { expires_at } = bodyValidation.data

    // Generate unique invite code
    const invite_code = generateInviteCode()

    // Use service client to insert (bypasses RLS for admin operations)
    const supabaseService = createServiceClient()

    const { data: invite, error } = await supabaseService
      .from('tester_invites')
      .insert({
        invite_code,
        created_by: adminAuth.user!.id,
        expires_at: expires_at || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tester invite:', error)

      // Handle unique constraint violation (extremely unlikely with 8-char hex)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Failed to generate unique invite code. Please try again.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: 'Failed to create tester invite' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        invite,
        signup_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/tester?code=${invite_code}`,
      },
      {
        status: 201,
        headers: getRateLimitHeaders(rateLimit),
      }
    )
  } catch (error) {
    console.error('Error in testers POST:', error)
    return NextResponse.json(
      { error: 'Failed to create tester invite' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/testers
 * Revoke a tester invite code (admin only)
 * This sets is_active = false, it does NOT remove tester status from users who already used the invite
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting - stricter for destructive operations
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(
      clientId,
      { maxRequests: 10, windowSeconds: 60, prefix: 'admin-delete' },
      'testers-delete'
    )

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
    const bodyValidation = await parseRequestBody(request, revokeTesterInviteSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { invite_id } = bodyValidation.data

    const supabase = createServiceClient()

    // Revoke the invite (set is_active = false)
    const { data, error } = await supabase
      .from('tester_invites')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', invite_id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error revoking tester invite:', error)
      return NextResponse.json({ error: 'Failed to revoke tester invite' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        success: true,
        revoked: true,
        invite_id,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in testers DELETE:', error)
    return NextResponse.json(
      { error: 'Failed to revoke tester invite' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/testers
 * Update tester status for a user (e.g., remove tester access)
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'testers-patch')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const updateTesterSchema = z.object({
      user_id: uuidSchema,
      is_tester: z.boolean(),
    })

    // Validate request body
    const bodyValidation = await parseRequestBody(request, updateTesterSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { user_id, is_tester } = bodyValidation.data

    const serviceClient = createServiceClient()

    // Keep tester access separate from billing entitlement. Revocation
    // atomically restores the plan represented by the subscription ledger.
    const { error } = await serviceClient.rpc('set_tester_status', {
      p_user_id: user_id,
      p_is_tester: is_tester,
      p_invite_code: is_tester ? 'ADMIN_GRANTED' : null,
    })

    if (error) {
      console.error('Error updating tester status:', error)
      return NextResponse.json({ error: 'Failed to update tester status' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        user_id,
        is_tester,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in testers PATCH:', error)
    return NextResponse.json(
      { error: 'Failed to update tester status' },
      { status: 500 }
    )
  }
}
