import { classifySemanticType } from '@/lib/auto-apply/classify'
import { parseLeverUrl } from '@/lib/auto-apply/platform-detector'
import type { ApplicationQuestion } from '@/lib/auto-apply/types'

/**
 * Standard applicant fields returned by the Lever v0 postings API.
 *
 * The Lever public API (`api.lever.co/v0/postings/{site}/{postingId}?mode=json`)
 * returns posting metadata (title, description, categories, lists) but does NOT
 * expose custom application form questions. Those questions are only rendered in
 * the HTML apply page and would require a browser-automation step (Skyvern) to
 * extract. This extractor therefore:
 *
 *   1. Fetches the posting to verify it exists (throws on 404).
 *   2. Returns the fixed set of standard Lever applicant fields (name, email,
 *      phone, resume, current company, LinkedIn URL, GitHub URL, other website
 *      URL) — these appear on every Lever application form.
 *
 * Custom questions defined by the employer are NOT included here. They will be
 * picked up by Skyvern during the actual apply flow.
 */
export async function extractLeverQuestions(url: string): Promise<ApplicationQuestion[]> {
  const parsed = parseLeverUrl(url)
  if (!parsed) {
    throw new Error(
      `Could not parse a Lever site and posting id from URL: "${url}". ` +
        'Expected a path like /{site}/{postingId} where postingId is a UUID.',
    )
  }

  const { site, postingId } = parsed
  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}/${encodeURIComponent(postingId)}?mode=json`

  let upstream: Response
  try {
    upstream = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (err) {
    throw new Error(`Failed to reach the Lever API: ${String(err)}`)
  }

  if (!upstream.ok) {
    throw new Error(
      `Lever API responded with ${upstream.status} for site "${site}" posting "${postingId}".`,
    )
  }

  // Validate the response is parseable JSON (posting exists).
  try {
    await upstream.json()
  } catch {
    throw new Error('Lever API returned invalid JSON.')
  }

  // Standard Lever application fields — always present on every Lever apply form.
  const standardFields: Array<{ fieldKey: string; label: string; fieldType: 'text' | 'textarea' | 'file' }> =
    [
      { fieldKey: 'name', label: 'Full name', fieldType: 'text' },
      { fieldKey: 'email', label: 'Email', fieldType: 'text' },
      { fieldKey: 'phone', label: 'Phone', fieldType: 'text' },
      { fieldKey: 'resume', label: 'Resume/CV', fieldType: 'file' },
      { fieldKey: 'org', label: 'Current company', fieldType: 'text' },
      { fieldKey: 'urls[linkedin]', label: 'LinkedIn URL', fieldType: 'text' },
      { fieldKey: 'urls[github]', label: 'GitHub URL', fieldType: 'text' },
      { fieldKey: 'urls[other]', label: 'Other website', fieldType: 'text' },
    ]

  return standardFields.map((f, i) => ({
    fieldKey: f.fieldKey,
    label: f.label,
    fieldType: f.fieldType,
    semanticType: classifySemanticType(f.fieldKey, f.label, f.fieldType),
    required: f.fieldKey === 'name' || f.fieldKey === 'email' || f.fieldKey === 'resume',
    position: i,
    source: 'api' as const,
  }))
}
