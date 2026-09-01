import OpenAI from 'openai'

/**
 * Lazy shared OpenAI client.
 *
 * `new OpenAI(...)` THROWS at construction when no API key is available, so a
 * module-level `const openai = new OpenAI(...)` crashes `next build`'s
 * page-data collection in any environment without OPENAI_API_KEY (this broke
 * every Vercel Preview build). The Proxy defers construction to the first
 * actual use at request time, same pattern as the lazy Resend client.
 */
let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const real = getClient()
    const value = real[prop as keyof OpenAI]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})
