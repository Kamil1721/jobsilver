import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { sanitizeForPrompt } from '@/lib/security/validation'
import { canUseAI } from '@/lib/ai/usage-tracker'
import { openai } from '@/lib/ai/openai-client'

export const dynamic = 'force-dynamic'


// Input validation limits
const MAX_WORK_HISTORY = 10
const MAX_EDUCATION = 5
const MAX_JOB_TITLES = 5
const MAX_EXISTING_SKILLS = 50
const MAX_STRING_LENGTH = 200
const MAX_HIGHLIGHT_LENGTH = 300

interface SuggestSkillsRequest {
  workHistory?: {
    company: string
    position: string
    highlights?: string[]
  }[]
  education?: {
    institution: string
    degree: string
    area: string
  }[]
  jobTitles?: string[]
  existingSkills?: string[]
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

    // Rate limiting for AI skills suggestions (max 20 per hour)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 20, windowSeconds: 3600, prefix: 'ai-skills' }, 'ai-skills')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json() as SuggestSkillsRequest
    const { workHistory, education, jobTitles, existingSkills } = body

    // Sanitize and limit work history
    const safeWorkHistory = (workHistory || [])
      .slice(0, MAX_WORK_HISTORY)
      .map(w => ({
        company: sanitizeInput(w.company, MAX_STRING_LENGTH),
        position: sanitizeInput(w.position, MAX_STRING_LENGTH),
        highlights: (w.highlights || []).slice(0, 5).map(h => sanitizeInput(h, MAX_HIGHLIGHT_LENGTH)),
      }))
      .filter(w => w.position)

    // Sanitize and limit education
    const safeEducation = (education || [])
      .slice(0, MAX_EDUCATION)
      .map(e => ({
        institution: sanitizeInput(e.institution, MAX_STRING_LENGTH),
        degree: sanitizeInput(e.degree, MAX_STRING_LENGTH),
        area: sanitizeInput(e.area, MAX_STRING_LENGTH),
      }))
      .filter(e => e.degree)

    // Sanitize job titles and existing skills
    const safeJobTitles = (jobTitles || [])
      .slice(0, MAX_JOB_TITLES)
      .map(t => sanitizeInput(t, MAX_STRING_LENGTH))
      .filter(Boolean)

    const safeExistingSkills = (existingSkills || [])
      .slice(0, MAX_EXISTING_SKILLS)
      .map(s => sanitizeInput(s, MAX_STRING_LENGTH))
      .filter(Boolean)

    // Build context for AI
    const workContext = safeWorkHistory
      .map(w => `${w.position} at ${w.company}${w.highlights?.length ? `: ${w.highlights.join(', ')}` : ''}`)
      .join('\n')

    const eduContext = safeEducation
      .map(e => `${e.degree} in ${e.area} from ${e.institution}`)
      .join('\n')

    const jobContext = safeJobTitles.join(', ')
    const existingContext = safeExistingSkills.join(', ')

    const prompt = `Based on the following profile, suggest 10-15 relevant professional skills. Return ONLY a JSON array of skill strings, nothing else.

${workContext ? `Work Experience:\n${workContext}\n` : ''}
${eduContext ? `Education:\n${eduContext}\n` : ''}
${jobContext ? `Target Jobs: ${jobContext}\n` : ''}
${existingContext ? `Already Listed Skills (don't repeat): ${existingContext}` : ''}

Focus on:
- Technical skills relevant to their experience
- Soft skills that complement their background
- Industry-specific tools and technologies
- Skills that would be valuable for their target roles

Return only valid JSON array like: ["Skill 1", "Skill 2", ...]`

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a career advisor helping identify professional skills. Return only valid JSON arrays. Do not include any explanations or markdown formatting.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const content = completion.choices[0]?.message?.content?.trim() || '[]'

      // Parse the JSON response
      let skills: string[] = []
      try {
        // Handle potential markdown code blocks
        const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim()
        skills = JSON.parse(jsonContent)

        // Ensure we have an array of strings
        if (!Array.isArray(skills)) {
          skills = []
        }
        skills = skills
          .filter(s => typeof s === 'string' && s.length > 0)
          .map(s => s.slice(0, 100)) // Limit individual skill length

        // Filter out any existing skills
        if (safeExistingSkills.length) {
          const existingLower = safeExistingSkills.map(s => s.toLowerCase())
          skills = skills.filter(s => !existingLower.includes(s.toLowerCase()))
        }
      } catch {
        console.error('Failed to parse AI response:', content)
        skills = []
      }

      return NextResponse.json({
        success: true,
        skills: skills.slice(0, 15),
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
    console.error('AI skills suggestion error:', error)
    return NextResponse.json(
      { error: 'Failed to generate skill suggestions' },
      { status: 500 }
    )
  }
}
