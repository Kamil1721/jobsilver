import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { mapParsedCVToScreeningAnswers, type ParsedCV } from '@/lib/cv/data-mapper'
import { tailorCVForJob, shouldUseAITailoring, sanitizeAIOutput } from '@/lib/cv/ai-tailor'
import type { ScreeningAnswers, Json } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// Check if we're running on Vercel (production)
const IS_PRODUCTION = !!process.env.VERCEL

interface JobContext {
  id: string
  title: string
  company: string
  description?: string
}

interface GenerateRequest {
  screeningAnswers?: ScreeningAnswers
  jobContext?: JobContext
  // Quick generate mode - use existing CV data from profile
  quickGenerate?: boolean
  // Enable AI tailoring (default true when job context is provided)
  aiTailor?: boolean
}

interface QuickGenerateResponse {
  success: false
  needsDialog: true
  missingFields: string[]
  message: string
}

interface ServerlessCVData {
  first_name: string
  last_name: string
  email: string
  phone?: string
  location?: string
  linkedin_url?: string
  experience_summary?: string
  work_history: {
    company: string
    position: string
    start_date: string
    end_date: string | null
    location?: string
    highlights: string[]
  }[]
  education: {
    institution: string
    degree: string
    area: string
    graduation_year: string
    location?: string
    highlights?: string[]
  }[]
  skills: string[]
}

/**
 * Generate CV using pdf-lib (works in all environments)
 */
