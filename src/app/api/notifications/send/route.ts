import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  notifyWelcome,
  notifyNewMatches,
  type NotificationType,
} from '@/lib/email/triggers'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

interface NotificationPayload {
  type: NotificationType
  user_id: string
  // For job_matches
  match_count?: number
  top_matches?: Array<{
    id: string
    title: string
    company: string
    location?: string
    matchScore?: number
    remote?: boolean
  }>
}

/**
 * POST /api/notifications/send
 * Send a notification to a user
 *
 * This endpoint can be called:
 * - Internally by other API routes (with service role)
 * - By authenticated users for testing
 * - By cron jobs/webhooks with a secret key
 */
export async function POST(request: NextRequest) {
  try {
    // Check for internal API key for automated calls
    const apiKey = request.headers.get('x-api-key')
    const isInternalCall = apiKey === process.env.INTERNAL_API_KEY && process.env.INTERNAL_API_KEY

    // If not an internal call, check user authentication
    if (!isInternalCall) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        )
      }

      // Rate limiting - 20 requests per minute for POST
      const rateLimit = checkRateLimit(user.id, { maxRequests: 20, windowSeconds: 60, prefix: 'notify' }, 'notifications-send')
      if (!rateLimit.allowed) {
        const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
        return NextResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many notification requests. Please wait.' } },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }

      // Regular users can only send notifications to themselves
      const body = await request.json() as NotificationPayload
      if (body.user_id && body.user_id !== user.id) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Cannot send notifications to other users' } },
          { status: 403 }
        )
      }

      // Set user_id from auth if not provided
      body.user_id = body.user_id || user.id

      return await handleNotification(body)
    }

    // Internal call - parse body and proceed
    const body = await request.json() as NotificationPayload

    if (!body.user_id) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'user_id is required' } },
        { status: 400 }
      )
    }

    return await handleNotification(body)
  } catch (error) {
    console.error('Notification API error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process notification request' } },
      { status: 500 }
    )
  }
}

async function handleNotification(payload: NotificationPayload) {
  const { type, user_id } = payload

  if (!type) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', message: 'notification type is required' } },
      { status: 400 }
    )
  }

  let result

  switch (type) {
    case 'welcome':
      result = await notifyWelcome(user_id)
      break

    case 'job_matches':
      if (!payload.match_count || !payload.top_matches) {
        return NextResponse.json(
          { error: { code: 'INVALID_REQUEST', message: 'match_count and top_matches are required for job_matches notification' } },
          { status: 400 }
        )
      }
      result = await notifyNewMatches(user_id, payload.match_count, payload.top_matches)
      break

    default:
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: `Unknown notification type: ${type}` } },
        { status: 400 }
      )
  }

  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'NOTIFICATION_FAILED', message: result.error || 'Failed to send notification' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    notification_id: result.notificationId,
  })
}

/**
 * GET /api/notifications/send
 * Get notification history for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const type = searchParams.get('type') as NotificationType | null

    // Use service client to bypass RLS
    const serviceClient = createServiceClient()

    let query = serviceClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Failed to fetch notifications:', error)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch notifications' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      notifications: data,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Notification API error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    )
  }
}
