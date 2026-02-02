import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting for AI skills suggestions (max 10 per hour to prevent OpenAI API abuse)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 10, windowSeconds: 3600, prefix: 'ai-skills' }, 'ai-skills')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json() as SuggestSkillsRequest
    const { workHistory, education, jobTitles, existingSkills } = body

    // Build context for AI
    const workContext = (workHistory || [])
      .filter(w => w.position)
      .map(w => `${w.position} at ${w.company}${w.highlights?.length ? `: ${w.highlights.join(', ')}` : ''}`)
      .join('\n')

    const eduContext = (education || [])
      .filter(e => e.degree)
      .map(e => `${e.degree} in ${e.area} from ${e.institution}`)
      .join('\n')

    const jobContext = (jobTitles || []).join(', ')
    const existingContext = (existingSkills || []).join(', ')

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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a career advisor helping identify professional skills. Return only valid JSON arrays.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const content = completion.choices[0]?.message?.content?.trim() || '[]'

    // Parse the JSON response
    let skills: string[] = []
    try {
      // Handle potential markdown code blocks
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim()
      skills = JSON.parse(jsonContent)

      // Filter out any existing skills
      if (existingSkills?.length) {
        const existingLower = existingSkills.map(s => s.toLowerCase())
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

  } catch (error) {
    console.error('AI skills suggestion error:', error)
    return NextResponse.json(
      { error: 'Failed to generate skill suggestions' },
      { status: 500 }
    )
  }
}
