import { readFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PoC: Auto-Apply — stream a previously uploaded CV back out.
 *
 * Self-contained. Does NOT touch Supabase / auth / existing feature code.
 *
 * GET /api/poc-auto-apply/cv/[id]
 * Serves the file stored by /api/poc-auto-apply/cv-upload so Skyvern Cloud
 * can download it over the public Cloudflare tunnel origin.
 */

const CV_DIR = path.join(os.tmpdir(), 'poc-auto-apply-cv')

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id

  // Path-traversal guard: reject obviously dangerous ids outright.
  if (
    !id ||
    id.includes('/') ||
    id.includes('\\') ||
    id.includes('..') ||
    id.includes('\0')
  ) {
    return errorResponse('INVALID_ID', 'The requested CV id is invalid.', 400)
  }

  const filePath = path.join(CV_DIR, id)

  // Belt-and-suspenders: ensure the resolved path stays inside CV_DIR.
  const resolvedDir = path.resolve(CV_DIR)
  if (!path.resolve(filePath).startsWith(resolvedDir + path.sep)) {
    return errorResponse('INVALID_ID', 'The requested CV id is invalid.', 400)
  }

  let buffer: Buffer
  try {
    buffer = await readFile(filePath)
  } catch {
    return errorResponse('CV_NOT_FOUND', 'No CV exists for that id.', 404)
  }

  const ext = path.extname(id).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  // The stored id is `${uuid}__${originalName}` — recover the readable part.
  const sepIndex = id.indexOf('__')
  const downloadName = sepIndex >= 0 ? id.slice(sepIndex + 2) : id

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      'Content-Disposition': `inline; filename="${downloadName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
