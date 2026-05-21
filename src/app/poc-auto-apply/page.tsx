'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { POC_TEST_PROFILE, autoFillAnswers } from './test-profile'

/**
 * PoC: Auto-Apply — public, self-contained page.
 *
 * No Supabase, no auth, no existing feature code. Talks only to the three
 * /api/poc-auto-apply/* route handlers.
 */

const DEFAULT_JOB_URL =
  'https://job-boards.greenhouse.io/stockx/jobs/8465053002?gh_src=Blind'

type QuestionType = 'text' | 'textarea' | 'select' | 'file' | 'multiselect'

interface NormalizedQuestion {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options?: { label: string; value: string }[]
}

interface QuestionsResponse {
  jobTitle: string
  location: string
  questions: NormalizedQuestion[]
}

interface StatusResponse {
  status: string
  output: unknown
  screenshotUrls: string[]
  failureReason: string | null
}

type AnswerValue = string | string[]

interface CvUploadState {
  status: 'idle' | 'uploading' | 'uploaded' | 'error'
  cvId: string | null
  fileName: string | null
  error: string | null
}

const INITIAL_CV: CvUploadState = {
  status: 'idle',
  cvId: null,
  fileName: null,
  error: null,
}

const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'terminated',
  'timed_out',
  'canceled',
])

function extractError(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error
  ) {
    return String((payload.error as { message: unknown }).message)
  }
  return fallback
}

