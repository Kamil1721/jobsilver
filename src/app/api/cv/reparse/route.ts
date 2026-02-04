import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCV, extractTextFromFile } from '@/lib/ai/cv-parser'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Re-parse an existing uploaded CV
 * Useful when the initial parse failed to extract work experience or education
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting (max 5 per hour)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 5, windowSeconds: 3600, prefix: 'cv-reparse' }, 'cv-reparse')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many re-parse attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Get the existing CV URL
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cv_url')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.cv_url) {
      return NextResponse.json(
        { error: 'No CV found. Please upload a CV first.' },
        { status: 404 }
      )
    }

    // Download the CV file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('cvs')
      .download(profile.cv_url)

    if (downloadError || !fileData) {
      console.error('CV download error:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download CV for re-parsing.' },
        { status: 500 }
      )
    }

    // Get file extension from path
    const fileName = profile.cv_url.split('/').pop() || 'document.pdf'

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Extract text from the file
    const textContent = await extractTextFromFile(buffer, fileName)

    if (!textContent || textContent.length < 50) {
      return NextResponse.json(
        { error: 'Could not extract text from CV. The file may be image-based or corrupted.' },
        { status: 400 }
      )
    }

    // Parse CV with AI
    const parsedData = await parseCV(textContent)

    // Check if we got better results this time
    const hasExperience = parsedData.experience && parsedData.experience.length > 0
    const hasEducation = parsedData.education && parsedData.education.length > 0

    // Update profile with new parsed data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        cv_parsed_data: parsedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save parsed data.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      parsed_data: parsedData,
      extracted: {
        skills: parsedData.skills?.length || 0,
        experience: parsedData.experience?.length || 0,
        education: parsedData.education?.length || 0,
      },
      message: hasExperience && hasEducation
        ? 'CV re-parsed successfully with work experience and education.'
        : 'CV re-parsed, but some sections may still be missing. You may need to fill them in manually.'
    })
  } catch (error) {
    console.error('CV re-parse error:', error)
    return NextResponse.json(
      { error: 'Failed to re-parse CV.' },
      { status: 500 }
    )
  }
}
