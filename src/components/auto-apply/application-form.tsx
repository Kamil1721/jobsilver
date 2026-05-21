'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PhoneField } from '@/components/auto-apply/phone-field'
import type { PrefilledQuestion } from '@/lib/auto-apply/types'

interface ApplicationFormProps {
  jobId: string
}

type UnsupportedReason = 'no_url' | 'unsupported_ats' | 'extraction_failed'

interface QuestionsResponse {
  supported: boolean
  reason?: UnsupportedReason
  ats?: 'greenhouse' | 'lever' | 'ashby'
  questions?: PrefilledQuestion[]
  savedAnswers?: Record<string, string | string[]>
}

type AnswerValue = string | string[]

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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

export function ApplicationForm({ jobId }: ApplicationFormProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [response, setResponse] = useState<QuestionsResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

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

  // --- Save -----------------------------------------------------------------
  const handleSave = useCallback(async () => {
    setSaveState('saving')
    setSaveError(null)

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

    try {
      const res = await fetch(`/api/auto-apply/${jobId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: serialized }),
      })
      if (!res.ok) {
        setSaveState('error')
        setSaveError('Failed to save your answers — try again.')
        return
      }
      setSaveState('saved')
    } catch {
      setSaveState('error')
      setSaveError('Network error while saving — try again.')
    }
  }, [answers, jobId, questions])

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
              ) : q.semanticType === 'file' ? (
                <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Your profile CV will be used as the résumé.
                </p>
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
          <Button type="button" variant="secondary" disabled>
            Apply (coming soon)
          </Button>
          {saveState === 'error' && (
            <span className="text-sm text-destructive">
              {saveError ?? 'Failed to save — try again.'}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
