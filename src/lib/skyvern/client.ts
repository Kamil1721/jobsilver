/**
 * Skyvern Cloud API client.
 *
 * Base URL: SKYVERN_BASE_URL env var (defaults to https://api.skyvern.com).
 * Auth:     x-api-key header from SKYVERN_API_KEY env var.
 *
 * Env vars are read at call time — not at module load — so a missing key
 * does not crash imports.
 */

export interface CreateSkyvernTaskParams {
  url: string
  prompt: string
  title?: string
  maxSteps?: number
  dataExtractionSchema?: unknown
  webhookUrl?: string
}

export interface SkyvernTaskRun {
  runId: string
  status: string
  appUrl: string | null
}

export interface SkyvernRunResult {
  status: string
  output: unknown
  screenshotUrls: string[]
  failureReason: string | null
  appUrl: string | null
}

/** Terminal statuses — the run will not change state after reaching these. */
export function isTerminalStatus(status: string): boolean {
  return ['completed', 'failed', 'terminated', 'timed_out', 'canceled'].includes(status)
}

function baseUrl(): string {
  return (process.env.SKYVERN_BASE_URL ?? 'https://api.skyvern.com').replace(/\/$/, '')
}

function apiKey(): string {
  const key = process.env.SKYVERN_API_KEY
  if (!key) {
    throw new Error('SKYVERN_API_KEY is not set in the environment.')
  }
  return key
}

/**
 * Create a Skyvern task run.
 *
 * POSTs to POST /v1/run/tasks with engine set to "skyvern-2.0".
 * Throws if the API key is missing or the HTTP response is not ok.
 */
export async function createSkyvernTask(
  params: CreateSkyvernTaskParams,
): Promise<SkyvernTaskRun> {
  const key = apiKey()

  const body: Record<string, unknown> = {
    engine: 'skyvern-2.0',
    url: params.url,
    prompt: params.prompt,
  }
  if (params.title !== undefined) body.title = params.title
  if (params.maxSteps !== undefined) body.max_steps = params.maxSteps
  if (params.dataExtractionSchema !== undefined)
    body.data_extraction_schema = params.dataExtractionSchema
  if (params.webhookUrl !== undefined) body.webhook_url = params.webhookUrl

  const response = await fetch(`${baseUrl()}/v1/run/tasks`, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  let data: { run_id?: string; status?: string; app_url?: string } = {}
  try {
    data = (await response.json()) as typeof data
  } catch {
    // fall through — handled below
  }

  if (!response.ok) {
    throw new Error(
      `Skyvern API error on POST /v1/run/tasks: HTTP ${response.status} — ${JSON.stringify(data)}`,
    )
  }

  if (!data.run_id) {
    throw new Error(
      `Skyvern API did not return a run_id. Response: ${JSON.stringify(data)}`,
    )
  }

  return {
    runId: data.run_id,
    status: data.status ?? 'created',
    appUrl: data.app_url ?? null,
  }
}

/**
 * Fetch the current state of a Skyvern run.
 *
 * GETs /v1/runs/{run_id}.
 * Throws if the API key is missing or the HTTP response is not ok.
 */
export async function getSkyvernRun(runId: string): Promise<SkyvernRunResult> {
  const key = apiKey()

  const response = await fetch(
    `${baseUrl()}/v1/runs/${encodeURIComponent(runId)}`,
    {
      headers: { 'x-api-key': key },
      cache: 'no-store',
    },
  )

  let data: {
    status?: string
    output?: unknown
    screenshot_urls?: unknown
    failure_reason?: unknown
    app_url?: unknown
  } = {}
  try {
    data = (await response.json()) as typeof data
  } catch {
    // fall through — handled below
  }

  if (!response.ok) {
    throw new Error(
      `Skyvern API error on GET /v1/runs/${runId}: HTTP ${response.status} — ${JSON.stringify(data)}`,
    )
  }

  return {
    status: typeof data.status === 'string' ? data.status : 'unknown',
    output: data.output ?? null,
    screenshotUrls: Array.isArray(data.screenshot_urls) ? data.screenshot_urls : [],
    failureReason: typeof data.failure_reason === 'string' ? data.failure_reason : null,
    appUrl: typeof data.app_url === 'string' ? data.app_url : null,
  }
}
