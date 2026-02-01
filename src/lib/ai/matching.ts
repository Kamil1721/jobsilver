import OpenAI from 'openai'
import type { Job, ApplicationQuestion } from '@/lib/supabase/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Sanitize text for AI prompts to prevent prompt injection attacks
 * Removes or escapes patterns that could manipulate AI behavior
 */
function sanitizeForAIPrompt(text: string | undefined | null): string {
  if (!text) return 'Not provided'

  // Limit length to prevent token exhaustion attacks
  let sanitized = text.slice(0, 15000)

  // Remove common prompt injection patterns
  const injectionPatterns = [
    // Direct instruction overrides
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
    /disregard\s+(all\s+)?(previous|prior|above)/gi,
    /forget\s+(everything|all)\s+(above|before)/gi,
    // Role manipulation
    /you\s+are\s+now\s+a/gi,
    /act\s+as\s+(if\s+you\s+are\s+)?a/gi,
    /pretend\s+(to\s+be|you\s+are)/gi,
    /your\s+new\s+(role|instructions?|task)/gi,
    // System prompt extraction
    /what\s+(are|is)\s+your\s+(system\s+)?prompt/gi,
    /show\s+me\s+your\s+(system\s+)?instructions?/gi,
    /reveal\s+your\s+(system\s+)?prompt/gi,
    // Output manipulation
    /output\s+only/gi,
    /respond\s+with\s+only/gi,
    /your\s+response\s+must\s+(be|start\s+with)/gi,
    // Delimiter injection
    /```system/gi,
    /\[system\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
  ]

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  // Escape markdown-style delimiters that could confuse the model
  sanitized = sanitized
    .replace(/#{3,}/g, '##')  // Reduce multiple hashes
    .replace(/\*{3,}/g, '**') // Reduce multiple asterisks
    .replace(/_{3,}/g, '__')  // Reduce multiple underscores

  return sanitized
}

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

interface ScreeningData {
  current_job_title?: string
  experience_summary?: string
  expected_salary?: number | null
  salary_currency?: string
  availability?: string
  requires_visa_sponsorship?: boolean
  spoken_languages?: string[]
}

interface FiltersData {
  job_titles?: string[]
  seniority_levels?: string[]
  industries?: string[]
  work_arrangements?: string[]
  job_types?: string[]
  company_size?: string[]
  remote_countries?: string[]
}

interface MatchResult {
  score: number
  category: string
  reasoning: string
  matchedSkills: string[]
  missingSkills: string[]
  keyStrengths: string[]
  concerns: string[]
  preferenceNotes: string | null
}

export async function calculateJobMatch(
  job: Partial<Job>,
  cvData: CVData,
  screeningData?: ScreeningData,
  filtersData?: FiltersData
): Promise<MatchResult> {
  // Build work history with full descriptions
  const workHistory = cvData.experience.map(e =>
    `- ${e.title} at ${e.company} (${e.duration})${e.description ? `\n  ${e.description}` : ''}`
  ).join('\n')

  // Use screening summary if available, otherwise CV summary
  const experienceSummary = screeningData?.experience_summary || cvData.summary || 'Not provided'
  const currentRole = screeningData?.current_job_title || 'Not specified'

  // Format salary expectation
  const salaryExpectation = screeningData?.expected_salary
    ? `${screeningData.salary_currency || ''} ${screeningData.expected_salary}`.trim()
    : 'Not specified'

  // Sanitize job data to prevent prompt injection
  const sanitizedDescription = sanitizeForAIPrompt(job.description)
  const sanitizedTitle = sanitizeForAIPrompt(job.title)
  const sanitizedCompany = sanitizeForAIPrompt(job.company)

  const prompt = `You are an expert job-candidate matching analyst. Your task is to evaluate how well a candidate's complete professional profile aligns with a job opportunity, while considering their stated preferences.

## JOB OPPORTUNITY
**Title:** ${sanitizedTitle}
**Company:** ${sanitizedCompany}
**Location:** ${job.location || 'Not specified'}
**Description:**
${sanitizedDescription}

## CANDIDATE PROFILE
**Current Role:** ${currentRole}

**Professional Summary:**
${experienceSummary}

**Work History:**
${workHistory || 'Not provided'}

**Skills:** ${cvData.skills.join(', ') || 'Not provided'}

**Education:** ${cvData.education.map(e => `${e.degree} from ${e.institution}${e.year ? ` (${e.year})` : ''}`).join('; ') || 'Not provided'}

## CANDIDATE PREFERENCES (Soft Signals)
**Target Roles:** ${filtersData?.job_titles?.join(', ') || 'Not specified'}
**Target Seniority:** ${filtersData?.seniority_levels?.join(', ') || 'Any level'}
**Salary Expectation:** ${salaryExpectation}
**Availability:** ${screeningData?.availability || 'Not specified'}
**Requires Visa Sponsorship:** ${screeningData?.requires_visa_sponsorship ? 'Yes' : 'No'}
**Languages Spoken:** ${screeningData?.spoken_languages?.join(', ') || 'Not specified'}

## EVALUATION INSTRUCTIONS

Analyze the candidate holistically by examining:

1. **Direct Experience Match** - Roles, responsibilities, and achievements that directly relate to the job requirements
2. **Transferable Skills** - Capabilities from different contexts that apply to this role
3. **Industry & Domain Knowledge** - Relevant sector experience, even if in different functions
4. **Seniority Alignment** - Whether their career level matches the role's expectations
5. **Skill Gaps** - Critical missing qualifications vs. nice-to-haves
6. **Preference Alignment** - How well the job fits what the candidate is looking for

### CRITICAL RULES FOR PREFERENCES:

**Preferences are EXAMPLES and GUIDES, not strict filters:**

- **Target Roles:** If candidate specified "AI Engineer", also match similar roles like "Machine Learning Engineer", "ML Developer", "Data Scientist", "AI Developer", etc. Use semantic similarity, not exact matching.

- **Salary:**
  - If job description does NOT mention salary → **ignore salary in scoring entirely**
  - If candidate expects 50k PLN but job pays 45k PLN → this is still a reasonable match, note it but don't heavily penalize
  - Only flag salary as a concern if there's a significant mismatch (e.g., >30% difference) AND the job explicitly states compensation

- **Seniority:** Treat as approximate. "Mid-level" candidates can match "Senior" roles if they have strong experience, and vice versa.

- **Visa/Languages:** Only penalize if the job EXPLICITLY requires something the candidate cannot provide.

- **Missing information:** If any preference or job detail is "Not specified" → **do not penalize or make assumptions**

**Focus primarily on SKILLS and EXPERIENCE match. Preferences should only adjust the score by ±10 points maximum.**

## SCORING CRITERIA

| Score | Category | Description |
|-------|----------|-------------|
| 80-100 | Strong Match | Core requirements met; relevant experience; good preference alignment |
| 60-79 | Good Match | Most requirements met; strong transferable skills; minor preference gaps |
| 40-59 | Moderate Match | Some relevant experience; bridgeable skill gaps |
| 20-39 | Weak Match | Limited alignment; significant gaps |
| 0-19 | Poor Match | Fundamentally different background |

## RESPONSE FORMAT

Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "category": "<Strong Match|Good Match|Moderate Match|Weak Match|Poor Match>",
  "reasoning": "<2-3 sentences explaining the score based on specific evidence from their profile>",
  "matchedSkills": ["<skill from candidate that matches job requirement>"],
  "missingSkills": ["<required skill candidate lacks>"],
  "keyStrengths": ["<1-2 standout qualifications>"],
  "concerns": ["<1-2 potential issues or gaps, empty array if none>"],
  "preferenceNotes": "<optional: only mention if there's a notable preference consideration, otherwise null>"
}

**Output rules:**
- score must be an integer, not a range
- matchedSkills and missingSkills should contain 3-5 items each (if applicable)
- reasoning must reference specific details from the candidate's profile
- Do not invent or assume skills not explicitly stated in the profile
- Do not penalize for missing information in job description or preferences
- Similar job titles should be treated as matches (semantic matching)`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    return JSON.parse(content) as MatchResult
  } catch (error) {
    console.error('Error calculating job match:', error)
    return {
      score: 50,
      category: 'Moderate Match',
      reasoning: 'Unable to calculate match score',
      matchedSkills: [],
      missingSkills: [],
      keyStrengths: [],
      concerns: ['Match calculation failed'],
      preferenceNotes: null,
    }
  }
}

export async function generateApplicationQuestions(
  job: Partial<Job>
): Promise<ApplicationQuestion[]> {
  // Sanitize job data to prevent prompt injection
  const sanitizedTitle = sanitizeForAIPrompt(job.title)
  const sanitizedCompany = sanitizeForAIPrompt(job.company)
  const sanitizedDescription = sanitizeForAIPrompt(job.description)

  const prompt = `You are helping a job seeker prepare for an application. Based on this job posting, generate 4-6 likely application questions they should prepare answers for.

JOB DETAILS:
Title: ${sanitizedTitle}
Company: ${sanitizedCompany}
Description: ${sanitizedDescription}

Generate questions in JSON format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text here",
      "type": "text" | "textarea",
      "required": true | false
    }
  ]
}

