import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// Strict schema for job_filters to prevent arbitrary data injection
const jobFiltersSchema = z.object({
  // Work Location (legacy - kept for backward compatibility)
  remote_jobs: z.boolean().optional(),
  remote_countries: z.array(z.string().max(100)).max(50).optional(),
  onsite_hybrid: z.boolean().optional(),
  onsite_locations: z.array(z.string().max(100)).max(50).optional(),

  // Granular Work Arrangements
  work_arrangements: z.array(z.enum(['on_site', 'hybrid', 'remote_ok', 'remote_only'])).max(4).optional(),

  // Job Types
  job_types: z.array(z.enum(['fulltime', 'part-time', 'contractor', 'internship'])).max(4).optional(),

  // Job Titles (up to 5)
  job_titles: z.array(z.string().max(100)).max(5).optional(),

  // Job Match
  match_threshold: z.enum(['high', 'higher', 'highest']).optional(),

  // Seniority
  seniority_levels: z.array(z.enum(['entry', 'associate', 'mid-senior', 'director'])).max(4).optional(),

  // Time Zones
  time_zones: z.array(z.string().max(50)).max(24).optional(),
  include_flexible_timezone: z.boolean().optional(),

  // Worldwide Remote
  include_worldwide_remote: z.boolean().optional(),

  // Industry
  industries: z.array(z.string().max(100)).max(20).optional(),

  // Language
  job_languages: z.array(z.string().max(50)).max(10).optional(),

  // Keywords
  include_keywords: z.array(z.string().max(100)).max(20).optional(),
  exclude_keywords: z.array(z.string().max(100)).max(20).optional(),

  // Companies to exclude
  exclude_companies: z.array(z.string().max(100)).max(100).optional(),

  // Salary
  salary_min: z.number().min(0).max(10000000).nullable().optional(),
  salary_max: z.number().min(0).max(10000000).nullable().optional(),
  salary_currency: z.string().max(10).optional(),

  // Company Size Preference
  company_size: z.array(z.enum(['startup', 'small', 'medium', 'large', 'enterprise'])).max(5).optional(),
}).strict() // Reject unknown fields in job_filters

// Zod schema for profile update validation
const profileUpdateSchema = z.object({
  full_name: z.string().max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  job_filters: jobFiltersSchema.optional().nullable(),
}).strict() // Reject unknown fields

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'profile-get')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Profile fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 400 })
    }

    return NextResponse.json(
      { profile: profile || null },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'profile-put')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const body = await request.json()

    // Validate input with Zod
    const validationResult = profileUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { full_name, phone, location, job_filters } = validationResult.data

    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name,
        phone,
        location,
        job_filters,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 400 })
    }

    return NextResponse.json(
      { profile },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
