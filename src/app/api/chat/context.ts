import type { Profile, Job } from '@/lib/supabase/types'
import type { SupabaseClient } from '@supabase/supabase-js'

interface CVData {
  skills: string[]
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }[]
  summary: string
}

interface UserContext {
  profile: Profile | null
  cvData: CVData | null
  recentJobs: Job[]
}

/**
 * Build user context for the chat assistant
 */
export async function buildUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserContext> {
  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // Parse CV data from profile
  let cvData: CVData | null = null
  if (profile?.cv_parsed_data) {
    const parsed = profile.cv_parsed_data as Record<string, unknown>
    cvData = {
      skills: (parsed.skills as string[]) || [],
      experience: (parsed.experience as CVData['experience']) || [],
      education: (parsed.education as CVData['education']) || [],
      summary: (parsed.summary as string) || '',
    }
  }

  // Fetch recent jobs
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    profile,
    cvData,
    recentJobs: recentJobs || [],
  }
}

/**
 * Build job context for the chat assistant
 * @param supabase - Supabase client
 * @param jobId - Job ID to fetch
 * @param userId - User ID for authorization check
 */
export async function buildJobContext(
  supabase: SupabaseClient,
  jobId: string,
  userId: string
): Promise<Job | null> {
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId) // SECURITY: Ensure user owns this job
    .single()

  return job
}

/**
 * Format user context as a system message
 */