Include questions like:
- Why are you interested in this role?
- Describe your relevant experience with [key skill from job]
- What is your expected salary?
- When can you start?
- Are you authorized to work in [country]?
- Any specific technical questions based on job requirements`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const data = JSON.parse(content)
    return data.questions as ApplicationQuestion[]
  } catch (error) {
    console.error('Error generating questions:', error)
    // Return default questions if AI fails
    return [
      {
        id: 'q1',
        question: 'Why are you interested in this position?',
        type: 'textarea',
        required: true,
      },
      {
        id: 'q2',
        question: 'Describe your relevant experience for this role.',
        type: 'textarea',
        required: true,
      },
      {
        id: 'q3',
        question: 'What is your expected salary range?',
        type: 'text',
        required: false,
      },
      {
        id: 'q4',
        question: 'When would you be available to start?',
        type: 'text',
        required: true,
      },
    ]
  }
}

export async function suggestAnswer(
  question: string,
  cvData: CVData,
  jobTitle: string,
  savedAnswers: { question: string; answer: string }[]
): Promise<string> {
  // First check if we have a similar saved answer
  const similarAnswer = savedAnswers.find(sa =>
    sa.question.toLowerCase().includes(question.toLowerCase().slice(0, 20))
  )

  if (similarAnswer) {
    return similarAnswer.answer
  }

  const prompt = `Help craft a professional answer for a job application.

Question: ${question}
Job Title: ${jobTitle}

Candidate Info:
- Skills: ${cvData.skills.join(', ')}
- Recent Experience: ${cvData.experience[0]?.title} at ${cvData.experience[0]?.company}
- Summary: ${cvData.summary}

Write a concise, professional answer (2-3 sentences max) that the candidate can use as a starting point. Be specific but not too long.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    })

    return response.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Error suggesting answer:', error)
    return ''
  }
}
