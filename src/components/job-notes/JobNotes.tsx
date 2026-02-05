"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { StickyNote, Save, Loader2, Check } from "lucide-react"

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
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = React.useRef(true)

  const hasUnsavedChanges = notes !== savedNotes

  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const saveNotes = React.useCallback(async (notesToSave: string) => {
    if (!isMountedRef.current) return

    setSaveStatus('saving')
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesToSave || null }),
      })

      if (!isMountedRef.current) return

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save notes')
      }

      setSavedNotes(notesToSave)
      setSaveStatus('saved')
      onNotesChange?.(notesToSave)

      // Reset status after 2 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setSaveStatus('idle')
        }
      }, 2000)
    } catch (error) {
      if (!isMountedRef.current) return

      setSaveStatus('error')
      toast({
        variant: "destructive",
        title: "Failed to save notes",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }
  }, [jobId, onNotesChange, toast])

  const handleNotesChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
  }, [saveNotes])

  const handleBlur = React.useCallback(() => {
    // Save immediately on blur if there are unsaved changes
    if (notes !== savedNotes) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      saveNotes(notes)
    }
  }, [notes, savedNotes, saveNotes])

  const handleManualSave = React.useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    saveNotes(notes)
  }, [notes, saveNotes])

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
          {saveStatus === 'saved' && (
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
        placeholder="Add notes about this job... e.g., interview prep, application answers, contact info"
        className="min-h-[120px] text-[11px] resize-y"
      />
      <p className="mt-1 text-[9px] text-muted-foreground">
        Notes are automatically saved after you stop typing.
      </p>
    </div>
  )
}
