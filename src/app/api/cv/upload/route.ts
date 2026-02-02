import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCV, extractTextFromFile } from '@/lib/ai/cv-parser'
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

    // Rate limiting for CV uploads (max 10 per hour to prevent abuse)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 10, windowSeconds: 3600, prefix: 'cv-upload' }, 'cv-upload')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const cvText = formData.get('cvText') as string | null

    if (!file && !cvText) {
      return NextResponse.json(
        { error: 'No file or text provided' },
        { status: 400 }
      )
    }

    // Backend file validation
    if (file) {
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

      // Validate file size (10MB max to match bucket config)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB.' },
          { status: 400 }
        )
      }
    }

    let textContent = cvText || ''
    let cvUrl = null

    if (file) {
      // Upload file to Supabase Storage
      const safeFileName = sanitizeFileName(file.name)
      const fileName = `${user.id}/${Date.now()}-${safeFileName}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cvs')
        .upload(fileName, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json(
          { error: 'Failed to upload CV' },
          { status: 400 }
        )
      }

      // Store the file path (not public URL since bucket is private)
      // The path can be used to create signed URLs when needed
      cvUrl = uploadData.path

      // Extract text from file if not provided
      if (!textContent) {
        const buffer = Buffer.from(await file.arrayBuffer())
        // Use Adobe PDF Services or fallback extraction for all file types
        textContent = await extractTextFromFile(buffer, file.name)
      }
    }

    // Parse CV with AI if we have text content
    let parsedData = null
    if (textContent) {
      parsedData = await parseCV(textContent)
    }

    // Update profile with CV URL and parsed data
    // Also reset cv_is_generated to false since user uploaded their own CV
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        cv_url: cvUrl,
        cv_parsed_data: parsedData,
        cv_is_generated: false,
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
      cv_url: cvUrl,
      parsed_data: parsedData,
    })
  } catch (error) {
    console.error('CV upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process CV' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current CV URL to delete from storage
    const { data: profile } = await supabase
      .from('profiles')
      .select('cv_url')
      .eq('id', user.id)
      .single()

    // Delete file from storage if it exists (ignore errors)
    if (profile?.cv_url) {
      try {
        await supabase.storage
          .from('cvs')
          .remove([profile.cv_url])
      } catch (e) {
        // Ignore storage deletion errors
        console.warn('Failed to delete CV from storage:', e)
      }
    }

    // Update profile to remove CV URL
    // Note: cv_is_generated might not exist if migration hasn't been run
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        cv_url: null,
        cv_parsed_data: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove CV' },
        { status: 400 }
      )
    }

    // Try to update cv_is_generated separately (may fail if column doesn't exist yet)
    try {
      await supabase
        .from('profiles')
        .update({ cv_is_generated: false })
        .eq('id', user.id)
    } catch {
      // Silently ignore if column doesn't exist
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('CV delete error:', error)
    return NextResponse.json(
      { error: 'Failed to remove CV' },
      { status: 500 }
    )
  }
}
