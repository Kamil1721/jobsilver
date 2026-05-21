'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'

export interface ResumeInfo {
  source: 'profile' | 'override'
  fileName: string
  viewUrl: string
}

interface ResumeFieldProps {
  jobId: string
  /** Current resume state from the server (may be null if no profile CV and no override). */
  initialResume: ResumeInfo | null
}

type FieldState =
  | { mode: 'view'; resume: ResumeInfo }
  | { mode: 'upload' }
  | { mode: 'uploading' }
  | { mode: 'no-cv' }

function toFieldState(resume: ResumeInfo | null): FieldState {
  if (resume) return { mode: 'view', resume }
  return { mode: 'no-cv' }
}

export function ResumeField({ jobId, initialResume }: ResumeFieldProps) {
  const [state, setState] = useState<FieldState>(() => toFieldState(initialResume))
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setUploadError(null)
      setState({ mode: 'uploading' })

      try {
        const form = new FormData()
        form.append('file', file)

        const res = await fetch(`/api/auto-apply/${jobId}/resume`, {
          method: 'POST',
          body: form,
        })
        const data = await res.json()

        if (!res.ok || data?.error) {
          setUploadError(
            data?.error?.message ?? 'Upload failed — try again.',
          )
          // Revert to previous state.
          setState(toFieldState(initialResume))
          return
        }

        const newResume: ResumeInfo = data.resume
        setState({ mode: 'view', resume: newResume })
      } catch {
        setUploadError('Network error while uploading — try again.')
        setState(toFieldState(initialResume))
      } finally {
        // Reset the input so the same file can be re-selected after an error.
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [jobId, initialResume],
  )

  // ── Remove / revert handler ─────────────────────────────────────────────────
  const handleRemove = useCallback(
    async (currentResume: ResumeInfo) => {
      setUploadError(null)

      if (currentResume.source === 'override') {
        // DELETE the override → server reverts to profile CV.
        setState({ mode: 'uploading' })
        try {
          const res = await fetch(`/api/auto-apply/${jobId}/resume`, {
            method: 'DELETE',
          })
          const data = await res.json()

          if (!res.ok || data?.error) {
            setUploadError(
              data?.error?.message ?? 'Could not remove resume — try again.',
            )
            setState({ mode: 'view', resume: currentResume })
            return
          }

          const reverted: ResumeInfo | null = data.resume ?? null
          setState(toFieldState(reverted))
        } catch {
          setUploadError('Network error — try again.')
          setState({ mode: 'view', resume: currentResume })
        }
      } else {
        // source === 'profile': just switch to upload mode locally (no server call).
        setState({ mode: 'upload' })
      }
    },
    [jobId],
  )

  // ── Revert to profile CV ────────────────────────────────────────────────────
  const handleRevertToProfile = useCallback(() => {
    setUploadError(null)
    setState(toFieldState(initialResume))
  }, [initialResume])

  // ── Trigger file picker ──────────────────────────────────────────────────────
  const triggerPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (state.mode === 'uploading') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>Uploading…</span>
      </div>
    )
  }

  if (state.mode === 'view') {
    const { resume } = state
    const sourceLabel =
      resume.source === 'profile'
        ? '(from your profile)'
        : '(uploaded for this job)'

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
            ✓
          </span>
          <a
            href={resume.viewUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={
              resume.viewUrl
                ? 'font-medium text-primary underline underline-offset-2 hover:text-primary/80'
                : 'font-medium text-foreground'
            }
          >
            {resume.fileName}
          </a>
          <span className="text-muted-foreground">{sourceLabel}</span>
          <button
            type="button"
            aria-label="Remove resume"
            onClick={() => void handleRemove(resume)}
            className="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {uploadError && (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}
      </div>
    )
  }

  if (state.mode === 'upload') {
    // The user hit ✕ on their profile CV — they want to upload a custom file.
    return (
      <div className="space-y-1">
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={(e) => void handleFileChange(e)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={triggerPicker}
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Choose a file
            </button>
            <span className="text-muted-foreground">
              PDF, DOC or DOCX · max 10 MB
            </span>
          </div>
          {initialResume?.source === 'profile' && (
            <button
              type="button"
              onClick={handleRevertToProfile}
              className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Use my profile CV instead
            </button>
          )}
        </div>
        {uploadError && (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}
      </div>
    )
  }

  // mode === 'no-cv': no profile CV and no override.
  return (
    <div className="space-y-1">
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
        <p className="text-muted-foreground">
          No CV on your profile — upload one for this application.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="sr-only"
          onChange={(e) => void handleFileChange(e)}
        />
        <button
          type="button"
          onClick={triggerPicker}
          className="mt-1 font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        >
          Choose a file
        </button>
        <span className="ml-2 text-xs text-muted-foreground">
          PDF, DOC or DOCX · max 10 MB
        </span>
      </div>
      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}
    </div>
  )
}
