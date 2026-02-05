import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAdminAuth, isAdminEmail } from '@/lib/admin/auth'
import {
  sanitizeSearchInput,
  sanitizeSearchPattern,
  validateUUID,
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

    // Get stats per plan
    const { data: planStats } = await supabase
      .from('profiles')
      .select('subscription_plan')

    const statsByPlan: Record<string, number> = {
      free: 0,
      starter: 0,
      pro: 0,
      ultra: 0,
    }

    if (planStats) {
      for (const user of planStats) {
        const userPlan = user.subscription_plan || 'free'
        statsByPlan[userPlan] = (statsByPlan[userPlan] || 0) + 1
      }
    }

    // Get job counts for each user
    const userIds = users?.map(u => u.id) || []
    const { data: jobCounts } = await supabase
      .from('jobs')
      .select('user_id')
      .in('user_id', userIds)

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

    // SECURITY: Only is_tester can be modified through admin UI
    // - subscription_plan changes ONLY via Stripe webhooks (prevents billing bypass)
    // - is_admin changes ONLY via ADMIN_EMAILS env var (prevents privilege escalation)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (is_tester !== undefined) {
      updateData.is_tester = is_tester
      if (is_tester) {
        updateData.tester_invite_code = 'ADMIN_GRANTED'
      }
    }

    // Get target user email for audit log
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single()

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user_id)

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

    const supabase = await createClient()

    // Prevent self-deletion
    if (user_id === adminAuth.user?.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Don't allow deleting admin users
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('is_admin, email')
      .eq('id', user_id)
      .single()

    // Check both database flag and environment variable for admin status
    if (targetUser?.is_admin || isAdminEmail(targetUser?.email)) {
      return NextResponse.json({ error: 'Cannot delete admin users' }, { status: 400 })
    }

    // Use service role client for admin operations
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Delete related data first (in case cascade doesn't work)
    // Delete jobs
    await supabaseAdmin.from('jobs').delete().eq('user_id', user_id)

    // Delete job quotas
    await supabaseAdmin.from('user_job_quotas').delete().eq('user_id', user_id)

    // Delete application history
    await supabaseAdmin.from('application_history').delete().eq('user_id', user_id)

    // Delete saved answers
    await supabaseAdmin.from('saved_answers').delete().eq('user_id', user_id)

    // Delete application queue
    await supabaseAdmin.from('application_queue').delete().eq('user_id', user_id)

    // Delete platform credentials
    await supabaseAdmin.from('platform_credentials').delete().eq('user_id', user_id)

    // Delete scraper failures
    await supabaseAdmin.from('scraper_failures').delete().eq('user_id', user_id)

    // Delete user reports
    await supabaseAdmin.from('user_reports').delete().eq('user_id', user_id)

    // Delete subscriptions
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', user_id)

    // Delete customers
    await supabaseAdmin.from('customers').delete().eq('user_id', user_id)

    // Delete curation logs
    await supabaseAdmin.from('curation_logs').delete().eq('user_id', user_id)

    // Delete notifications
    await supabaseAdmin.from('notifications').delete().eq('user_id', user_id)

    // Delete user favorites
    await supabaseAdmin.from('user_favorite_jobs').delete().eq('user_id', user_id)

    // Delete user interactions
    await supabaseAdmin.from('user_interactions').delete().eq('user_id', user_id)

    // Delete user preferences
    await supabaseAdmin.from('user_preferences').delete().eq('user_id', user_id)

    // Delete user learning settings
    await supabaseAdmin.from('user_learning_settings').delete().eq('user_id', user_id)

    // Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', user_id)

    if (profileError) {
      console.error('Error deleting user profile:', profileError)
      return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 })
    }

    // Delete from Supabase Auth (auth.users)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (authError) {
      console.error('Error deleting user from auth:', authError)
      // Profile already deleted, so we report partial success
      return NextResponse.json(
        {
          success: true,
          deleted: user_id,
          warning: 'User data deleted but auth account removal failed'
        },
        { headers: getRateLimitHeaders(rateLimit) }
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
        targetEmail: targetUser?.email,
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
