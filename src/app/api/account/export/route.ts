import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const dynamic = 'force-dynamic'

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
        .from('user_preferences')
        .select('preferred_titles, preferred_companies, preferred_locations, preferred_skills, avoided_companies, confidence_level, updated_at')
        .eq('user_id', userId)
        .single(),
    ])

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
        favorites: (favoritesResult.data || []).map(fav => ({
          job: fav.jobs ? {
            title: (fav.jobs as any).title,
            company: (fav.jobs as any).company,
            location: (fav.jobs as any).location,
            url: (fav.jobs as any).url,
          } : null,
          favoritedAt: fav.favorited_at,
          reason: fav.favorite_reason,
        })),
      },

      aiChatHistory: {
        count: chatMessagesResult.data?.length || 0,
        messages: (chatMessagesResult.data || []).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at,
          relatedJob: msg.jobs ? {
            title: (msg.jobs as any).title,
            company: (msg.jobs as any).company,
          } : null,
        })),
      },

      learnedPreferences: preferencesResult.data ? {
        note: "These preferences were learned from your activity to improve job recommendations",
        preferredTitles: preferencesResult.data.preferred_titles,
        preferredCompanies: preferencesResult.data.preferred_companies,
        preferredLocations: preferencesResult.data.preferred_locations,
        preferredSkills: preferencesResult.data.preferred_skills,
        avoidedCompanies: preferencesResult.data.avoided_companies,
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
