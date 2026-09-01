import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCV, extractTextFromFile } from '@/lib/ai/cv-parser'
import { checkRateLimit } from '@/lib/security/rate-limit'
import type { Json } from '@/lib/supabase/types'

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

  // Fallback if sanitization produced empty name (e.g., non-Latin filenames)
  const baseName = sanitized || 'cv'
  return `${baseName}.${ext}`
}

const UNREADABLE_CV_ERROR = 'Unable to read CV content. Please upload a valid PDF, DOCX, or TXT file.'

function hasReadableCvText(text: string): boolean {
  return text.trim().length > 0 && /[\p{L}\p{N}]/u.test(text)
}

async function removeCvObject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
): Promise<unknown | null> {
  try {
    const { error } = await supabase.storage.from('cvs').remove([path])
    return error
  } catch (error) {
    return error
  }
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
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]
      const allowedExtensions = ['.pdf', '.docx', '.txt']
      const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() || '')

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload a PDF, DOCX, or TXT file.' },
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

    // Get existing CV URL so we can clean up the old file after successful update
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('cv_url')
      .eq('id', user.id)
      .single()

    const oldCvUrl = existingProfile?.cv_url

    let textContent = cvText || ''
    let cvUrl = oldCvUrl || null

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
      cvUrl = uploadData.path

      // Always validate the uploaded bytes, even if the client also supplied text.
      const buffer = Buffer.from(await file.arrayBuffer())
      const extractedText = await extractTextFromFile(buffer, file.name)
      if (!hasReadableCvText(extractedText)) {
        const cleanupError = await removeCvObject(supabase, cvUrl)
        if (cleanupError) {
          console.error('Failed to clean up unreadable CV upload:', {
            path: cvUrl,
            error: cleanupError,
          })
        }
        return NextResponse.json({ error: UNREADABLE_CV_ERROR }, { status: 422 })
      }

      if (!hasReadableCvText(textContent)) {
        textContent = extractedText
      }
    }

    // Parse CV with AI if we have text content
    let parsedData = null
    let parsingFailed = false
    if (textContent) {
      parsedData = await parseCV(textContent)
      if (!parsedData) {
        parsingFailed = true
      }
    }

    // Build the profile update — preserve existing cv_parsed_data if AI parsing failed
    const profileUpdate: Record<string, unknown> = {
      id: user.id,
      cv_url: cvUrl,
      updated_at: new Date().toISOString(),
    }
    if (!parsingFailed) {
      profileUpdate.cv_parsed_data = parsedData
    }

    // Update profile with CV URL and parsed data
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert(profileUpdate)

    if (updateError) {
      console.error('Update error:', updateError)
      // Clean up newly uploaded file if profile update failed
      if (file && cvUrl && cvUrl !== oldCvUrl) {
        const cleanupError = await removeCvObject(supabase, cvUrl)
        if (cleanupError) {
          console.error('Failed to clean up orphaned upload:', {
            path: cvUrl,
            error: cleanupError,
          })
        }
      }
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 400 }
      )
    }

    // Profile updated successfully — clean up old file if it was replaced
    if (file && oldCvUrl && oldCvUrl !== cvUrl) {
      const cleanupError = await removeCvObject(supabase, oldCvUrl)
      if (cleanupError) {
        console.error('Failed to delete replaced CV file:', {
          path: oldCvUrl,
          replacementPath: cvUrl,
          error: cleanupError,
        })
      }
    }

    return NextResponse.json({
      cv_url: cvUrl,
      parsed_data: parsedData,
      parsing_failed: parsingFailed,
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cv_url, screening_answers')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Failed to load CV profile before deletion:', profileError)
      return NextResponse.json({ error: 'Failed to remove CV' }, { status: 400 })
    }

    // Storage and Postgres cannot share a transaction. Remove the object first so
    // a Storage API failure never leaves the profile claiming deletion succeeded.
    if (profile.cv_url) {
      const storageError = await removeCvObject(supabase, profile.cv_url)
      if (storageError) {
        console.error('Failed to delete CV from storage:', {
          path: profile.cv_url,
          error: storageError,
        })
        return NextResponse.json({ error: 'Failed to remove CV file' }, { status: 400 })
      }
    }

    const screeningAnswers =
      profile?.screening_answers &&
      typeof profile.screening_answers === 'object' &&
      !Array.isArray(profile.screening_answers)
        ? { ...profile.screening_answers } as Record<string, unknown>
        : {}
    delete screeningAnswers.cv_url
    delete screeningAnswers.cv_generation_mode

    // Update profile to remove CV data (single atomic update)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        cv_url: null,
        cv_parsed_data: null,
        screening_answers: screeningAnswers as Json,
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('CV delete error:', error)
    return NextResponse.json(
      { error: 'Failed to remove CV' },
      { status: 500 }
    )
  }
}
