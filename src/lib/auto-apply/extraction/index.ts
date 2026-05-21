import { computePostingKey, detectAts } from '@/lib/auto-apply/platform-detector'
import type { ExtractionResult } from '@/lib/auto-apply/types'
import { extractAshbyQuestions } from './ashby'
import { extractGreenhouseQuestions } from './greenhouse'
import { extractLeverQuestions } from './lever'

export { extractAshbyQuestions } from './ashby'
export { extractGreenhouseQuestions } from './greenhouse'
export { extractLeverQuestions } from './lever'

/** Thrown when a URL does not belong to a supported ATS platform. */
export class UnsupportedAtsError extends Error {
  readonly platform: string

  constructor(url: string) {
    super(`No supported ATS extractor for URL: "${url}"`)
    this.name = 'UnsupportedAtsError'
    this.platform = 'other'
    // Restore prototype chain for instanceof checks across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Detect the ATS platform from `url`, dispatch to the matching extractor, and
 * return the normalized `ExtractionResult`.
 *
 * @throws {UnsupportedAtsError} when the URL is not a recognised ATS.
 * @throws {Error} when the upstream ATS API returns an error.
 */
export async function extractQuestions(url: string): Promise<ExtractionResult> {
  const platform = detectAts(url)

  if (platform === 'other') {
    throw new UnsupportedAtsError(url)
  }

  const postingKey = computePostingKey(url)

  let questions: ExtractionResult['questions']

  switch (platform) {
    case 'greenhouse':
      questions = await extractGreenhouseQuestions(url)
      break
    case 'lever':
      questions = await extractLeverQuestions(url)
      break
    case 'ashby':
      questions = await extractAshbyQuestions(url)
      break
    default: {
      // Exhaustiveness guard — TypeScript should catch this at compile time.
      const _never: never = platform
      throw new UnsupportedAtsError(url)
    }
  }

  return { postingKey, questions }
}
