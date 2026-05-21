import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PoC: Auto-Apply — CV/resume upload.
 *
 * Self-contained. Does NOT touch Supabase / auth / existing feature code.
 *
 * POST /api/poc-auto-apply/cv-upload
 * Body: multipart/form-data with a `file` field (pdf / doc / docx, <= 10MB).
 * Returns: { cvId, fileName, contentType }
 *
 * Files land in os.tmpdir()/poc-auto-apply-cv and are later streamed back to
 * Skyvern Cloud via GET /api/poc-auto-apply/cv/[id].
 */

const CV_DIR = path.join(os.tmpdir(), 'poc-auto-apply-cv')
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

/** Allowed CV extensions → canonical Content-Type. */
const ALLOWED: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/** Strip anything that isn't a safe filename char, preserving readability. */
function sanitizeName(name: string): string {
  const base = path.basename(name)
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_')
  return cleaned.length > 0 ? cleaned : 'cv'
}

export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse(
      'INVALID_BODY',
      'Request body must be valid multipart/form-data.',
      400,
    )
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return errorResponse(
      'MISSING_FILE',
      'A "file" field containing the CV is required.',
      400,
    )
  }

  const originalName = file.name || 'cv'
  const ext = path.extname(originalName).toLowerCase()
  const contentType = ALLOWED[ext]
  if (!contentType) {
    return errorResponse(
      'UNSUPPORTED_FILE_TYPE',
      'CV must be a .pdf, .doc, or .docx file.',
      400,
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.byteLength === 0) {
    return errorResponse('EMPTY_FILE', 'The uploaded file is empty.', 400)
  }
  if (buffer.byteLength > MAX_BYTES) {
    return errorResponse(
      'FILE_TOO_LARGE',
      'CV exceeds the 10MB size limit.',
      400,
    )
  }

  const cvId = `${randomUUID()}__${sanitizeName(originalName)}`

  try {
    await mkdir(CV_DIR, { recursive: true })
    await writeFile(path.join(CV_DIR, cvId), buffer)
  } catch {
    return errorResponse(
      'STORAGE_FAILED',
      'Failed to store the uploaded CV.',
      500,
    )
  }

  return NextResponse.json({
    cvId,
    fileName: sanitizeName(originalName),
    contentType,
  })
}
