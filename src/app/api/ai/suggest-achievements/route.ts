import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { sanitizeForPrompt } from '@/lib/security/validation'
import { canUseAI } from '@/lib/ai/usage-tracker'
import { openai } from '@/lib/ai/openai-client'

export const dynamic = 'force-dynamic'


// Input validation limits
const MAX_COMPANY_LENGTH = 200
const MAX_POSITION_LENGTH = 200
const MAX_JOB_TITLE_LENGTH = 200
const MAX_JOB_DESCRIPTION_LENGTH = 2000
const MAX_SKILLS = 30
const MAX_SKILL_LENGTH = 100

interface SuggestAchievementsRequest {
  company: string
  position: string
  jobTitle?: string
  jobDescription?: string
  skills?: string[]
}

// Use shared sanitization function
const sanitizeInput = (input: string, maxLength: number) => sanitizeForPrompt(input, maxLength)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check Pro subscription - AI features require Pro plan
    const aiAccessCheck = await canUseAI(user.id, supabase as unknown as Parameters<typeof canUseAI>[1])
    if (!aiAccessCheck.allowed) {
      return NextResponse.json(
        { error: aiAccessCheck.message || 'Pro subscription required for AI features' },
        { status: 403 }
      )
    }

    // Rate limiting for AI achievement suggestions (max 20 per hour)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 20, windowSeconds: 3600, prefix: 'ai-achieve' }, 'ai-achievements')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json() as SuggestAchievementsRequest
    const { company, position, jobTitle, jobDescription, skills } = body

    if (!company || !position) {
      return NextResponse.json(
        { error: 'Company and position are required' },
        { status: 400 }
      )
    }

    // Sanitize all user inputs to prevent prompt injection
    const safeCompany = sanitizeInput(company, MAX_COMPANY_LENGTH)
    const safePosition = sanitizeInput(position, MAX_POSITION_LENGTH)
    const safeJobTitle = jobTitle ? sanitizeInput(jobTitle, MAX_JOB_TITLE_LENGTH) : undefined
    const safeJobDescription = jobDescription ? sanitizeInput(jobDescription, MAX_JOB_DESCRIPTION_LENGTH) : undefined
    const safeSkills = skills
      ?.slice(0, MAX_SKILLS)
      .map(s => sanitizeInput(s, MAX_SKILL_LENGTH))
      .filter(Boolean)

    // Re-validate after sanitization
    if (!safeCompany || !safePosition) {
      return NextResponse.json(
        { error: 'Invalid company or position after sanitization' },
        { status: 400 }
      )
    }

    // Build context for AI
    const hasJobContext = safeJobTitle || safeJobDescription
    const skillsContext = safeSkills?.length ? `Relevant skills: ${safeSkills.join(', ')}` : ''

    const prompt = hasJobContext
      ? `Generate 3-4 professional achievement bullet points for someone who worked as "${safePosition}" at "${safeCompany}".

Target job they're applying for: ${safeJobTitle || 'Not specified'}
${safeJobDescription ? `Job description highlights:\n${safeJobDescription}` : ''}
${skillsContext}

Create achievement bullets that:
1. Start with strong action verbs
2. Include specific metrics or quantifiable results where realistic
3. Highlight transferable skills relevant to the target job
4. Sound authentic and professional

Return ONLY a JSON array of 3-4 achievement strings, nothing else.
Example: ["Led team of 5 engineers to deliver project 2 weeks early", "Reduced deployment time by 40% through CI/CD automation"]`
      : `Generate 3-4 professional achievement bullet points for someone who worked as "${safePosition}" at "${safeCompany}".
${skillsContext}

Create achievement bullets that:
1. Start with strong action verbs
2. Include specific metrics or quantifiable results where realistic
3. Sound authentic and professional
4. Cover different aspects (leadership, efficiency, innovation, collaboration)

Return ONLY a JSON array of 3-4 achievement strings, nothing else.
Example: ["Led team of 5 engineers to deliver project 2 weeks early", "Reduced deployment time by 40% through CI/CD automation"]`

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional resume writer helping craft compelling achievement statements. Return only valid JSON arrays of achievement strings. Do not include any explanations or markdown formatting.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 500,
      }, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const content = completion.choices[0]?.message?.content?.trim() || '[]'

      // Parse the JSON response
      let achievements: string[] = []
      try {
        // Handle potential markdown code blocks
        const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim()
        achievements = JSON.parse(jsonContent)

        // Ensure we have an array of strings
        if (!Array.isArray(achievements)) {
          achievements = []
        }
        achievements = achievements
          .filter(a => typeof a === 'string' && a.length > 0)
          .map(a => a.slice(0, 500)) // Limit individual achievement length
      } catch {
        console.error('Failed to parse AI response:', content)
        achievements = []
      }

      return NextResponse.json({
        success: true,
        achievements: achievements.slice(0, 5),
      })
    } catch (aiError) {
      clearTimeout(timeoutId)
      if (aiError instanceof Error && aiError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. Please try again.' },
          { status: 504 }
        )
      }
      throw aiError
    }

  } catch (error) {
    console.error('AI achievement suggestion error:', error)
    return NextResponse.json(
      { error: 'Failed to generate achievement suggestions' },
      { status: 500 }
    )
  }
}
