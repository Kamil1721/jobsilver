'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'
import { PhoneField } from '@/components/auto-apply/phone-field'
import type { PrefilledQuestion } from '@/lib/auto-apply/types'

interface ApplicationFormProps {
  jobId: string
  company?: string
}

type UnsupportedReason = 'no_url' | 'unsupported_ats' | 'extraction_failed'

interface QuestionsResponse {
  supported: boolean
  reason?: UnsupportedReason
  ats?: 'greenhouse' | 'lever' | 'ashby'
  questions?: PrefilledQuestion[]
  savedAnswers?: Record<string, string | string[]>
  profileCv?: { fileName: string } | null
}

type AnswerValue = string | string[]

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Submission status as reported by the apply/status endpoint. */
type SubmissionStatus =
  | 'none'
  | 'draft'
  | 'submitting'
  | 'applied'
  | 'failed'
  | 'failed_verification'

interface StatusResponse {
  status: SubmissionStatus
  screenshotUrl?: string | null
  failureReason?: string | null
  appUrl?: string | null
}

const POLL_INTERVAL_MS = 5000

const UNSUPPORTED_MESSAGES: Record<UnsupportedReason, string> = {
  no_url: 'No application link for this job.',
  unsupported_ats:
    "This job's site isn't supported for in-app applications yet — apply on the company site.",
  extraction_failed: "Couldn't load the application form — try again later.",
}

/** A multiselect answer is stored as an array; everything else as a string. */
function isMultiselect(q: PrefilledQuestion): boolean {
  return q.fieldType === 'multiselect'
}

/** Seed a question's initial answer from a saved draft, else the prefill. */
function seedAnswer(
  q: PrefilledQuestion,
  savedAnswers: Record<string, string | string[]>,
): AnswerValue {
  const raw = savedAnswers[q.fieldKey] ?? q.prefilledValue ?? ''
  if (isMultiselect(q)) {
    // Saved drafts store multiselect as a JSON array; prefill is always a string.
    if (Array.isArray(raw)) return raw
    return raw ? [raw] : []
  }
  return Array.isArray(raw) ? raw.join(', ') : raw
}

