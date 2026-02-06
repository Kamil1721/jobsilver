import type { SupabaseClient } from '@supabase/supabase-js'
import type { Job, Profile, SavedAnswer, SubscriptionPlan } from '@/lib/supabase/types'
import OpenAI from 'openai'
import { canAccessFeature } from '@/lib/features/config'
import { canUseAI, incrementUsage } from '@/lib/ai/usage-tracker'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Tool definitions for OpenAI
export const chatTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_user_jobs',
      description: 'Get a list of jobs the user has saved or applied to',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['discovered', 'saved', 'applied', 'interviewing', 'offer', 'discarded'],
            description: 'Filter by job status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of jobs to return (default 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_job_details',
      description: 'Get full details for a specific job by ID',
      parameters: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'The job ID to fetch details for',
          },
        },
        required: ['job_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: 'Get the user profile including CV data and preferences',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_answer',
      description: 'Generate a tailored answer for a job application question',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The application question to answer',
          },
          job_title: {
            type: 'string',
            description: 'The job title for context',
          },
          job_company: {
            type: 'string',
            description: 'The company name for context',
          },
          max_length: {
            type: 'number',
            description: 'Maximum character length for the answer (default 500)',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_cover_letter',
      description: 'Generate a personalized cover letter for a job',
      parameters: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'The job ID to generate a cover letter for',
          },
          tone: {
            type: 'string',
            enum: ['professional', 'friendly', 'enthusiastic'],
            description: 'The tone of the cover letter (default professional)',
          },
        },
        required: ['job_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tailor_cv_suggestions',
      description: 'Get suggestions for tailoring the CV to a specific job',
      parameters: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'The job ID to tailor the CV for',
          },
        },
        required: ['job_id'],
      },
    },
  },
  // NOTE: fill_answer_field and fill_multiple_answers tools removed
  // The AI should provide text answers that users can copy/paste
  {
    type: 'function',
    function: {
      name: 'report_bug',
      description: 'Report a bug or issue the user encountered. Collects details and submits to admin for review.',
      parameters: {
        type: 'object',
        properties: {
          report_type: {
            type: 'string',
            enum: ['bug', 'incorrect_questions', 'incorrect_description', 'suggestion', 'other'],
            description: 'Type of report',
          },
          title: {
            type: 'string',
            description: 'Short summary of the issue (under 100 chars)',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the issue',
          },
          job_id: {
            type: 'string',
            description: 'Related job ID if applicable',
          },
        },
        required: ['report_type', 'title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attach_cover_letter',
      description: 'Generate a cover letter and attach it to a file upload field in the application form. Use this when the user wants to attach a cover letter to a job application that has a cover letter upload field.',
      parameters: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'The job ID to generate a cover letter for',
          },
          question_id: {
            type: 'string',
            description: 'The file upload question ID to attach the cover letter to',
          },
          tone: {
            type: 'string',
            enum: ['professional', 'friendly', 'enthusiastic'],
            description: 'The tone of the cover letter (default professional)',
          },
        },
        required: ['job_id', 'question_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_preferences',
      description: "Get the user's learned job preferences including industries they like, salary expectations, remote work preference, and keywords they respond to positively or negatively. Use this to personalize recommendations and advice.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
]

// Tool handlers
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  switch (toolName) {
    case 'get_user_jobs':
      return handleGetUserJobs(supabase, userId, args)
    case 'get_job_details':
      return handleGetJobDetails(supabase, userId, args)
    case 'get_user_profile':
      return handleGetUserProfile(supabase, userId)
    case 'generate_answer':
      return handleGenerateAnswer(supabase, userId, args)
    case 'generate_cover_letter':
      return handleGenerateCoverLetter(supabase, userId, args)
    case 'tailor_cv_suggestions':
      return handleTailorCVSuggestions(supabase, userId, args)
    // fill_answer_field and fill_multiple_answers removed - AI provides text answers
    case 'report_bug':
      return handleReportBug(supabase, userId, args)
    case 'attach_cover_letter':
      return handleAttachCoverLetter(supabase, userId, args)
    case 'get_user_preferences':
      return handleGetUserPreferences(supabase, userId)
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}

async function handleGetUserJobs(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<string> {
  const status = args.status as string | undefined
  const limit = (args.limit as number) || 10

  let query = supabase
    .from('jobs')
    .select('id, title, company, location, status, match_score, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: jobs, error } = await query

  if (error) {
    console.error('Error fetching user jobs:', error)
    return JSON.stringify({ error: 'Failed to fetch jobs' })
  }

  return JSON.stringify({
    jobs: jobs?.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      status: job.status,
      matchScore: job.match_score,
    })),
    total: jobs?.length || 0,
  })
}

async function handleGetJobDetails(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<string> {
  const jobId = args.job_id as string

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (error || !job) {
    if (error) console.error('Error fetching job details:', error)
    return JSON.stringify({ error: 'Job not found or access denied' })
  }

  return JSON.stringify({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description?.slice(0, 2000),
    salaryMin: job.salary_min,
    salaryMax: job.salary_max,
    salaryCurrency: job.salary_currency,
    remote: job.remote,
    remoteType: job.remote_type,
    status: job.status,
    matchScore: job.match_score,
    applicationUrl: job.application_url,
  })
}

async function handleGetUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    if (error) console.error('Error fetching user profile:', error)
    return JSON.stringify({ error: 'Profile not found' })
  }

  const cvData = profile.cv_parsed_data as Record<string, unknown> | null
  const screeningAnswers = profile.screening_answers as Record<string, unknown> | null
  const jobFilters = profile.job_filters as Record<string, unknown> | null

  // Build phone from country code + number or fallback to profile.phone
  const phone = screeningAnswers?.phone_country_code && screeningAnswers?.phone_number
    ? `${screeningAnswers.phone_country_code} ${screeningAnswers.phone_number}`
    : profile.phone || null

  // Build detailed location
  const detailedLocation = screeningAnswers?.city || screeningAnswers?.country
    ? [
        screeningAnswers.city,
        screeningAnswers.state_region,
        screeningAnswers.country,
        screeningAnswers.postcode
      ].filter(Boolean).join(', ')
    : profile.location

  return JSON.stringify({
    // Basic info
    name: profile.full_name,
    email: profile.email,
    phone: phone,
    location: detailedLocation,
    linkedinUrl: screeningAnswers?.linkedin_url,

    // Professional info
    currentTitle: screeningAnswers?.current_job_title,
    experienceSummary: screeningAnswers?.experience_summary,
    skills: cvData?.skills || [],
    expectedSalary: screeningAnswers?.expected_salary,
    currentSalary: screeningAnswers?.current_salary,
    salaryCurrency: screeningAnswers?.salary_currency,
    availability: screeningAnswers?.availability,
    languages: screeningAnswers?.spoken_languages,

    // Work authorization
    workAuthorizationCountries: screeningAnswers?.work_authorization_countries,
    requiresVisaSponsorship: screeningAnswers?.requires_visa_sponsorship,
    nationalities: screeningAnswers?.nationalities,

    // Mobility
    openToTravel: screeningAnswers?.open_to_travel,
    openToRelocation: screeningAnswers?.open_to_relocation,
    drivingLicense: screeningAnswers?.driving_license,
    securityClearance: screeningAnswers?.security_clearance,

    // Job preferences (from filters)
    jobPreferences: jobFilters ? {
      targetRoles: jobFilters.job_titles,
      industries: jobFilters.industries,
      jobTypes: jobFilters.job_types,
      workArrangements: jobFilters.work_arrangements,
      companySize: jobFilters.company_size,
      seniorityLevels: jobFilters.seniority_levels,
      targetCountries: jobFilters.remote_countries,
      salaryRange: {
        min: jobFilters.salary_min,
        max: jobFilters.salary_max,
        currency: jobFilters.salary_currency,
      },
    } : null,

    // CV data
    education: cvData?.education || [],
    experience: cvData?.experience || [],
  })
}

