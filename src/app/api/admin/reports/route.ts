import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin/auth'
import type { ReportStatus } from '@/lib/supabase/types'
import { z } from 'zod'
import {
  uuidSchema,
  validateUUID,
  parseRequestBody,
} from '@/lib/security/validation'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: ReportStatus[] = ['open', 'in_progress', 'resolved', 'wont_fix', 'duplicate']

// Validation schemas
const reportUpdateSchema = z.object({
  report_id: uuidSchema,
  status: z.enum(['open', 'in_progress', 'resolved', 'wont_fix', 'duplicate']).optional(),
  admin_notes: z.string().max(5000).optional(),
}).refine(
  data => data.status !== undefined || data.admin_notes !== undefined,
  { message: 'At least one field (status or admin_notes) must be provided' }
)

const reportDeleteSchema = z.object({
  report_ids: z.array(uuidSchema).min(1).max(100),
})

/**
 * GET /api/admin/reports
 * List all reports with filters and stats (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'reports-get')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const userId = searchParams.get('user_id')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    // Validate and sanitize pagination params
    const limit = Math.min(Math.max(1, parseInt(limitParam || '50', 10) || 50), 100)
    const offset = Math.max(0, parseInt(offsetParam || '0', 10) || 0)

    // Validate userId if provided
    if (userId) {
      const uuidValidation = validateUUID(userId)
      if (!uuidValidation.valid) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: uuidValidation.error } },
          { status: 400 }
        )
      }
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status as ReportStatus)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid status filter' } },
        { status: 400 }
      )
    }

    let query = supabase
      .from('user_reports')
      .select(`
        *,
        profiles:user_id (
          email,
          full_name,
          subscription_plan,
          created_at,
          cv_url,
          screening_answers
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('report_type', type)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: reports, count, error } = await query

    if (error) {
      console.error('Error fetching reports:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    // Enrich reports with additional debug data
    const enrichedReports = await Promise.all((reports || []).map(async (report) => {
      const enriched: Record<string, unknown> = { ...report }

      // Get job details if job_id exists
      if (report.job_id) {
        const { data: job } = await supabase
          .from('jobs')
          .select(`
            application_url,
            platform_detected,
            auto_apply_status,
            status,
            created_at,
            scraped_questions (
              id,
              questions
            )
          `)
          .eq('id', report.job_id)
          .single()

        if (job) {
          // scraped_questions is an array from the join - get first element
          const scrapedQuestions = Array.isArray(job.scraped_questions)
            ? job.scraped_questions[0]
            : job.scraped_questions
          enriched.job_details = {
            application_url: job.application_url,
            platform_detected: job.platform_detected,
            auto_apply_status: job.auto_apply_status,
            job_status: job.status,
            job_created_at: job.created_at,
            has_scraped_questions: !!scrapedQuestions,
            scraped_questions_count: scrapedQuestions?.questions?.length || 0,
          }
        }
      }

      // Count other reports from same user
      const { count: userReportCount } = await supabase
        .from('user_reports')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', report.user_id)
        .neq('id', report.id)

      enriched.user_report_count = userReportCount || 0

      // Count other reports for same job (if applicable)
      if (report.job_id) {
        const { count: jobReportCount } = await supabase
          .from('user_reports')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', report.job_id)
          .neq('id', report.id)

        enriched.job_report_count = jobReportCount || 0
      }

      return enriched
    }))

    // Get stats
    const { data: allReports } = await supabase
      .from('user_reports')
      .select('status, report_type')

    const statsByStatus: Record<string, number> = {}
    const statsByType: Record<string, number> = {}

    if (allReports) {
      for (const report of allReports) {
        statsByStatus[report.status] = (statsByStatus[report.status] || 0) + 1
        statsByType[report.report_type] = (statsByType[report.report_type] || 0) + 1
      }
    }

    return NextResponse.json(
      {
        reports: enrichedReports,
        total: count || 0,
        stats: {
          byStatus: statsByStatus,
          byType: statsByType,
        },
        pagination: {
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in admin reports GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/reports
 * Update report status/notes (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'reports-patch')

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
    const bodyValidation = await parseRequestBody(request, reportUpdateSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { report_id, status, admin_notes } = bodyValidation.data

    const supabase = await createClient()

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (status) {
      updateData.status = status

      // Set resolved fields if status is resolved/wont_fix/duplicate
      if (['resolved', 'wont_fix', 'duplicate'].includes(status)) {
        updateData.resolved_by = adminAuth.user?.id
        updateData.resolved_at = new Date().toISOString()
      } else {
        // Clear resolved fields if reopening
        updateData.resolved_by = null
        updateData.resolved_at = null
      }
    }

    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes
    }

    const { data: report, error } = await supabase
      .from('user_reports')
      .update(updateData)
      .eq('id', report_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating report:', error)
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
    }

    return NextResponse.json(
      { success: true, report },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in admin reports PATCH:', error)
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/reports
 * Delete reports (admin only)
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
      'reports-delete'
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
    const bodyValidation = await parseRequestBody(request, reportDeleteSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { report_ids } = bodyValidation.data

    const supabase = await createClient()

    const { error, count } = await supabase
      .from('user_reports')
      .delete()
      .in('id', report_ids)

    if (error) {
      console.error('Error deleting reports:', error)
      return NextResponse.json({ error: 'Failed to delete reports' }, { status: 500 })
    }

    return NextResponse.json(
      { success: true, deleted: count || report_ids.length },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in admin reports DELETE:', error)
    return NextResponse.json(
      { error: 'Failed to delete reports' },
      { status: 500 }
    )
  }
}