export function ApplicationForm({ jobId, company }: ApplicationFormProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [response, setResponse] = useState<QuestionsResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // --- Submission (apply) state ---------------------------------------------
  const [submission, setSubmission] = useState<StatusResponse | null>(null)
  /** True from click until the first status response — guards against double-submit. */
  const [submitPending, setSubmitPending] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Load questions on mount ---------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/auto-apply/${jobId}/questions`)
        const data = (await res.json()) as QuestionsResponse
        if (cancelled) return
        if (!res.ok) {
          setLoadError("Couldn't load the application form — try again later.")
          return
        }
        setResponse(data)
        if (data.supported && data.questions) {
          const savedAnswers = data.savedAnswers ?? {}
          const seeded: Record<string, AnswerValue> = {}
          for (const q of data.questions) {
            seeded[q.fieldKey] = seedAnswer(q, savedAnswers)
          }
          setAnswers(seeded)
        }
      } catch {
        if (!cancelled) {
          setLoadError("Couldn't load the application form — try again later.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [jobId])

  // --- Sorted questions -----------------------------------------------------
  const questions = useMemo(() => {
    if (!response?.supported || !response.questions) return []
    return [...response.questions].sort((a, b) => a.position - b.position)
  }, [response])

  const prefilledCount = useMemo(
    () => questions.filter((q) => q.prefilledFromProfile).length,
    [questions],
  )

  // --- Answer helpers -------------------------------------------------------
  const setAnswer = (key: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setSaveState('idle')
  }

  const toggleMultiAnswer = (key: string, value: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : []
      const next = checked
        ? [...current, value]
        : current.filter((v) => v !== value)
      return { ...prev, [key]: next }
    })
    setSaveState('idle')
  }

  // --- Persist answers (shared by Save and Apply flows) ---------------------
  /** Serialize the current answers and PUT them. Returns true on success. */
  const persistAnswers = useCallback(async (): Promise<boolean> => {
    // File-type questions are excluded; multiselect arrays are sent as-is (JSON arrays).
    const fileKeys = new Set(
      questions.filter((q) => q.fieldType === 'file').map((q) => q.fieldKey),
    )
    const serialized: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(answers)) {
      if (fileKeys.has(key)) continue
      if (Array.isArray(value)) {
        if (value.length > 0) serialized[key] = value
      } else if (value && value.trim().length > 0) {
        serialized[key] = value
      }
    }

    const res = await fetch(`/api/auto-apply/${jobId}/answers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: serialized }),
    })
    return res.ok
  }, [answers, jobId, questions])

  // --- Save -----------------------------------------------------------------
  const handleSave = useCallback(async () => {
    setSaveState('saving')
    setSaveError(null)
    try {
      const ok = await persistAnswers()
      if (!ok) {
        setSaveState('error')
        setSaveError('Failed to save your answers — try again.')
        return
      }
      setSaveState('saved')
    } catch {
      setSaveState('error')
      setSaveError('Network error while saving — try again.')
    }
  }, [persistAnswers])

  // --- Submission status polling -------------------------------------------
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  /** Fetch the current submission status once; stop polling on a terminal state. */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/auto-apply/${jobId}/status`)
      if (!res.ok) return
      const data = (await res.json()) as StatusResponse
      setSubmission(data)
      if (data.status !== 'submitting') {
        stopPolling()
      }
    } catch {
      // Transient error — keep polling, the next tick may succeed.
    }
  }, [jobId, stopPolling])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(() => {
      void fetchStatus()
    }, POLL_INTERVAL_MS)
  }, [fetchStatus])

  // On mount: read current submission state so an in-flight/finished run shows up.
  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      try {
        const res = await fetch(`/api/auto-apply/${jobId}/status`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as StatusResponse
        if (cancelled) return
        setSubmission(data)
        if (data.status === 'submitting') startPolling()
      } catch {
        // Non-critical — the user can still trigger Apply.
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [jobId, startPolling])

  // Clean up the poll interval on unmount.
  useEffect(() => stopPolling, [stopPolling])

  // --- Apply ----------------------------------------------------------------
  const handleApply = useCallback(async () => {
    setApplyError(null)
    setSubmitPending(true)
    try {
      // 1. Persist the latest edits before submitting.
      const saved = await persistAnswers()
      if (!saved) {
        setApplyError('Failed to save your answers — try again.')
        return
      }

      // 2. Trigger the real Skyvern submission.
      const res = await fetch(`/api/auto-apply/${jobId}/apply`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        setApplyError(
          data?.error?.message ?? 'Could not start the application — try again.',
        )
        return
      }

      // 3. Reflect submitting state and begin polling for the result.
      setSubmission({
        status: 'submitting',
        appUrl: data.appUrl ?? null,
        screenshotUrl: null,
        failureReason: null,
      })
      startPolling()
    } catch {
      setApplyError('Network error while submitting — try again.')
    } finally {
      setSubmitPending(false)
    }
  }, [jobId, persistAnswers, startPolling])

  const submissionStatus = submission?.status ?? 'none'
  const applyDisabled =
    submitPending ||
    submissionStatus === 'submitting' ||
    submissionStatus === 'applied'

  // --- Render: loading ------------------------------------------------------
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading application form…
      </p>
    )
  }

  // --- Render: load error ---------------------------------------------------
  if (loadError) {
    return (
      <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {loadError}
      </p>
    )
  }

  // --- Render: unsupported --------------------------------------------------
  if (response && !response.supported) {
    const message = response.reason
      ? UNSUPPORTED_MESSAGES[response.reason]
      : "Couldn't load the application form — try again later."
    return (
      <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {message}
      </p>
    )
  }

  // --- Render: supported form ----------------------------------------------
  return (
    <div className="space-y-5">
      <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{prefilledCount}</span> of{' '}
        <span className="font-medium text-foreground">{questions.length}</span>{' '}
        fields filled from your profile — fill in the rest.
      </p>

      {/* C2: Lever-specific disclosure — custom screening questions aren't available in advance */}
      {response?.ats === 'lever' && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Note: this employer&apos;s custom screening questions aren&apos;t available in advance for Lever
          postings — only standard fields are shown here.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave()
        }}
        className="space-y-5"
      >
        {questions.map((q) => {
          const fieldId = `aa-${q.fieldKey}`
          const stringValue = (answers[q.fieldKey] as string) ?? ''
          const arrayValue = Array.isArray(answers[q.fieldKey])
            ? (answers[q.fieldKey] as string[])
            : []

          return (
            <div key={q.fieldKey} className="space-y-1.5">
              <Label htmlFor={fieldId}>
                {q.label}
                {q.required && (
                  <span className="ml-1 text-destructive" aria-hidden>
                    *
                  </span>
                )}
                {q.prefilledFromProfile && (
                  <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    from profile
                  </span>
                )}
              </Label>

              {/* textarea takes precedence over semanticType for the base type */}
              {q.fieldType === 'textarea' ? (
                <Textarea
                  id={fieldId}
                  value={stringValue}
                  required={q.required}
                  onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                />
              ) : q.fieldType === 'multiselect' ? (
                <div className="space-y-2 pt-1">
                  {(q.options ?? []).map((opt, i) => {
                    const optValue = opt.value || `option-${i}`
                    return (
                      <div
                        key={`${opt.value}-${i}`}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={`${fieldId}-${i}`}
                          checked={arrayValue.includes(optValue)}
                          onCheckedChange={(checked) =>
                            toggleMultiAnswer(q.fieldKey, optValue, checked === true)
                          }
                        />
                        <Label htmlFor={`${fieldId}-${i}`} className="font-normal">
                          {opt.label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              ) : q.semanticType === 'phone' ? (
                <PhoneField
                  id={fieldId}
                  value={stringValue}
                  required={q.required}
                  onChange={(v) => setAnswer(q.fieldKey, v)}
                />
              ) : q.semanticType === 'select' ? (
                <Select
                  value={stringValue}
                  onValueChange={(value) => setAnswer(q.fieldKey, value)}
                >
                  <SelectTrigger id={fieldId}>
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
              ) : q.fieldType === 'file' ? (
                /cover[_ ]?letter/i.test(q.label + ' ' + q.fieldKey) ? (
                  <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Optional — not included.
                  </p>
                ) : response?.profileCv ? (
                  <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                    <span aria-hidden>✓</span>{' '}
                    <span className="font-medium">{response.profileCv.fileName}</span>
                    {' '}— attached from your profile
                  </p>
                ) : (
                  <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    No CV on your profile — add one in your profile settings.
                  </p>
                )
              ) : (
                <Input
                  id={fieldId}
                  type={
                    q.semanticType === 'email'
                      ? 'email'
                      : q.semanticType === 'url'
                        ? 'url'
                        : q.semanticType === 'date'
                          ? 'date'
                          : q.semanticType === 'number'
                            ? 'number'
                            : 'text'
                  }
                  value={stringValue}
                  required={q.required}
                  onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                />
              )}
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={saveState === 'saving'}>
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved'
                : 'Save'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="secondary" disabled={applyDisabled}>
                {submissionStatus === 'submitting'
                  ? 'Submitting…'
                  : submissionStatus === 'applied'
                    ? 'Submitted'
                    : 'Apply with Skyvern'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit this application?</AlertDialogTitle>
                <AlertDialogDescription>
                  Skyvern will fill out and submit a real application
                  {company ? ` to ${company}` : ''} on the employer&apos;s website,
                  using your saved answers and your profile CV. This actually
                  applies — it can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleApply()}>
                  Yes, submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {saveState === 'error' && (
            <span className="text-sm text-destructive">
              {saveError ?? 'Failed to save — try again.'}
            </span>
          )}
          {applyError && (
            <span className="text-sm text-destructive">{applyError}</span>
          )}
        </div>
      </form>

      <SubmissionPanel submission={submission} />
    </div>
  )
}

/** Renders the current submission state below the form. */
function SubmissionPanel({
  submission,
}: {
  submission: StatusResponse | null
}) {
  if (!submission) return null
  const { status, screenshotUrl, failureReason, appUrl } = submission

  if (status === 'none' || status === 'draft') return null

  const screenshot = screenshotUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={screenshotUrl}
      alt="Application form screenshot"
      className="mt-3 w-full rounded-md border border-border"
    />
  ) : null

  if (status === 'submitting') {
    return (
      <div className="rounded-md border border-border bg-muted/50 px-3 py-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>
            Submitting your application via Skyvern… this can take 1–5 minutes.
          </span>
        </div>
        {appUrl && (
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-2"
          >
            Watch the run
          </a>
        )}
      </div>
    )
  }

  if (status === 'applied') {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
        <p className="font-medium text-emerald-700 dark:text-emerald-400">
          ✓ Application submitted.
        </p>
        {screenshot}
      </div>
    )
  }

  if (status === 'failed_verification') {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Submission stopped — the form could not be verified, so nothing was
          submitted.
        </p>
        {failureReason && (
          <p className="mt-1 text-muted-foreground">{failureReason}</p>
        )}
        {screenshot}
      </div>
    )
  }

  // status === 'failed'
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm">
      <p className="font-medium text-destructive">Submission failed.</p>
      {failureReason && (
        <p className="mt-1 text-muted-foreground">{failureReason}</p>
      )}
      {screenshot}
    </div>
  )
}
