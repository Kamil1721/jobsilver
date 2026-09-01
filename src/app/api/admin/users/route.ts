import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkAdminAuth, isAdminEmail } from '@/lib/admin/auth'
import {
  sanitizeSearchInput,
  sanitizeSearchPattern,
  adminUsersQuerySchema,
  adminUserUpdateSchema,
  adminUserDeleteSchema,
  parseRequestBody,
  parseQueryParams,
} from '@/lib/security/validation'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'
import { logAdminAction, createAuditContext, logAdminActionToDb } from '@/lib/security/audit-log'
import { deleteUserData } from '@/lib/account/delete-user-data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users
 * Get list of all users with their subscription plans (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: adminAuth.error || 'Forbidden' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'users-get')

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
    const queryValidation = parseQueryParams(searchParams, adminUsersQuerySchema)

    if (!queryValidation.success) {
      return NextResponse.json(queryValidation.error, { status: 400 })
    }

    const { limit, offset, search, plan } = queryValidation.data

    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by search term (email or name)
    // SECURITY FIX: Properly sanitize search input to prevent SQL injection via pattern matching
    if (search) {
      // First sanitize the raw input (remove control chars, truncate)
      const sanitizedInput = sanitizeSearchInput(search, 100)

      if (sanitizedInput) {
        // Then escape pattern matching special characters
        const escapedPattern = sanitizeSearchPattern(sanitizedInput)

        // Use Supabase's built-in parameterized query with escaped pattern
        query = query.or(`email.ilike.%${escapedPattern}%,full_name.ilike.%${escapedPattern}%`)
      }
    }

    // Filter by subscription plan
    if (plan) {
      query = query.eq('subscription_plan', plan)
    }

    const { data: users, count, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get stats per plan - calculate EFFECTIVE plan (considering tester/admin status)
    // Use service client to ensure we can see all profiles
    const serviceClient = createServiceClient()
    const { data: planStats } = await serviceClient
      .from('profiles')
      .select('subscription_plan, is_tester, is_admin')

    // 3-tier model: free, pro, ultra (no starter - it's legacy)
    const statsByPlan: Record<string, number> = {
      free: 0,
      pro: 0,
      ultra: 0,
    }

    if (planStats) {
      for (const user of planStats) {
        // Calculate effective plan: testers and admins get ultra-level access
        let effectivePlan: string
        if (user.is_admin || user.is_tester) {
          effectivePlan = 'ultra'
        } else {
          // Map legacy plans to current model
          const dbPlan = user.subscription_plan || 'free'
          if (dbPlan === 'starter' || dbPlan === 'basic') {
            effectivePlan = 'free' // Legacy plans map to free
          } else if (dbPlan === 'mega') {
            effectivePlan = 'ultra' // Legacy mega maps to ultra
          } else {
            effectivePlan = dbPlan
          }
        }
        statsByPlan[effectivePlan] = (statsByPlan[effectivePlan] || 0) + 1
      }
    }

    // Get job counts for each user - use service client to bypass RLS
    // Exclude discarded jobs to match what users see on their dashboard
    const userIds = users?.map(u => u.id) || []
    const { data: jobCounts } = await serviceClient
      .from('jobs')
      .select('user_id')
      .in('user_id', userIds)
      .neq('status', 'discarded')

    const jobCountByUser: Record<string, number> = {}
    if (jobCounts) {
      for (const job of jobCounts) {
        jobCountByUser[job.user_id] = (jobCountByUser[job.user_id] || 0) + 1
      }
    }

    // Enrich users with job count
    const enrichedUsers = users?.map(user => ({
      ...user,
      job_count: jobCountByUser[user.id] || 0,
    })) || []

    return NextResponse.json(
      {
        users: enrichedUsers,
        total: count || 0,
        stats: statsByPlan,
        pagination: {
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in users API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/users
 * Update user details (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'users-patch')

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
    const bodyValidation = await parseRequestBody(request, adminUserUpdateSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { user_id, is_tester } = bodyValidation.data

    const supabase = await createClient()
    const serviceClient = createServiceClient()

    // Get target user email for audit log
    const { data: targetUser } = await serviceClient
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single()

    // Tester status is reconciled atomically with the billing ledger so a
    // revoke cannot leave invite-granted paid access behind.
    const { error } = await serviceClient.rpc('set_tester_status', {
      p_user_id: user_id,
      p_is_tester: is_tester,
      p_invite_code: is_tester ? 'ADMIN_GRANTED' : null,
    })

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    // P2 FIX: Add audit logging for user PATCH operations
    const auditContext = createAuditContext(request)

    // Console audit log
    logAdminAction('admin.user_updated', {
      adminUserId: adminAuth.user?.id || 'unknown',
      targetUserId: user_id,
      ip: auditContext.ip,
      action: is_tester ? 'grant_tester' : 'revoke_tester',
      details: {
        targetEmail: targetUser?.email,
        is_tester,
        updatedAt: new Date().toISOString(),
      },
    })

    // Database audit log
    await logAdminActionToDb(supabase, {
      adminId: adminAuth.user?.id || 'unknown',
      adminEmail: adminAuth.user?.email || 'unknown',
      action: is_tester ? 'tester_granted' : 'tester_revoked',
      targetType: 'user',
      targetId: user_id,
      details: {
        targetEmail: targetUser?.email,
        is_tester,
      },
      ipAddress: auditContext.ip,
    })

    return NextResponse.json(
      { success: true, user_id },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in users PATCH:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users
 * Delete a user (admin only) - This will cascade delete all user data
 * including profile, jobs, subscriptions, and auth account
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
      'users-delete'
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
    const bodyValidation = await parseRequestBody(request, adminUserDeleteSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { user_id } = bodyValidation.data

    // Prevent self-deletion
    if (user_id === adminAuth.user?.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const supabaseAdmin = createServiceClient()

    // Don't allow deleting admin users
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, email')
      .eq('id', user_id)
      .maybeSingle()

    if (targetUserError) {
      console.error('Error fetching target user:', targetUserError)
      return NextResponse.json({ error: 'Failed to verify target user' }, { status: 500 })
    }

    const {
      data: { user: targetAuthUser },
      error: targetAuthError,
    } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (targetAuthError && targetAuthError.status !== 404) {
      console.error('Error fetching target auth user:', targetAuthError)
      return NextResponse.json({ error: 'Failed to verify target user' }, { status: 500 })
    }

    if (!targetUser && !targetAuthUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const targetEmail = targetAuthUser?.email || targetUser?.email || null

    // Profile email is user-editable, so only protected database state and the
    // verified Auth email may determine whether this account is an admin.
    if (
      targetUser?.is_admin ||
      isAdminEmail(targetAuthUser?.email)
    ) {
      return NextResponse.json({ error: 'Cannot delete admin users' }, { status: 400 })
    }

    // Shared, fail-closed deletion (same helper as /api/account/delete): checks
    // every result, covers ALL user-data tables including public.users (whose
    // UNIQUE email constraint blocks re-signup if an orphan row lingers), and
    // cleans up CV storage.
    const deleteFailures = await deleteUserData(supabaseAdmin, user_id)

    // Abort BEFORE removing the auth user if anything failed — retrying later is
    // fine; leaving orphans behind a "deleted" account is not.
    if (deleteFailures.length > 0) {
      console.error('Admin user deletion incomplete, auth user NOT deleted:', deleteFailures)
      return NextResponse.json(
        { error: 'Some user data could not be deleted. Nothing was finalized — please retry.', details: deleteFailures },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Delete from Supabase Auth (auth.users)
    const { error: authError } = targetAuthUser
      ? await supabaseAdmin.auth.admin.deleteUser(user_id)
      : { error: null }

    if (authError) {
      console.error('Error deleting user from auth:', authError)
      return NextResponse.json(
        {
          error: 'User data was deleted but the auth account removal failed. Retry to finish.',
        },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Log the admin action for audit trail
    const auditContext = createAuditContext(request)
    logAdminAction('admin.user_deleted', {
      adminUserId: adminAuth.user?.id || 'unknown',
      targetUserId: user_id,
      ip: auditContext.ip,
      action: 'delete_user',
      details: {
        targetEmail,
        deletedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json(
      { success: true, deleted: user_id },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in users DELETE:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
