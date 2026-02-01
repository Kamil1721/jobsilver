import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ScreeningAnswers } from '@/lib/supabase/types'

interface GenerateRequest {
  screeningAnswers: ScreeningAnswers
}

interface PythonFunctionResponse {
  success: boolean
  pdf?: string
  filename?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as GenerateRequest
    const { screeningAnswers } = body

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

    // Prepare data for Python function
    const cvData = {
      first_name: screeningAnswers.first_name,
      last_name: screeningAnswers.last_name,
      email: user.email || '',
      phone,
      location,
      linkedin_url: screeningAnswers.linkedin_url,
      experience_summary: screeningAnswers.experience_summary,
      work_history: screeningAnswers.work_history,
      education: screeningAnswers.education,
      skills: screeningAnswers.skills || [],
    }

    // Determine the base URL for the Python function
    // In production, this would be the same domain
    // In development, we might need to handle this differently
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Call the Python serverless function
    let pythonResponse: PythonFunctionResponse

    try {
      const functionUrl = `${baseUrl}/api/generate-cv`
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cvData),
      })

      pythonResponse = await response.json()

      if (!pythonResponse.success || !pythonResponse.pdf) {
        // If Python function fails, try to generate inline (fallback)
        console.warn('Python function failed, using fallback:', pythonResponse.error)
        return NextResponse.json(
          { error: pythonResponse.error || 'CV generation failed' },
          { status: 500 }
        )
      }
    } catch (fetchError) {
      console.error('Failed to call Python function:', fetchError)
      return NextResponse.json(
        { error: 'CV generation service unavailable' },
        { status: 503 }
      )
    }

    // Decode base64 PDF
    const pdfBuffer = Buffer.from(pythonResponse.pdf, 'base64')

    // Generate filename
    const safeFirstName = (screeningAnswers.first_name || 'cv').replace(/[^a-zA-Z0-9]/g, '_')
    const safeLastName = (screeningAnswers.last_name || '').replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${user.id}/${Date.now()}-${safeFirstName}_${safeLastName}_CV.pdf`

    // Upload PDF to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cvs')
      .upload(fileName, pdfBuffer, {
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

    // Update profile with CV URL and set cv_is_generated flag
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

    return NextResponse.json({
      success: true,
      cv_url: uploadData.path,
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
