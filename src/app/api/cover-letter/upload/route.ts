import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// Sanitize filename to remove special characters that cause storage errors
function sanitizeFileName(fileName: string): string {
  // Get the extension
  const ext = fileName.split('.').pop() || ''
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')

  // Replace special characters with underscores, keep only ASCII alphanumeric and basic punctuation
  const sanitized = nameWithoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^a-zA-Z0-9_\-]/g, '_') // Replace non-safe chars with underscore
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores

  return `${sanitized}.${ext}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting for cover letter uploads (max 10 per hour to prevent storage abuse)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 10, windowSeconds: 3600, prefix: 'cover-letter-upload' }, 'cover-letter-upload')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Backend file validation
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt']
    const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() || '')

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF, DOC, DOCX, or TXT file.' },
        { status: 400 }
      )
    }

    // Validate file size (2MB max for cover letters)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB for cover letters.' },
        { status: 400 }
      )
    }

    // Upload file to Supabase Storage
    const safeFileName = sanitizeFileName(file.name)
    const fileName = `${user.id}/${Date.now()}-${safeFileName}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cover-letters')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload cover letter' },
        { status: 400 }
      )
    }

    // Store the file path (not public URL since bucket is private)
    const coverLetterUrl = uploadData.path

    // Get current profile to update screening_answers
    const { data: profile } = await supabase
      .from('profiles')
      .select('screening_answers')
      .eq('id', user.id)
      .single()

    // Update screening_answers with cover letter URL
    const currentScreeningAnswers = profile?.screening_answers || {}
    const updatedScreeningAnswers = {
      ...currentScreeningAnswers,
      cover_letter_url: coverLetterUrl,
    }

    // Update profile with cover letter URL in screening_answers
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        screening_answers: updatedScreeningAnswers,
        updated_at: new Date().toISOString(),
      })

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      cover_letter_url: coverLetterUrl,
      file_name: file.name,
    })
  } catch (error) {
    console.error('Cover letter upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process cover letter' },
      { status: 500 }
    )
  }
}

// DELETE endpoint to remove cover letter
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('screening_answers')
      .eq('id', user.id)
      .single()

    const currentScreeningAnswers = profile?.screening_answers as Record<string, unknown> || {}
    const coverLetterUrl = currentScreeningAnswers.cover_letter_url as string | undefined

    // Delete file from storage if exists
    if (coverLetterUrl) {
      await supabase.storage
        .from('cover-letters')
        .remove([coverLetterUrl])
    }

    // Update screening_answers to remove cover letter URL
    const updatedScreeningAnswers = {
      ...currentScreeningAnswers,
      cover_letter_url: null,
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        screening_answers: updatedScreeningAnswers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cover letter delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete cover letter' },
      { status: 500 }
    )
  }
}
