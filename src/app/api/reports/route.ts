import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReportType } from '@/lib/supabase/types'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const VALID_REPORT_TYPES: ReportType[] = [
  'incorrect_questions',
  'incorrect_description',
  'bug',
  'suggestion',
  'other',
]

/**
 * POST /api/reports
 * Submit a new report (authenticated users only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting - stricter for report creation to prevent abuse
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(
      clientId,
      { maxRequests: 10, windowSeconds: 60, prefix: 'reports' },
      'reports-post'
    )

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many reports submitted. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const body = await request.json()
    const {
      report_type,
      title,
      description,
      job_id,
      job_title,
      job_company,
      page_url,
      browser_info,
    } = body

    // Validation
    if (!report_type || !VALID_REPORT_TYPES.includes(report_type)) {
      return NextResponse.json(
        { error: 'Invalid report_type. Must be one of: ' + VALID_REPORT_TYPES.join(', ') },
        { status: 400 }
      )
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (title.length > 200) {
      return NextResponse.json({ error: 'Title must be 200 characters or less' }, { status: 400 })
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    if (description.length > 2000) {
      return NextResponse.json({ error: 'Description must be 2000 characters or less' }, { status: 400 })
    }

    // If job_id is provided, fetch job details for snapshots
    let finalJobTitle = job_title
    let finalJobCompany = job_company

    if (job_id && (!job_title || !job_company)) {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('title, company')
        .eq('id', job_id)
        .single()

      if (jobData) {
        finalJobTitle = finalJobTitle || jobData.title
        finalJobCompany = finalJobCompany || jobData.company
      }
    }

    // Insert the report
    const { data: report, error } = await supabase
      .from('user_reports')
      .insert({
        user_id: user.id,
        report_type: report_type as ReportType,
        title: title.trim(),
        description: description.trim(),
        job_id: job_id || null,
        job_title: finalJobTitle || null,
        job_company: finalJobCompany || null,
        page_url: page_url || null,
        browser_info: browser_info || null,
        status: 'open',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating report:', error)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        report,
        message: 'Report submitted successfully',
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in reports POST:', error)
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/reports
 * Get user's own reports (for future "My Reports" feature)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'reports-get')

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
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let query = supabase
      .from('user_reports')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('report_type', type)
    }

    const { data: reports, count, error } = await query

    if (error) {
      console.error('Error fetching reports:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    return NextResponse.json(
      {
        reports: reports || [],
        total: count || 0,
        pagination: {
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in reports GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}