export function formatUserContextForPrompt(context: UserContext): string {
  const { profile, cvData, recentJobs } = context
  const screeningAnswers = profile?.screening_answers as Record<string, unknown> | null
  const jobFilters = profile?.job_filters as Record<string, unknown> | null

  const parts: string[] = []

  // === USER PROFILE ===
  parts.push(`## User Profile`)
  if (profile?.full_name) parts.push(`Name: ${profile.full_name}`)
  if (profile?.email) parts.push(`Email: ${profile.email}`)

  // Phone (combine country code + number from screening, or fallback to profile.phone)
  const phone = screeningAnswers?.phone_country_code && screeningAnswers?.phone_number
    ? `${screeningAnswers.phone_country_code} ${screeningAnswers.phone_number}`
    : profile?.phone || null
  if (phone) parts.push(`Phone: ${phone}`)

  // Location details (prefer detailed screening answers, fallback to profile.location)
  if (screeningAnswers?.city || screeningAnswers?.country) {
    const location = [
      screeningAnswers.city,
      screeningAnswers.state_region,
      screeningAnswers.country,
      screeningAnswers.postcode
    ].filter(Boolean).join(', ')
    parts.push(`Location: ${location}`)
  } else if (profile?.location) {
    parts.push(`Location: ${profile.location}`)
  }

  if (screeningAnswers?.linkedin_url) {
    parts.push(`LinkedIn: ${screeningAnswers.linkedin_url}`)
  }

  // === PROFESSIONAL INFO ===
  parts.push(`\n## Professional Info`)
  if (screeningAnswers?.current_job_title) {
    parts.push(`Current Role: ${screeningAnswers.current_job_title}`)
  }
  if (screeningAnswers?.experience_summary) {
    parts.push(`Experience Summary: ${screeningAnswers.experience_summary}`)
  }

  // Salary (expected and current)
  if (screeningAnswers?.expected_salary) {
    const currency = screeningAnswers.salary_currency || ''
    parts.push(`Expected Salary: ${currency} ${screeningAnswers.expected_salary}`)
  }
  if (screeningAnswers?.current_salary) {
    const currency = screeningAnswers.salary_currency || ''
    parts.push(`Current Salary: ${currency} ${screeningAnswers.current_salary}`)
  }

  if (screeningAnswers?.availability) {
    parts.push(`Availability: ${screeningAnswers.availability}`)
  }

  if (screeningAnswers?.spoken_languages) {
    parts.push(`Languages: ${(screeningAnswers.spoken_languages as string[]).join(', ')}`)
  }

  // === WORK AUTHORIZATION ===
  parts.push(`\n## Work Authorization`)
  if (screeningAnswers?.work_authorization_countries) {
    parts.push(`Authorized to work in: ${(screeningAnswers.work_authorization_countries as string[]).join(', ')}`)
  }
  if (screeningAnswers?.requires_visa_sponsorship !== undefined) {
    parts.push(`Requires Visa Sponsorship: ${screeningAnswers.requires_visa_sponsorship ? 'Yes' : 'No'}`)
  }
  if (screeningAnswers?.nationalities) {
    parts.push(`Nationalities: ${(screeningAnswers.nationalities as string[]).join(', ')}`)
  }

  // === MOBILITY ===
  parts.push(`\n## Mobility`)
  if (screeningAnswers?.open_to_travel !== undefined) {
    parts.push(`Open to Travel: ${screeningAnswers.open_to_travel ? 'Yes' : 'No'}`)
  }
  if (screeningAnswers?.open_to_relocation !== undefined) {
    parts.push(`Open to Relocation: ${screeningAnswers.open_to_relocation ? 'Yes' : 'No'}`)
  }
  if (screeningAnswers?.driving_license) {
    parts.push(`Driving License: ${screeningAnswers.driving_license}`)
  }
  if (screeningAnswers?.security_clearance) {
    parts.push(`Security Clearance: ${screeningAnswers.security_clearance}`)
  }

  // === JOB PREFERENCES ===
  if (jobFilters) {
    parts.push(`\n## Job Preferences`)
    if (jobFilters.job_titles) {
      parts.push(`Target Roles: ${(jobFilters.job_titles as string[]).join(', ')}`)
    }
    if (jobFilters.industries) {
      parts.push(`Industries: ${(jobFilters.industries as string[]).join(', ')}`)
    }
    if (jobFilters.job_types) {
      parts.push(`Job Types: ${(jobFilters.job_types as string[]).join(', ')}`)
    }
    if (jobFilters.work_arrangements) {
      parts.push(`Work Arrangement: ${(jobFilters.work_arrangements as string[]).join(', ')}`)
    }
    if (jobFilters.company_size) {
      parts.push(`Company Size: ${(jobFilters.company_size as string[]).join(', ')}`)
    }
    if (jobFilters.seniority_levels) {
      parts.push(`Seniority: ${(jobFilters.seniority_levels as string[]).join(', ')}`)
    }
    if (jobFilters.remote_countries) {
      parts.push(`Target Countries: ${(jobFilters.remote_countries as string[]).join(', ')}`)
    }
    if (jobFilters.salary_min || jobFilters.salary_max) {
      const currency = (jobFilters.salary_currency as string) || ''
      const salaryStr = jobFilters.salary_min && jobFilters.salary_max
        ? `${currency} ${jobFilters.salary_min} - ${jobFilters.salary_max}`
        : jobFilters.salary_min
          ? `${currency} ${jobFilters.salary_min}+`
          : `up to ${currency} ${jobFilters.salary_max}`
      parts.push(`Salary Range: ${salaryStr.trim()}`)
    }
  }

  // === CV DATA ===
  if (cvData) {
    if (cvData.skills.length > 0) {
      parts.push(`\n## Skills`)
      parts.push(cvData.skills.join(', '))
    }

    if (cvData.experience.length > 0) {
      parts.push(`\n## Work Experience`)
      cvData.experience.forEach((exp) => {
        parts.push(`- ${exp.title} at ${exp.company} (${exp.duration})`)
        if (exp.description) {
          parts.push(`  ${exp.description.slice(0, 200)}...`)
        }
      })
    }

    if (cvData.education.length > 0) {
      parts.push(`\n## Education`)
      cvData.education.forEach((edu) => {
        parts.push(`- ${edu.degree} from ${edu.institution}${edu.year ? ` (${edu.year})` : ''}`)
      })
    }
  }

  // === RECENT JOBS ===
  if (recentJobs.length > 0) {
    parts.push(`\n## Recent Jobs (${recentJobs.length} tracked)`)
    const statusCounts: Record<string, number> = {}
    recentJobs.forEach((job) => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1
    })
    Object.entries(statusCounts).forEach(([status, count]) => {
      parts.push(`- ${status}: ${count}`)
    })
  }

  return parts.join('\n')
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')  // Replace HTML tags with spaces
    .replace(/&nbsp;/g, ' ')   // Replace &nbsp; with spaces
    .replace(/&amp;/g, '&')    // Replace &amp; with &
    .replace(/&lt;/g, '<')     // Replace &lt; with <
    .replace(/&gt;/g, '>')     // Replace &gt; with >
    .replace(/&quot;/g, '"')   // Replace &quot; with "
    .replace(/&#39;/g, "'")    // Replace &#39; with '
    .replace(/\s+/g, ' ')      // Collapse multiple spaces
    .trim()
}

/**
 * Format job context for prompt
 */
export function formatJobContextForPrompt(job: Job): string {
  const parts: string[] = [
    `## Current Job Context`,
    `IMPORTANT: You have full access to this job's details. Use this information to answer questions.`,
    ``,
    `**Title:** ${job.title}`,
    `**Company:** ${job.company || 'Unknown'}`,
    `**Location:** ${job.location || 'Not specified'}`,
  ]

  if (job.salary_min || job.salary_max) {
    const salary = job.salary_min && job.salary_max
      ? `${job.salary_currency || ''} ${job.salary_min} - ${job.salary_max}`
      : `${job.salary_currency || ''} ${job.salary_min || job.salary_max}`
    parts.push(`**Salary:** ${salary}`)
  }

  if (job.remote) {
    parts.push(`**Remote:** ${job.remote_type || 'Yes'}`)
  }

  if (job.description) {
    // Strip HTML and truncate long descriptions
    const cleanDesc = stripHtml(job.description)
    const desc = cleanDesc.slice(0, 3000)
    parts.push(``)
    parts.push(`**Full Job Description:**`)
    parts.push(desc + (cleanDesc.length > 3000 ? '...' : ''))
  }

  if (job.match_score) {
    parts.push(``)
    parts.push(`**Match Score:** ${job.match_score}%`)
  }

  return parts.join('\n')
}
