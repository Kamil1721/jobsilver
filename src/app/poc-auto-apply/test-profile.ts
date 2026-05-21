/**
 * PoC: Auto-Apply — baked test profile + semantic auto-fill matcher.
 *
 * Self-contained. Does NOT touch Supabase / auth / existing feature code.
 *
 * `POC_TEST_PROFILE` is a FIXED SNAPSHOT of a real JobSilver profile, hard-coded
 * for the PoC. In production this data would be queried from the live `profiles`
 * table for the signed-in user — here it is a constant so the page stays
 * dependency-free and demoable without auth.
 */

export interface PocProfile {
  firstName: string
  lastName: string
  preferredName: string | null
  email: string
  phone: string
  location: string
  city: string
  country: string
  postcode: string
  linkedinUrl: string
  /** Notice period / start availability. */
  availability: string
  currentJobTitle: string
  /** GAP — never captured by JobSilver. Always null. */
  currentSalary: string | null
  /** GAP — never captured by JobSilver. Always null. */
  expectedSalary: string | null
}

export const POC_TEST_PROFILE: PocProfile = {
  firstName: 'Kamil',
  lastName: 'Borzecki',
  preferredName: null,
  email: 'borzeckikamil7@gmail.com',
  phone: '+48511390981',
  location: 'Krakow, Poland',
  city: 'Krakow',
  country: 'Poland',
  postcode: '30-392',
  linkedinUrl: 'https://www.linkedin.com/in/kamil-borzecki-40a593223/',
  availability: 'immediately', // notice period
  currentJobTitle: 'Expertise center support agent',
  currentSalary: null, // GAP — never captured
  expectedSalary: null, // GAP — never captured
}

// --- Matcher --------------------------------------------------------------

/**
 * Minimal shape the matcher needs from a normalized question. The page's
 * `NormalizedQuestion` is structurally compatible with this.
 */
export interface MatchableQuestion {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'file' | 'multiselect'
  required: boolean
  options?: { label: string; value: string }[]
}

export interface AutoFillResult {
  /** questionId → pre-filled answer string. Only contains genuine matches. */
  answers: Record<string, string>
  /** Ids of questions that were auto-filled from the profile. */
  filledIds: Set<string>
}

/** Mirrors the SelectItem value fallback used in the page render. */
function optionValue(opt: { value: string }, index: number): string {
  return opt.value || `option-${index}`
}

/**
 * Match each loaded question to a profile field by inspecting its Greenhouse
 * field name (`id`) and human `label`, case-insensitively. Anything without a
 * confident match (salary, cover letter, resume, …) is left untouched so the
 * genuine gaps stand out for the user to complete.
 */
export function autoFillAnswers(
  questions: MatchableQuestion[],
  profile: PocProfile,
): AutoFillResult {
  const answers: Record<string, string> = {}
  const filledIds = new Set<string>()

  const fill = (id: string, value: string | null | undefined) => {
    // Skip GAP fields (null) and anything that resolves to empty — the demo
    // depends on those staying visibly unfilled.
    if (value == null || value.trim().length === 0) return
    answers[id] = value
    filledIds.add(id)
  }

  for (const q of questions) {
    const id = q.id.toLowerCase()
    const label = q.label.trim().toLowerCase()

    if (q.type === 'select') {
      // Availability / notice-period select: pick the option whose label
      // best matches the profile's availability ("immediately").
      const isStartQuestion = ['start', 'notice', 'available'].some(
        (kw) => label.includes(kw),
      )
      if (isStartQuestion && q.options && q.options.length > 0) {
        const want = profile.availability.trim().toLowerCase()
        // Stem the wanted term ("immediately" → "immediate") so it matches
        // option labels like "Immediately" or "Available immediately".
        const wantStem = want.replace(/ly$/, '')
        const match =
          q.options.find((o) => o.label.trim().toLowerCase() === want) ??
          q.options.find((o) =>
            o.label.trim().toLowerCase().includes(wantStem),
          ) ??
          q.options.find((o) =>
            wantStem.includes(o.label.trim().toLowerCase()),
          )
        if (match) {
          const idx = q.options.indexOf(match)
          fill(q.id, optionValue(match, idx))
        }
      }
      continue
    }

    // Plain text fields — exact id / label rules.
    if (id === 'first_name' || label === 'first name') {
      fill(q.id, profile.firstName)
    } else if (id === 'last_name' || label === 'last name') {
      fill(q.id, profile.lastName)
    } else if (id === 'preferred_name' || label.includes('preferred')) {
      // Skipped automatically when preferredName is null.
      fill(q.id, profile.preferredName)
    } else if (id === 'email' || label === 'email') {
      fill(q.id, profile.email)
    } else if (id === 'phone' || label === 'phone') {
      fill(q.id, profile.phone)
    } else if (id.includes('linkedin') || label.includes('linkedin')) {
      fill(q.id, profile.linkedinUrl)
    }
    // Everything else (salary / "Cost to Company", cover letter, resume, …)
    // is intentionally left unfilled.
  }

  return { answers, filledIds }
}
