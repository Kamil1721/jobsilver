import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCV, generateTailoredCV, type CVData } from '@/lib/cv/pdf-generator'
import type { ScreeningAnswers } from '@/lib/supabase/types'

interface GenerateRequest {
  screeningAnswers: ScreeningAnswers
  jobContext?: {
    id: string
    title: string
    company: string
    description?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as GenerateRequest
    const { screeningAnswers, jobContext } = body

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

    // Prepare CV data
    const cvData: CVData = {
      first_name: screeningAnswers.first_name || '',
      last_name: screeningAnswers.last_name || '',
      email: user.email || '',
      phone,
      location,
      linkedin_url: screeningAnswers.linkedin_url || undefined,
      experience_summary: screeningAnswers.experience_summary || undefined,
      work_history: (screeningAnswers.work_history || []).filter(w => w.company && w.position),
      education: (screeningAnswers.education || []).filter(e => e.institution && e.degree),
      skills: screeningAnswers.skills || [],
    }

    // Generate PDF
    let pdfBytes: Uint8Array
    try {
      if (jobContext) {
        pdfBytes = await generateTailoredCV(cvData, jobContext)
      } else {
        pdfBytes = await generateCV(cvData)
      }
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

    return NextResponse.json({
      success: true,
      cv_url: uploadData.path,
      signed_url: signedUrlData?.signedUrl,
      message: 'CV generated successfully'
    })

  } catch (error) {
    console.error('CV generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate CV' },
      { status: 500 }
    )
  }
}
