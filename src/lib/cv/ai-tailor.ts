/**
 * AI CV Tailor Service
 * Uses AI to tailor CV content for specific job applications
 */

import OpenAI from 'openai'
import type { CVData } from './pdf-generator'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Timeout for OpenAI calls (30 seconds)
const AI_TIMEOUT_MS = 30000

export interface JobContext {
  id: string
  title: string
  company: string
  description?: string
}

export interface TailoredContent {
  summary: string
  skills: string[] // Reordered with most relevant first
  enhancedHighlights?: Map<number, string[]> // Index -> enhanced highlights for that work entry
}

/**
 * Sanitize user input to prevent prompt injection
 * Removes control characters and limits problematic patterns
 */
function sanitizeForPrompt(input: string, maxLength: number): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .slice(0, maxLength)
    // Remove newlines and carriage returns that could break prompt structure
    .replace(/[\r\n]+/g, ' ')
    // Remove potential prompt injection patterns
    .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '')
    // Remove markdown/code block attempts
    .replace(/```/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate AI-tailored CV content for a specific job
 * Uses gpt-4o-mini for cost efficiency (~$0.0006 per generation)
 */
export async function tailorCVForJob(
  cvData: CVData,
  job: JobContext
): Promise<TailoredContent> {
  // Sanitize all inputs to prevent prompt injection
  const safeTitle = sanitizeForPrompt(job.title, 200)
  const safeCompany = sanitizeForPrompt(job.company, 200)
  const safeDescription = sanitizeForPrompt(job.description || '', 2000)
  const safeSummary = sanitizeForPrompt(cvData.experience_summary || '', 500)

  // Extract key info for the prompt
  const currentSkills = cvData.skills
    .slice(0, 20) // Limit to prevent token overflow
    .map(s => sanitizeForPrompt(s, 100))
    .filter(Boolean)

  const workExperience = cvData.work_history
    .slice(0, 3) // Focus on most recent 3 positions
    .map(w => `${sanitizeForPrompt(w.position, 100)} at ${sanitizeForPrompt(w.company, 100)}`)
    .join(', ')

  const prompt = `You are tailoring a CV for a specific job application. Generate content that highlights relevant qualifications.

JOB TARGET:
- Title: ${safeTitle}
- Company: ${safeCompany}
${safeDescription ? `- Description excerpt: ${safeDescription.slice(0, 1000)}...` : ''}

CANDIDATE BACKGROUND:
- Current skills: ${currentSkills.join(', ')}
- Experience: ${workExperience}
${safeSummary ? `- Current summary: ${safeSummary}` : ''}

TASKS:
1. Write a 2-3 sentence professional summary tailored for this specific role
2. Reorder the skills list to put the most relevant ones first (keep all skills, just reorder)
3. Suggest 2-3 enhanced bullet points for the most recent role that emphasize relevant experience

Respond in JSON format:
{
  "summary": "Tailored 2-3 sentence professional summary...",
  "skills": ["most_relevant_skill", "second_most_relevant", ...all other skills...],
  "topRoleHighlights": ["Enhanced bullet point 1", "Enhanced bullet point 2", "Enhanced bullet point 3"]
}

Guidelines:
- Keep the summary concise and impactful (2-3 sentences max)
- Don't invent skills or experience the candidate doesn't have
- Focus on matching keywords and requirements from the job
- Make the summary specific to this role, not generic`

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional CV writer. Return only valid JSON matching the requested format. Do not include any explanations or markdown formatting.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4, // Slightly creative but consistent
      max_tokens: 800,
    }, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const result = JSON.parse(content) as {
      summary: string
      skills: string[]
      topRoleHighlights?: string[]
    }

    // Validate and sanitize the response
    const tailoredContent: TailoredContent = {
      summary: (result.summary || `Experienced professional seeking ${safeTitle} position at ${safeCompany}.`).slice(0, 1000),
      skills: result.skills?.length > 0
        ? result.skills.map(s => String(s).slice(0, 100)).filter(Boolean)
        : cvData.skills,
    }

    // Add enhanced highlights for the first work entry if provided
    if (result.topRoleHighlights && result.topRoleHighlights.length > 0) {
      tailoredContent.enhancedHighlights = new Map()
      tailoredContent.enhancedHighlights.set(
        0,
        result.topRoleHighlights
          .filter(h => typeof h === 'string' && h.length > 0)
          .map(h => h.slice(0, 500))
          .slice(0, 5)
      )
    }

    return tailoredContent
  } catch (error) {
    clearTimeout(timeoutId)

    // Check for timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('AI tailoring timed out after', AI_TIMEOUT_MS, 'ms')
    } else {
      console.error('AI tailoring error:', error)
    }

    // Fall back to basic tailoring
    return generateBasicTailoredContent(cvData, job)
  }
}

/**
 * Generate basic tailored content without AI
 * Used as fallback if AI fails
 */
function generateBasicTailoredContent(
  cvData: CVData,
  job: JobContext
): TailoredContent {
  // Sanitize job inputs for fallback
  const safeTitle = sanitizeForPrompt(job.title, 200)
  const safeCompany = sanitizeForPrompt(job.company, 200)
  const safeDescription = job.description ? sanitizeForPrompt(job.description, 2000) : ''

  // Generate a simple summary
  const summary = cvData.experience_summary
    || `Experienced professional seeking ${safeTitle} position${safeCompany ? ` at ${safeCompany}` : ''}.`

  // Try to prioritize skills that appear in the job description
  let orderedSkills = [...cvData.skills]
  if (safeDescription) {
    const descLower = safeDescription.toLowerCase()
    orderedSkills.sort((a, b) => {
      const aMatch = descLower.includes(a.toLowerCase()) ? 1 : 0
      const bMatch = descLower.includes(b.toLowerCase()) ? 1 : 0
      return bMatch - aMatch // Sort matches first
    })
  }

  return {
    summary,
    skills: orderedSkills,
  }
}

/**
 * Check if AI tailoring should be used
 * (requires OpenAI API key and job description for meaningful tailoring)
 */
export function shouldUseAITailoring(job: JobContext): boolean {
  return !!(process.env.OPENAI_API_KEY && job.description && job.description.length > 100)
}