async function generateCVLocally(
  cvData: ServerlessCVData,
  jobContext?: JobContext,
  aiTailor?: boolean
): Promise<Uint8Array> {
  // Dynamic import to avoid loading pdf-lib in production
  const { generateCV, generateTailoredCV } = await import('@/lib/cv/pdf-generator')

  const pdfLibData = {
    first_name: cvData.first_name,
    last_name: cvData.last_name,
    email: cvData.email,
    phone: cvData.phone,
    location: cvData.location,
    linkedin_url: cvData.linkedin_url,
    experience_summary: cvData.experience_summary,
    work_history: cvData.work_history,
    education: cvData.education,
    skills: cvData.skills,
  }

  if (jobContext) {
    let tailoredContent
    if (aiTailor && shouldUseAITailoring(jobContext)) {
      try {
        tailoredContent = await tailorCVForJob(pdfLibData, jobContext)
      } catch (tailorError) {
        console.error('AI tailoring failed, using basic tailoring:', tailorError)
      }
    }
    return generateTailoredCV(pdfLibData, jobContext, tailoredContent)
  }

  return generateCV(pdfLibData)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting for CV generation (max 5 per hour to prevent storage abuse)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 5, windowSeconds: 3600, prefix: 'cv-gen' }, 'cv-generate')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many CV generations. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json() as GenerateRequest
    let { screeningAnswers, jobContext, quickGenerate, aiTailor } = body

    // Default aiTailor to true when job context is provided
    if (aiTailor === undefined && jobContext) {
      aiTailor = true
    }

    // Verify job ownership if jobContext is provided
    if (jobContext?.id) {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, user_id')
        .eq('id', jobContext.id)
        .single()

      if (jobError || !jobData || jobData.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Invalid job context' },
          { status: 403 }
        )
      }
    }

    // Quick generate mode - automatically retrieve CV data from profile
    if (quickGenerate) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('screening_answers, cv_parsed_data, full_name, phone, location')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        return NextResponse.json(
          { error: 'Failed to fetch profile data' },
          { status: 500 }
        )
      }

      // Try screening_answers first, then cv_parsed_data
      if (profile.screening_answers) {
        screeningAnswers = profile.screening_answers as ScreeningAnswers
      } else if (profile.cv_parsed_data) {
        // Map parsed CV to screening answers format
        const parsedCV = profile.cv_parsed_data as unknown as ParsedCV
        const mappingResult = mapParsedCVToScreeningAnswers(parsedCV)

        if (!mappingResult.isComplete) {
          // Not enough data for quick generation
          const response: QuickGenerateResponse = {
            success: false,
            needsDialog: true,
            missingFields: mappingResult.missingFields,
            message: 'Please fill in the missing information to generate your CV.',
          }
          return NextResponse.json(response)
        }

        screeningAnswers = mappingResult.screeningAnswers as ScreeningAnswers
      } else {
        // No CV data available at all
        const response: QuickGenerateResponse = {
          success: false,
          needsDialog: true,
          missingFields: ['cv_data'],
          message: 'Please upload a CV or fill in your information first.',
        }
        return NextResponse.json(response)
      }
    }

    if (!screeningAnswers) {
      return NextResponse.json(
        { error: 'Missing screening answers' },
        { status: 400 }
      )
    }

    // Validate required data for CV generation
    const workHistory = screeningAnswers.work_history || []
    const education = screeningAnswers.education || []

    const hasValidWork = workHistory.some(
      (w) => w.company && w.position && w.start_date
    )
    const hasValidEducation = education.some(
      (e) => e.institution && e.degree && e.area && e.graduation_year
    )

    // For quick generate, return needsDialog response instead of error
    if (quickGenerate && (!hasValidWork || !hasValidEducation)) {
      const missingFields: string[] = []
      if (!hasValidWork) missingFields.push('work_history')
      if (!hasValidEducation) missingFields.push('education')

      const response: QuickGenerateResponse = {
        success: false,
        needsDialog: true,
        missingFields,
        message: 'Some required information is missing. Please complete the form.',
      }
      return NextResponse.json(response)
    }

    if (!hasValidWork) {
      return NextResponse.json(
        { error: 'At least one work experience entry is required' },
        { status: 400 }
      )
    }

    if (!hasValidEducation) {
      return NextResponse.json(
        { error: 'At least one education entry is required' },
        { status: 400 }
      )
    }

    // Build phone number with country code
    const phone = screeningAnswers.phone_country_code && screeningAnswers.phone_number
      ? `${screeningAnswers.phone_country_code} ${screeningAnswers.phone_number}`
      : screeningAnswers.phone_number || ''

    // Build location string
    const locationParts = [
      screeningAnswers.city,
      screeningAnswers.state_region,
      screeningAnswers.country
    ].filter(Boolean)
    const location = locationParts.join(', ')

    // Prepare CV data for serverless function
    const cvData: ServerlessCVData = {
      first_name: screeningAnswers.first_name || '',
      last_name: screeningAnswers.last_name || '',
      email: user.email || '',
      phone,
      location,
      linkedin_url: screeningAnswers.linkedin_url || undefined,
      experience_summary: screeningAnswers.experience_summary || undefined,
      work_history: (screeningAnswers.work_history || []).filter(w => w.company && w.position),
      education: (screeningAnswers.education || []).filter(e => e.institution && e.degree && e.area && e.graduation_year),
      skills: screeningAnswers.skills || [],
    }

    // Apply AI tailoring to the data before sending to serverless
    if (IS_PRODUCTION && jobContext && aiTailor && shouldUseAITailoring(jobContext)) {
      try {
        const tailoredContent = await tailorCVForJob(cvData, jobContext)
        // Apply tailored content to cvData
        if (tailoredContent.summary) {
          cvData.experience_summary = tailoredContent.summary
        }
        if (tailoredContent.skills && tailoredContent.skills.length > 0) {
          cvData.skills = tailoredContent.skills
        }
        // Apply enhanced highlights to all work entries that have them
        if (tailoredContent.enhancedHighlights && cvData.work_history.length > 0) {
          tailoredContent.enhancedHighlights.forEach((enhanced, index) => {
            if (enhanced && enhanced.length > 0 && index < cvData.work_history.length) {
              cvData.work_history[index] = { ...cvData.work_history[index], highlights: enhanced }
            }
          })
        }
      } catch (tailorError) {
        console.error('AI tailoring failed, continuing without:', tailorError)
      }
    }

    // Sanitize all string fields before sending to serverless (for YAML/LaTeX compatibility)
    // This is critical when AI tailoring has been applied, as AI may produce Unicode characters
    const sanitizedCVData: ServerlessCVData = {
      first_name: sanitizeAIOutput(cvData.first_name),
      last_name: sanitizeAIOutput(cvData.last_name),
      email: cvData.email, // Keep email as-is
      phone: cvData.phone ? sanitizeAIOutput(cvData.phone) : undefined,
      location: cvData.location ? sanitizeAIOutput(cvData.location) : undefined,
      linkedin_url: cvData.linkedin_url, // Keep URL as-is
      experience_summary: cvData.experience_summary ? sanitizeAIOutput(cvData.experience_summary) : undefined,
      work_history: cvData.work_history.map(w => ({
        ...w,
        company: sanitizeAIOutput(w.company),
        position: sanitizeAIOutput(w.position),
        location: w.location ? sanitizeAIOutput(w.location) : undefined,
        highlights: (w.highlights || []).map(h => sanitizeAIOutput(h)).filter(Boolean),
      })),
      education: cvData.education.map(e => ({
        ...e,
        institution: sanitizeAIOutput(e.institution),
        degree: sanitizeAIOutput(e.degree),
        area: sanitizeAIOutput(e.area),
        location: e.location ? sanitizeAIOutput(e.location) : undefined,
        highlights: e.highlights?.map(h => sanitizeAIOutput(h)).filter(Boolean),
      })),
      skills: cvData.skills.map(s => sanitizeAIOutput(s)).filter(Boolean),
    }

    // Generate PDF using pdf-lib (works in all environments)
    // Note: RenderCV/LaTeX approach was removed because Vercel serverless doesn't have LaTeX installed
    // Use sanitizedCVData to ensure Unicode characters don't break PDF generation
    let pdfBytes: Uint8Array
    try {
      console.log('Generating CV with pdf-lib')
      pdfBytes = await generateCVLocally(sanitizedCVData, jobContext, aiTailor)
    } catch (genError) {
      console.error('PDF generation error:', genError)
      return NextResponse.json(
        { error: 'Failed to generate CV PDF' },
        { status: 500 }
      )
    }

    // Generate filename
    const safeFirstName = (screeningAnswers.first_name || 'cv').replace(/[^a-zA-Z0-9]/g, '_')
    const safeLastName = (screeningAnswers.last_name || '').replace(/[^a-zA-Z0-9]/g, '_')
    const jobSuffix = jobContext ? `_${jobContext.company.replace(/[^a-zA-Z0-9]/g, '_')}` : ''
    const fileName = `${user.id}/${Date.now()}-${safeFirstName}_${safeLastName}${jobSuffix}_CV.pdf`

    // Upload PDF to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cvs')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload generated CV' },
        { status: 500 }
      )
    }

    // Update profile with CV URL and set cv_is_generated flag (only if not job-specific)
    if (!jobContext) {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          cv_url: uploadData.path,
          cv_is_generated: true,
          updated_at: new Date().toISOString(),
        })

      if (updateError) {
        console.error('Profile update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        )
      }
    }

    // Get signed URL for the generated CV
    const { data: signedUrlData } = await supabase.storage
      .from('cvs')
      .createSignedUrl(uploadData.path, 3600) // 1 hour expiry

    // Save work_history, education, and skills to screening_answers for persistence
    // This ensures user data is pre-filled next time they open the CV generator
    let dataSaveWarning: string | undefined
    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('screening_answers')
        .eq('id', user.id)
        .single()

      const existingAnswers = (currentProfile?.screening_answers || {}) as Record<string, unknown>
      const updatedScreeningAnswers = {
        ...existingAnswers,
        // KEY FIELDS - these are what populate the form next time
        work_history: screeningAnswers.work_history,
        education: screeningAnswers.education,
        skills: screeningAnswers.skills,
        // Personal info (preserve existing if not provided in this request)
        first_name: screeningAnswers.first_name || existingAnswers.first_name,
        last_name: screeningAnswers.last_name || existingAnswers.last_name,
        city: screeningAnswers.city || existingAnswers.city,
        country: screeningAnswers.country || existingAnswers.country,
        state_region: screeningAnswers.state_region || existingAnswers.state_region,
        phone_country_code: screeningAnswers.phone_country_code || existingAnswers.phone_country_code,
        phone_number: screeningAnswers.phone_number || existingAnswers.phone_number,
        linkedin_url: screeningAnswers.linkedin_url || existingAnswers.linkedin_url,
        experience_summary: screeningAnswers.experience_summary || existingAnswers.experience_summary,
      }

      const { error: saveError } = await supabase
        .from('profiles')
        .update({ screening_answers: updatedScreeningAnswers as Json })
        .eq('id', user.id)

      if (saveError) {
        console.error('Failed to save screening answers:', saveError)
        dataSaveWarning = 'Your data may not be saved for next time'
      } else {
        console.log('Saved screening_answers:', {
          work_history_count: screeningAnswers.work_history?.length,
          education_count: screeningAnswers.education?.length,
          skills_count: screeningAnswers.skills?.length,
        })
      }
    } catch (saveError) {
      // Log but don't fail the request - CV was generated successfully
      console.error('Failed to save screening answers (exception):', saveError)
      dataSaveWarning = 'Your data may not be saved for next time'
    }

    return NextResponse.json({
      success: true,
      cv_url: uploadData.path,
      signed_url: signedUrlData?.signedUrl,
      message: 'CV generated successfully',
      warning: dataSaveWarning,
    })

  } catch (error) {
    console.error('CV generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate CV' },
      { status: 500 }
    )
  }
}
