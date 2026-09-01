"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { StickyNote, Save, Loader2, Check } from "lucide-react"

const MAX_NOTES_LENGTH = 50000

interface JobNotesProps {
  jobId: string
  initialNotes: string | null
  onNotesChange?: (notes: string) => void
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function JobNotes({ jobId, initialNotes, onNotesChange }: JobNotesProps) {
  const { toast } = useToast()
  const [notes, setNotes] = React.useState(initialNotes || '')
  const [savedNotes, setSavedNotes] = React.useState(initialNotes || '')
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle')

  // Refs for cleanup and preventing race conditions
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
  const resetTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const isMountedRef = React.useRef(true)
  const isSavingRef = React.useRef(false)
  const pendingNotesRef = React.useRef<string | null>(null)

  const hasUnsavedChanges = notes !== savedNotes

  // Sync with initialNotes prop changes (e.g., parent refetch)
  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setNotes(initialNotes || '')
      setSavedNotes(initialNotes || '')
    })
    return () => {
      cancelled = true
    }
  }, [initialNotes])

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  async function saveNotes(notesToSave: string) {
    if (!isMountedRef.current) return

    // Prevent concurrent saves - queue the latest value
    if (isSavingRef.current) {
      pendingNotesRef.current = notesToSave
      return
    }

    isSavingRef.current = true
    pendingNotesRef.current = null

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setSaveStatus('saving')
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesToSave || null }),
        signal: abortControllerRef.current.signal,
      })

      if (!isMountedRef.current) return

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save notes')
      }

      setSavedNotes(notesToSave)
      onNotesChange?.(notesToSave)

      // Only show "Saved" if current notes match what we just saved
      // This prevents showing "Saved" when user typed more during the save
      if (isMountedRef.current) {
        setSaveStatus('saved')

        // Clear any existing reset timeout
        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current)
        }

        // Reset status after 2 seconds
        resetTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSaveStatus('idle')
          }
        }, 2000)
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      if (!isMountedRef.current) return

      setSaveStatus('error')
      toast({
        variant: "destructive",
        title: "Failed to save notes",
        description: error instanceof Error ? error.message : "Please try again.",
      })

      // Reset error state after 3 seconds
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
      resetTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setSaveStatus('idle')
        }
      }, 3000)
    } finally {
      isSavingRef.current = false

      // If there's a pending save queued during this save, execute it now
      if (pendingNotesRef.current !== null && isMountedRef.current) {
        const pending = pendingNotesRef.current
        pendingNotesRef.current = null
        saveNotes(pending)
      }
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setNotes(newValue)

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Auto-save after 2 seconds of inactivity
    debounceRef.current = setTimeout(() => {
      saveNotes(newValue)
    }, 2000)
  }

  const handleBlur = () => {
    // Save immediately on blur if there are unsaved changes and not already saving
    if (notes !== savedNotes && !isSavingRef.current) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      saveNotes(notes)
    }
  }

  const handleManualSave = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    saveNotes(notes)
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <StickyNote className="w-3 h-3" />
          <h2 className="text-xs font-semibold">My Notes</h2>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && !hasUnsavedChanges && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
          {hasUnsavedChanges && saveStatus !== 'saving' && (
            <Button
              variant="outline"
              size="sm"
              className="h-5 text-[9px] px-1.5"
              onClick={handleManualSave}
            >
              <Save className="w-2.5 h-2.5 mr-0.5" />
              Save
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={notes}
        onChange={handleNotesChange}
        onBlur={handleBlur}
        maxLength={MAX_NOTES_LENGTH}
        placeholder="Add notes about this job... e.g., interview prep, application answers, contact info"
        className="min-h-[120px] text-[11px] resize-y"
      />
      <div className="flex items-center justify-between mt-1">
        <p className="text-[9px] text-muted-foreground">
          Notes are automatically saved after you stop typing.
        </p>
        {notes.length > 45000 && (
          <p className="text-[9px] text-amber-600 dark:text-amber-400">
            {notes.length.toLocaleString()} / {MAX_NOTES_LENGTH.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