async function handleGenerateAnswer(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<string> {
  const question = args.question as string
  const jobTitle = args.job_title as string | undefined
  const jobCompany = args.job_company as string | undefined
  const maxLength = (args.max_length as number) || 500

  // Fetch user profile for context
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const cvData = profile?.cv_parsed_data as Record<string, unknown> | null
  const screeningAnswers = profile?.screening_answers as Record<string, unknown> | null

  // Fetch saved answers for reference
  const { data: savedAnswers } = await supabase
    .from('saved_answers')
    .select('question_text, answer_text')
    .eq('user_id', userId)
    .limit(10)

  const prompt = `Generate a professional answer for this job application question.

Question: ${question}
${jobTitle ? `Job Title: ${jobTitle}` : ''}
${jobCompany ? `Company: ${jobCompany}` : ''}

Candidate Info:
- Name: ${profile?.full_name || 'Not provided'}
- Current Role: ${screeningAnswers?.current_job_title || 'Not provided'}
- Experience: ${screeningAnswers?.experience_summary || 'Not provided'}
- Skills: ${(cvData?.skills as string[])?.join(', ') || 'Not provided'}

${savedAnswers && savedAnswers.length > 0 ? `
Reference answers the candidate has used before:
${savedAnswers.map(sa => `Q: ${sa.question_text}\nA: ${sa.answer_text}`).join('\n\n')}
` : ''}

Write a concise, professional answer (max ${maxLength} characters) that:
1. Directly addresses the question
2. Highlights relevant skills and experience
3. Sounds natural and authentic
4. Is tailored to the specific role/company if provided

Return ONLY the answer text, no quotes or explanation.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: Math.ceil(maxLength / 3),
    })

    const answer = response.choices[0]?.message?.content || ''
    return JSON.stringify({ answer: answer.slice(0, maxLength) })
  } catch (error) {
    console.error('Error generating answer:', error)
    return JSON.stringify({ error: 'Failed to generate answer' })
  }
}

async function handleGenerateCoverLetter(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<string> {
  const jobId = args.job_id as string
  const tone = (args.tone as string) || 'professional'

  // Check plan access for AI cover letters
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('subscription_plan, is_tester')
    .eq('id', userId)
    .single()

  const userPlan = (userProfile?.subscription_plan || 'free') as SubscriptionPlan
  const isTester = userProfile?.is_tester || false
  if (!canAccessFeature(userPlan, 'ai_cover_letters', isTester)) {
    return JSON.stringify({
      error: 'UPGRADE_REQUIRED',
      requiredPlan: 'pro',
      message: 'AI cover letters require a Pro plan or higher. Upgrade to unlock this feature.',
    })
  }

  // Check daily cover letter quota
  const coverLetterCheck = await canUseAI(userId, supabase as never, 'cover_letters')
  if (!coverLetterCheck.allowed) {
    return JSON.stringify({
      error: 'QUOTA_EXCEEDED',
      message: coverLetterCheck.message || 'Daily cover letter limit reached.',
      suggestUpgrade: coverLetterCheck.suggestUpgrade,
    })
  }

  // Fetch job details
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (!job) {
    return JSON.stringify({ error: 'Job not found' })
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const cvData = profile?.cv_parsed_data as Record<string, unknown> | null
  const screeningAnswers = profile?.screening_answers as Record<string, unknown> | null

  const toneInstructions: Record<string, string> = {
    professional: 'Use a professional, formal tone. Be concise and focused.',
    friendly: 'Use a warm, personable tone while remaining professional.',
    enthusiastic: 'Show genuine excitement for the role while staying professional.',
  }

  const candidateName = profile?.full_name || 'the candidate'

  const prompt = `Generate a cover letter. Output ONLY the letter content, nothing else.

STRICT FORMAT - FOLLOW EXACTLY:
- First line MUST be: Dear Hiring Manager,
- Body: 3-4 paragraphs (250-350 words)
- Last two lines MUST be:
Kind Regards,
${candidateName}

FORBIDDEN - DO NOT INCLUDE:
- NO addresses (yours or company's)
- NO phone numbers or emails
- NO date or [Date] placeholder
- NO "---" dividers
- NO introductory text like "Here's a cover letter..."
- NO closing commentary like "Feel free to adjust..."

JOB: ${job.title} at ${job.company || 'the company'}
DESCRIPTION: ${job.description?.slice(0, 1000) || 'Not provided'}

CANDIDATE: ${candidateName}
ROLE: ${screeningAnswers?.current_job_title || 'Not provided'}
EXPERIENCE: ${screeningAnswers?.experience_summary || 'Not provided'}
SKILLS: ${(cvData?.skills as string[])?.join(', ') || 'Not provided'}

TONE: ${toneInstructions[tone]}

Write a compelling letter that connects the candidate's experience to the job requirements. Start with "Dear Hiring Manager," and end with "Kind Regards," followed by the name.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a cover letter generator. Output ONLY the cover letter text. No commentary, no explanations, no formatting marks. Start with "Dear Hiring Manager," and end with "Kind Regards," followed by the name.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const coverLetter = response.choices[0]?.message?.content || ''

    // Increment cover letter usage after successful generation
    await incrementUsage(userId, 'cover_letters', supabase as never)

    return JSON.stringify({ coverLetter, jobTitle: job.title, company: job.company })
  } catch (error) {
    console.error('Error generating cover letter:', error)
    return JSON.stringify({ error: 'Failed to generate cover letter' })
  }
}

async function handleTailorCVSuggestions(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<string> {
  const jobId = args.job_id as string

  // Fetch job details
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (!job) {
    return JSON.stringify({ error: 'Job not found' })
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const cvData = profile?.cv_parsed_data as Record<string, unknown> | null

  const prompt = `Analyze this job posting and provide CV tailoring suggestions.

Job Details:
- Title: ${job.title}
- Company: ${job.company || 'Not specified'}
- Description: ${job.description?.slice(0, 2000) || 'Not provided'}

Current CV Data:
- Skills: ${(cvData?.skills as string[])?.join(', ') || 'Not provided'}
- Experience: ${JSON.stringify((cvData?.experience as unknown[]) || [])}
- Education: ${JSON.stringify((cvData?.education as unknown[]) || [])}

Provide 4-6 specific, actionable suggestions for tailoring the CV:
1. Which skills to emphasize or add
2. How to reframe experience
3. Keywords to include
4. Any gaps to address

Format as a JSON array:
{
  "suggestions": [
    { "category": "Skills", "suggestion": "...", "priority": "high|medium|low" }
  ]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    })

    const result = response.choices[0]?.message?.content || '{}'
    return result
  } catch (error) {
    console.error('Error generating CV suggestions:', error)
    return JSON.stringify({ error: 'Failed to generate suggestions' })
  }
}

// handleFillAnswerField and handleFillMultipleAnswers removed
// AI now provides text answers that users copy/paste

async function handleReportBug(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<string> {
  const reportType = args.report_type as string
  const title = args.title as string
  const description = args.description as string
  const jobId = args.job_id as string | undefined

  // Get job details if jobId provided
  let jobTitle = null
  let jobCompany = null
  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('title, company')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single()
    if (job) {
      jobTitle = job.title
      jobCompany = job.company
    }
  }

  const { data, error } = await supabase
    .from('user_reports')
    .insert({
      user_id: userId,
      report_type: reportType,
      title: title.slice(0, 100),
      description,
      job_id: jobId || null,
      job_title: jobTitle,
      job_company: jobCompany,
      page_url: 'Reported via AI Chat',
      browser_info: 'AI Chat Assistant',
      status: 'open',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating report:', error)
    return JSON.stringify({ error: 'Failed to submit report' })
  }

  return JSON.stringify({
    success: true,
    reportId: data.id,
    message: 'Report submitted successfully',
  })
}

async function handleAttachCoverLetter(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<string> {
  const jobId = args.job_id as string
  const questionId = args.question_id as string
  const tone = (args.tone as string) || 'professional'

  // Check plan access for AI cover letters
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('subscription_plan, is_tester')
    .eq('id', userId)
    .single()

  const userPlan = (userProfile?.subscription_plan || 'free') as SubscriptionPlan
  const isTester = userProfile?.is_tester || false
  if (!canAccessFeature(userPlan, 'ai_cover_letters', isTester)) {
    return JSON.stringify({
      error: 'UPGRADE_REQUIRED',
      requiredPlan: 'pro',
      message: 'AI cover letters require a Pro plan or higher. Upgrade to unlock this feature.',
    })
  }

  // Check daily cover letter quota
  const coverLetterCheck = await canUseAI(userId, supabase as never, 'cover_letters')
  if (!coverLetterCheck.allowed) {
    return JSON.stringify({
      error: 'QUOTA_EXCEEDED',
      message: coverLetterCheck.message || 'Daily cover letter limit reached.',
      suggestUpgrade: coverLetterCheck.suggestUpgrade,
    })
  }

  // Fetch job details
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (!job) {
    return JSON.stringify({ error: 'Job not found' })
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const cvData = profile?.cv_parsed_data as Record<string, unknown> | null
  const screeningAnswers = profile?.screening_answers as Record<string, unknown> | null
  const candidateName = profile?.full_name || 'the candidate'

  const toneInstructions: Record<string, string> = {
    professional: 'Use a professional, formal tone. Be concise and focused.',
    friendly: 'Use a warm, personable tone while remaining professional.',
    enthusiastic: 'Show genuine excitement for the role while staying professional.',
  }

  const prompt = `Generate a cover letter. Output ONLY the letter content, nothing else.

STRICT FORMAT - FOLLOW EXACTLY:
- First line MUST be: Dear Hiring Manager,
- Body: 3-4 paragraphs (250-350 words)
- Last two lines MUST be:
Kind Regards,
${candidateName}

FORBIDDEN - DO NOT INCLUDE:
- NO addresses (yours or company's)
- NO phone numbers or emails
- NO date or [Date] placeholder
- NO "---" dividers
- NO introductory text like "Here's a cover letter..."
- NO closing commentary like "Feel free to adjust..."

JOB: ${job.title} at ${job.company || 'the company'}
DESCRIPTION: ${job.description?.slice(0, 1000) || 'Not provided'}

CANDIDATE: ${candidateName}
ROLE: ${screeningAnswers?.current_job_title || 'Not provided'}
EXPERIENCE: ${screeningAnswers?.experience_summary || 'Not provided'}
SKILLS: ${(cvData?.skills as string[])?.join(', ') || 'Not provided'}

TONE: ${toneInstructions[tone]}

Write a compelling letter that connects the candidate's experience to the job requirements. Start with "Dear Hiring Manager," and end with "Kind Regards," followed by the name.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a cover letter generator. Output ONLY the cover letter text. No commentary, no explanations, no formatting marks. Start with "Dear Hiring Manager," and end with "Kind Regards," followed by the name.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const coverLetterContent = response.choices[0]?.message?.content || ''

    // Increment cover letter usage after successful generation
    await incrementUsage(userId, 'cover_letters', supabase as never)

    // Return the content for file attachment
    return JSON.stringify({
      action: 'attach_file',
      questionId,
      fileName: `Cover_Letter_${job.company?.replace(/[^a-zA-Z0-9]/g, '_') || 'Application'}.txt`,
      content: coverLetterContent,
      mimeType: 'text/plain',
      jobTitle: job.title,
      company: job.company,
    })
  } catch (error) {
    console.error('Error generating cover letter:', error)
    return JSON.stringify({ error: 'Failed to generate cover letter' })
  }
}

async function handleGetUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // Check plan access for AI learning
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('subscription_plan, is_tester')
    .eq('id', userId)
    .single()

  const userPlan = (userProfile?.subscription_plan || 'free') as SubscriptionPlan
  const isTester = userProfile?.is_tester || false
  if (!canAccessFeature(userPlan, 'ai_learning', isTester)) {
    return JSON.stringify({
      error: 'UPGRADE_REQUIRED',
      requiredPlan: 'pro',
      message: 'AI learning features require a Pro plan or higher. Upgrade to unlock personalized job recommendations.',
    })
  }

  // Fetch learned preferences
  const { data: preferences, error } = await supabase
    .from('user_ai_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !preferences) {
    return JSON.stringify({
      hasPreferences: false,
      message: 'No learned preferences yet. Keep saving and favoriting jobs to help the AI learn your preferences.',
    })
  }

  // Helper to get keys from JSONB object
  const getKeys = (obj: unknown): string[] => {
    if (!obj || typeof obj !== 'object') return []
    return Object.keys(obj as Record<string, unknown>)
  }

  // Extract remote preference score from JSONB
  const remotePrefs = preferences.remote_preference as { preference_score?: number } | null
  const remoteScore = remotePrefs?.preference_score ?? 0.5

  // Format for chat response
  return JSON.stringify({
    hasPreferences: true,
    confidence: preferences.confidence_level,
    preferences: {
      industries: getKeys(preferences.preferred_industries),
      salary: {
        min: preferences.preferred_salary_min,
        max: preferences.preferred_salary_max,
      },
      remote: {
        preference: remoteScore,
        description: remoteScore > 0.7
          ? 'Strongly prefers remote'
          : remoteScore > 0.5
            ? 'Prefers remote'
            : remoteScore < 0.3
              ? 'Strongly prefers onsite'
              : 'Prefers onsite/hybrid',
      },
      companies: {
        preferred: getKeys(preferences.preferred_companies),
        avoided: preferences.avoided_companies || [],
      },
      keywords: {
        positive: Object.entries(preferences.keyword_weights || {})
          .filter(([_, v]) => (v as number) > 0)
          .map(([k]) => k)
          .slice(0, 10),
        negative: Object.entries(preferences.keyword_weights || {})
          .filter(([_, v]) => (v as number) < 0)
          .map(([k]) => k)
          .slice(0, 10),
      },
    },
    stats: {
      interactionCount: preferences.total_interactions,
      favoriteCount: preferences.total_favorites,
      lastComputed: preferences.last_computed_at,
    },
  })
}
