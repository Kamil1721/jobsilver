import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit"

export const dynamic = 'force-dynamic'

interface ExportJobSummary {
  title: string | null
  company: string | null
  location: string | null
  url: string | null
}

function toExportJobSummary(value: unknown): ExportJobSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const job = value as Record<string, unknown>
  return {
    title: typeof job.title === 'string' ? job.title : null,
    company: typeof job.company === 'string' ? job.company : null,
    location: typeof job.location === 'string' ? job.location : null,
    url: typeof job.url === 'string' ? job.url : null,
  }
}

/**
 * GET /api/account/export
 *
 * Allows users to download all their personal data (GDPR Article 20 - Data Portability)
 *
 * Security measures:
 * - User must be authenticated
 * - User can only export their OWN data (enforced by RLS)
 * - Rate limited to 1 export per hour to prevent abuse
 * - Excludes sensitive system fields (internal IDs, auth tokens, etc.)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - please log in to export your data" },
        { status: 401 }
      )
    }

    // Rate limiting - 1 export per hour to prevent abuse
    const rateLimit = checkRateLimit(
      user.id,
      { maxRequests: 1, windowSeconds: 3600, prefix: 'data-export' },
      'data-export'
    )

    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      const minutesRemaining = Math.ceil(retryAfter / 60)
      return NextResponse.json(
        {
          error: `You can only export your data once per hour. Please try again in ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}.`
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const userId = user.id

    // Fetch all user data in parallel
    const [
      profileResult,
      jobsResult,
      favoritesResult,
      chatMessagesResult,
      interactionsResult,
      preferencesResult,
    ] = await Promise.all([
      // Profile data
      supabase
        .from('profiles')
        .select('full_name, email, avatar_url, cv_url, cv_parsed_data, job_filters, screening_answers, notification_preferences, subscription_plan, created_at, updated_at')
        .eq('id', userId)
        .single(),

      // Saved jobs
      supabase
        .from('jobs')
        .select('title, company, location, description, url, salary, job_type, remote, status, match_score, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Favorited jobs (with job details)
      supabase
        .from('user_favorite_jobs')
        .select(`
          favorited_at,
          favorite_reason,
          jobs:job_id (
            title,
            company,
            location,
            url
          )
        `)
        .eq('user_id', userId),

      // AI chat messages
      supabase
        .from('job_chat_messages')
        .select(`
          role,
          content,
          created_at,
          jobs:job_id (
            title,
            company
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),

      // User interactions (for AI learning)
      supabase
        .from('user_interactions')
        .select('interaction_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100), // Limit to last 100 interactions

      // Learned preferences
      supabase
        .from('user_ai_preferences')
        .select('preferred_companies, preferred_locations, avoided_companies, confidence_level, preferred_industries, preferred_job_types, keyword_weights, updated_at')
        .eq('user_id', userId)
        .single(),
    ])

    // Fail closed on query errors: supabase-js resolves { data: null, error } without
    // throwing, and coercing failures to empty arrays would present a silently partial
    // export as complete (the export claims to contain ALL stored personal data, and the
    // hourly rate limit stops the user retrying). .single() 'no rows' (PGRST116) is a
    // legitimate empty state, not a failure.
    const queryErrors = [
      { name: 'profile', error: profileResult.error },
      { name: 'jobs', error: jobsResult.error },
      { name: 'favorites', error: favoritesResult.error },
      { name: 'chatMessages', error: chatMessagesResult.error },
      { name: 'interactions', error: interactionsResult.error },
      { name: 'preferences', error: preferencesResult.error },
    ].filter(q => q.error && q.error.code !== 'PGRST116')

    if (queryErrors.length > 0) {
      console.error('Account export failed:', queryErrors.map(q => `${q.name}: ${q.error?.message}`))
      // Refund the once-per-hour slot: this was a server-side failure, not a real
      // export, so the user must be able to retry immediately.
      resetRateLimit(user.id, { maxRequests: 1, windowSeconds: 3600, prefix: 'data-export' }, 'data-export')
      return NextResponse.json(
        { error: 'Could not gather all of your data for export. Please try again.' },
        { status: 500 }
      )
    }

    // Build the export object with user-friendly structure
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        userId: userId,
        email: user.email,
        dataRetentionNote: "This export contains all personal data we have stored about you.",
      },

      profile: profileResult.data ? {
        fullName: profileResult.data.full_name,
        email: profileResult.data.email,
        avatarUrl: profileResult.data.avatar_url,
        cvUrl: profileResult.data.cv_url,
        subscriptionPlan: profileResult.data.subscription_plan,
        accountCreated: profileResult.data.created_at,
        lastUpdated: profileResult.data.updated_at,
      } : null,

      cvData: profileResult.data?.cv_parsed_data ? {
        note: "This is the parsed content from your uploaded CV",
        ...profileResult.data.cv_parsed_data,
      } : null,

      jobPreferences: profileResult.data?.job_filters || null,

      screeningAnswers: profileResult.data?.screening_answers ? {
        note: "Your pre-filled application answers",
        ...profileResult.data.screening_answers,
      } : null,

      notificationPreferences: profileResult.data?.notification_preferences || null,

      savedJobs: {
        count: jobsResult.data?.length || 0,
        jobs: (jobsResult.data || []).map(job => ({
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          salary: job.salary,
          jobType: job.job_type,
          remote: job.remote,
          status: job.status,
          matchScore: job.match_score,
          savedAt: job.created_at,
        })),
      },

      favoritedJobs: {
        count: favoritesResult.data?.length || 0,
        favorites: (favoritesResult.data || []).map(fav => {
          const job = toExportJobSummary(fav.jobs)
          return {
            job,
            favoritedAt: fav.favorited_at,
            reason: fav.favorite_reason,
          }
        }),
      },

      aiChatHistory: {
        count: chatMessagesResult.data?.length || 0,
        messages: (chatMessagesResult.data || []).map(msg => {
          const job = toExportJobSummary(msg.jobs)
          return {
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at,
            relatedJob: job
              ? { title: job.title, company: job.company }
              : null,
          }
        }),
      },

      learnedPreferences: preferencesResult.data ? {
        note: "These preferences were learned from your activity to improve job recommendations",
        preferredCompanies: preferencesResult.data.preferred_companies,
        preferredLocations: preferencesResult.data.preferred_locations,
        preferredIndustries: preferencesResult.data.preferred_industries,
        preferredJobTypes: preferencesResult.data.preferred_job_types,
        avoidedCompanies: preferencesResult.data.avoided_companies,
        keywordWeights: preferencesResult.data.keyword_weights,
        confidenceLevel: preferencesResult.data.confidence_level,
        lastUpdated: preferencesResult.data.updated_at,
      } : null,

      recentInteractions: {
        note: "Your last 100 interactions (views, saves, discards) used for AI learning",
        count: interactionsResult.data?.length || 0,
        interactions: (interactionsResult.data || []).map(i => ({
          type: i.interaction_type,
          timestamp: i.created_at,
        })),
      },
    }

    // Return as downloadable JSON file
    const jsonString = JSON.stringify(exportData, null, 2)
    const filename = `jobsilver-data-export-${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })

  } catch (error) {
    console.error('Data export error:', error)
    return NextResponse.json(
      { error: "Failed to export data. Please try again later." },
      { status: 500 }
    )
  }
}