export default function PocAutoApplyPage() {
  const [jobUrl, setJobUrl] = useState(DEFAULT_JOB_URL)
  const [job, setJob] = useState<QuestionsResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  // Ids of questions pre-filled from POC_TEST_PROFILE — drives the "from
  // profile" badges. Values stay in `answers` and remain fully editable.
  const [prefilledIds, setPrefilledIds] = useState<Set<string>>(new Set())
  // PoC simplification: a single CV upload is shared by all file-type
  // questions (Greenhouse application forms have at most one resume field).
  const [cv, setCv] = useState<CvUploadState>(INITIAL_CV)

  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questionsError, setQuestionsError] = useState<string | null>(null)

  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const [runId, setRunId] = useState<string | null>(null)
  const [appUrl, setAppUrl] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<StatusResponse | null>(null)
  const [polling, setPolling] = useState(false)

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stop polling if the user navigates away mid-run.
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  // --- Load questions -------------------------------------------------------
  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true)
    setQuestionsError(null)
    setJob(null)
    setAnswers({})
    setPrefilledIds(new Set())
    setCv(INITIAL_CV)
    setRunId(null)
    setAppUrl(null)
    setRunStatus(null)

    try {
      const res = await fetch(
        `/api/poc-auto-apply/questions?jobUrl=${encodeURIComponent(jobUrl)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setQuestionsError(extractError(data, 'Failed to load questions.'))
        return
      }
      const loaded = data as QuestionsResponse
      setJob(loaded)
      // Seed answers from the baked profile. Pre-filled values land in the
      // same `answers` state as user input, so they stay fully editable.
      const { answers: prefilled, filledIds } = autoFillAnswers(
        loaded.questions,
        POC_TEST_PROFILE,
      )
      setAnswers(prefilled)
      setPrefilledIds(filledIds)
    } catch {
      setQuestionsError('Network error while loading questions.')
    } finally {
      setLoadingQuestions(false)
    }
  }, [jobUrl])

  // --- Answer helpers -------------------------------------------------------
  const setAnswer = (id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const toggleMultiAnswer = (id: string, value: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : []
      const next = checked
        ? [...current, value]
        : current.filter((v) => v !== value)
      return { ...prev, [id]: next }
    })
  }

  // --- CV upload ------------------------------------------------------------
  const handleCvUpload = useCallback(async (file: File) => {
    setCv({ status: 'uploading', cvId: null, fileName: file.name, error: null })

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/poc-auto-apply/cv-upload', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        setCv({
          status: 'error',
          cvId: null,
          fileName: file.name,
          error: extractError(data, 'Failed to upload the CV.'),
        })
        return
      }
      const { cvId, fileName } = data as { cvId: string; fileName: string }
      setCv({ status: 'uploaded', cvId, fileName, error: null })
    } catch {
      setCv({
        status: 'error',
        cvId: null,
        fileName: file.name,
        error: 'Network error while uploading the CV.',
      })
    }
  }, [])

  // --- Status polling -------------------------------------------------------
  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(
        `/api/poc-auto-apply/status?runId=${encodeURIComponent(id)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setApplyError(extractError(data, 'Failed to fetch run status.'))
        setPolling(false)
        return
      }
      const status = data as StatusResponse
      setRunStatus(status)

      if (TERMINAL_STATUSES.has(status.status)) {
        setPolling(false)
        return
      }
      pollTimer.current = setTimeout(() => pollStatus(id), 5000)
    } catch {
      pollTimer.current = setTimeout(() => pollStatus(id), 5000)
    }
  }, [])

  // --- Apply ----------------------------------------------------------------
  const handleApply = useCallback(async () => {
    if (!job) return
    setApplying(true)
    setApplyError(null)
    setRunId(null)
    setAppUrl(null)
    setRunStatus(null)
    if (pollTimer.current) clearTimeout(pollTimer.current)

    // Flatten answers: multiselect arrays → comma-joined strings.
    // file-type questions are excluded — the CV is sent separately as cvId.
    const fileQuestionIds = new Set(
      job.questions.filter((q) => q.type === 'file').map((q) => q.id),
    )
    const flat: Record<string, string> = {}
    for (const [id, value] of Object.entries(answers)) {
      if (fileQuestionIds.has(id)) continue
      const str = Array.isArray(value) ? value.join(', ') : value
      if (str && str.trim().length > 0) flat[id] = str
    }

    try {
      const res = await fetch('/api/poc-auto-apply/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl,
          answers: flat,
          ...(cv.cvId
            ? { cvId: cv.cvId, origin: window.location.origin }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApplyError(extractError(data, 'Failed to start the Skyvern run.'))
        return
      }
      const { runId: newRunId, appUrl: newAppUrl } = data as {
        runId: string
        appUrl: string | null
      }
      setRunId(newRunId)
      setAppUrl(newAppUrl)
      setPolling(true)
      pollTimer.current = setTimeout(() => pollStatus(newRunId), 5000)
    } catch {
      setApplyError('Network error while starting the Skyvern run.')
    } finally {
      setApplying(false)
    }
  }, [job, jobUrl, answers, cv.cvId, pollStatus])

  // --- Render ---------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Auto-Apply PoC</h1>
          <p className="text-sm text-muted-foreground">
            Load a Greenhouse job, fill its application questions, and hand the
            form to Skyvern in fill-only mode (it will never submit).
          </p>
        </header>

        {/* Job URL input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Job posting</CardTitle>
            <CardDescription>
              Paste a Greenhouse job URL, then load its questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="job-url">Job URL</Label>
              <Input
                id="job-url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://job-boards.greenhouse.io/{board}/jobs/{id}"
              />
            </div>
            <Button onClick={loadQuestions} disabled={loadingQuestions || !jobUrl.trim()}>
              {loadingQuestions ? 'Loading…' : 'Load questions'}
            </Button>
            {questionsError && (
              <p className="text-sm text-destructive">{questionsError}</p>
            )}
          </CardContent>
        </Card>

        {/* Questions form */}
        {job && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. {job.jobTitle}</CardTitle>
              <CardDescription>{job.location}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {job.questions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No application questions were returned for this job.
                </p>
              )}

              {job.questions.length > 0 && (
                <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {prefilledIds.size}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-foreground">
                    {job.questions.length}
                  </span>{' '}
                  fields pre-filled from your JobSilver profile — fill the rest.
                </p>
              )}

              {job.questions.map((q) => (
                <div key={q.id} className="space-y-1.5">
                  <Label htmlFor={`q-${q.id}`}>
                    {q.label}
                    {q.required && (
                      <span className="ml-1 text-destructive" aria-hidden>
                        *
                      </span>
                    )}
                    {prefilledIds.has(q.id) && (
                      <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        from profile
                      </span>
                    )}
                  </Label>

                  {q.type === 'text' && (
                    <Input
                      id={`q-${q.id}`}
                      value={(answers[q.id] as string) ?? ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                  )}

                  {q.type === 'textarea' && (
                    <Textarea
                      id={`q-${q.id}`}
                      value={(answers[q.id] as string) ?? ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                  )}

                  {q.type === 'select' && (
                    <Select
                      value={(answers[q.id] as string) ?? ''}
                      onValueChange={(value) => setAnswer(q.id, value)}
                    >
                      <SelectTrigger id={`q-${q.id}`}>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {(q.options ?? []).map((opt, i) => (
                          <SelectItem
                            key={`${opt.value}-${i}`}
                            value={opt.value || `option-${i}`}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {q.type === 'multiselect' && (
                    <div className="space-y-2 pt-1">
                      {(q.options ?? []).map((opt, i) => {
                        const selected = Array.isArray(answers[q.id])
                          ? (answers[q.id] as string[])
                          : []
                        const optValue = opt.value || `option-${i}`
                        return (
                          <div
                            key={`${opt.value}-${i}`}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              id={`q-${q.id}-${i}`}
                              checked={selected.includes(optValue)}
                              onCheckedChange={(checked) =>
                                toggleMultiAnswer(
                                  q.id,
                                  optValue,
                                  checked === true,
                                )
                              }
                            />
                            <Label
                              htmlFor={`q-${q.id}-${i}`}
                              className="font-normal"
                            >
                              {opt.label}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {q.type === 'file' && (
                    <div className="space-y-2">
                      <Input
                        id={`q-${q.id}`}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        disabled={cv.status === 'uploading'}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleCvUpload(file)
                        }}
                        className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium"
                      />
                      {cv.status === 'uploading' && (
                        <p className="text-sm text-muted-foreground">
                          Uploading {cv.fileName}…
                        </p>
                      )}
                      {cv.status === 'uploaded' && (
                        <p className="text-sm font-medium text-emerald-600">
                          ✓ uploaded — {cv.fileName}
                        </p>
                      )}
                      {cv.status === 'error' && (
                        <p className="text-sm text-destructive">
                          {cv.error ?? 'Upload failed.'}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        PDF, DOC, or DOCX up to 10MB. Pick a new file to
                        replace it.
                      </p>
                    </div>
                  )}
                </div>
              ))}

              <Button
                onClick={handleApply}
                disabled={
                  applying ||
                  job.questions.length === 0 ||
                  cv.status === 'uploading'
                }
                className="w-full"
              >
                {applying
                  ? 'Starting Skyvern…'
                  : cv.status === 'uploading'
                    ? 'Waiting for CV upload…'
                    : 'Apply with Skyvern'}
              </Button>
              {applyError && (
                <p className="text-sm text-destructive">{applyError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Run status */}
        {runId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Skyvern run</CardTitle>
              <CardDescription>
                Run <code className="font-mono">{runId}</code>
                {polling && ' — polling every 5s…'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">
                  {runStatus?.status ?? 'queued'}
                </span>
              </div>

              {appUrl && (
                <a
                  href={appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-primary underline underline-offset-4"
                >
                  Open run in Skyvern →
                </a>
              )}

              {runStatus?.failureReason && (
                <p className="text-sm text-destructive">
                  Failure: {runStatus.failureReason}
                </p>
              )}

              {runStatus?.status === 'completed' && runStatus.output != null && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Read-back values</p>
                  <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(runStatus.output, null, 2)}
                  </pre>
                </div>
              )}

              {runStatus?.screenshotUrls?.[0] && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Screenshot</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={runStatus.screenshotUrls[0]}
                    alt="Skyvern run screenshot"
                    className="w-full rounded-md border"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
