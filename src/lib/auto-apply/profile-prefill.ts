import type { ApplicationQuestion, PrefilledQuestion } from '@/lib/auto-apply/types'
import type { Profile, ScreeningAnswers } from '@/lib/supabase/types'

/**
 * Match each question to a profile field by inspecting its `fieldKey` and
 * `label`, case-insensitively. Only fields that can be filled with confidence
 * are matched — salary, cover letter, and file uploads are intentionally left
 * unmatched so they remain visible to the user.
 *
 * Handles a profile whose `screening_answers` is `null` or missing gracefully.
 */
export function prefillFromProfile(
  questions: ApplicationQuestion[],
  profile: Profile,
): PrefilledQuestion[] {
  const sa: ScreeningAnswers | null = profile.screening_answers ?? null

  const fill = (value: string | null | undefined): string | undefined => {
    if (value == null || value.trim().length === 0) return undefined
    return value
  }

  return questions.map((q): PrefilledQuestion => {
    const keyLower = q.fieldKey.toLowerCase()
    const labelLower = q.label.trim().toLowerCase()

    let prefilledValue: string | undefined

    // --- Select questions: only match availability/notice-period ---
    if (q.fieldType === 'select') {
      const isStartQuestion = ['start', 'notice', 'availab'].some((kw) =>
        labelLower.includes(kw),
      )
      if (isStartQuestion && sa?.availability && q.options && q.options.length > 0) {
        const want = sa.availability.trim().toLowerCase()
        // Stem "immediately" → "immediate" etc. for fuzzy label matching
        const wantStem = want.replace(/ly$/, '')

        const match =
          q.options.find((o) => o.label.trim().toLowerCase() === want) ??
          q.options.find((o) => o.label.trim().toLowerCase().includes(wantStem)) ??
          q.options.find((o) => wantStem.includes(o.label.trim().toLowerCase()))

        if (match) {
          // Only use the option value if it is non-empty; skip rather than
          // fabricate a placeholder ("option-N").
          const optValue = match.value.trim()
          if (optValue.length > 0) {
            prefilledValue = optValue
          }
        }
      }

      return prefilledValue != null
        ? { ...q, prefilledValue, prefilledFromProfile: true }
        : { ...q, prefilledFromProfile: false }
    }

    // --- Text-like fields ---

    // First name
    if (keyLower === 'first_name' || labelLower === 'first name') {
      prefilledValue = fill(sa?.first_name)
    }
    // Last name
    else if (keyLower === 'last_name' || labelLower === 'last name') {
      prefilledValue = fill(sa?.last_name)
    }
    // Email
    else if (keyLower === 'email' || labelLower === 'email') {
      prefilledValue = fill(profile.email)
    }
    // Phone — matched via semanticType (not label/key), per spec
    else if (q.semanticType === 'phone') {
      prefilledValue = fill(profile.phone)
    }
    // LinkedIn
    else if (keyLower.includes('linkedin') || labelLower.includes('linkedin')) {
      prefilledValue = fill(sa?.linkedin_url)
    }
    // Everything else (salary, cover letter, resume/file, …) — no match

    return prefilledValue != null
      ? { ...q, prefilledValue, prefilledFromProfile: true }
      : { ...q, prefilledFromProfile: false }
  })
}
