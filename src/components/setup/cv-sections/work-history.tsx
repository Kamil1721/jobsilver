"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Briefcase,
  Plus,
  Trash2,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { ScreeningAnswers } from "@/lib/supabase/types"

interface WorkHistoryEntry {
  company: string
  position: string
  start_date: string
  end_date: string | null
  location?: string
  highlights: string[]
}

interface WorkHistorySectionProps {
  data: ScreeningAnswers
  onUpdate: (updates: Partial<ScreeningAnswers>) => void
}

const EMPTY_ENTRY: WorkHistoryEntry = {
  company: "",
  position: "",
  start_date: "",
  end_date: null,
  location: "",
  highlights: [""],
}

export function WorkHistorySection({ data, onUpdate }: WorkHistorySectionProps) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(0)
  const workHistory = data.work_history || []

  const updateEntry = (index: number, updates: Partial<WorkHistoryEntry>) => {
    const newHistory = [...workHistory]
    newHistory[index] = { ...newHistory[index], ...updates }
    onUpdate({ work_history: newHistory })
  }

  const addEntry = () => {
    if (workHistory.length < 3) {
      onUpdate({ work_history: [...workHistory, { ...EMPTY_ENTRY }] })
      setExpandedIndex(workHistory.length)
    }
  }

  const removeEntry = (index: number) => {
    const newHistory = workHistory.filter((_, i) => i !== index)
    onUpdate({ work_history: newHistory })
    if (expandedIndex === index) {
      setExpandedIndex(newHistory.length > 0 ? 0 : null)
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  const updateHighlight = (entryIndex: number, highlightIndex: number, value: string) => {
    const entry = workHistory[entryIndex]
    const newHighlights = [...entry.highlights]
    newHighlights[highlightIndex] = value
    updateEntry(entryIndex, { highlights: newHighlights })
  }

  const addHighlight = (entryIndex: number) => {
    const entry = workHistory[entryIndex]
    if (entry.highlights.length < 4) {
      updateEntry(entryIndex, { highlights: [...entry.highlights, ""] })
    }
  }

  const removeHighlight = (entryIndex: number, highlightIndex: number) => {
    const entry = workHistory[entryIndex]
    if (entry.highlights.length > 1) {
      const newHighlights = entry.highlights.filter((_, i) => i !== highlightIndex)
      updateEntry(entryIndex, { highlights: newHighlights })
    }
  }

  // Generate month options
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]

  // Generate year options (current year - 50 to current year)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 51 }, (_, i) => currentYear - i)

  const parseDate = (dateStr: string) => {
    if (!dateStr) return { year: "", month: "" }
    const [year, month] = dateStr.split("-")
    return { year: year || "", month: month || "" }
  }

  // Store partial dates to allow selecting year and month independently
  // Format: "YYYY-MM" when complete, "YYYY-" for year only, "-MM" for month only
  const formatDate = (year: string, month: string) => {
    if (!year && !month) return ""
    if (year && month) return `${year}-${month}`
    if (year) return `${year}-`
    return `-${month}`
  }

  // Check if date is complete (has both year and month)
  const isDateComplete = (dateStr: string) => {
    if (!dateStr) return false
    const { year, month } = parseDate(dateStr)
    return year.length === 4 && month.length === 2
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Work Experience</h3>
          <span className="text-xs text-amber-600 font-medium">Required</span>
        </div>
        <span className="text-xs text-muted-foreground">{workHistory.length}/3 positions</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Add your most relevant work experience (1-3 positions)
      </p>

      <div className="space-y-3">
        {workHistory.map((entry, index) => {
          const isExpanded = expandedIndex === index
          const startDate = parseDate(entry.start_date)
          const endDate = parseDate(entry.end_date || "")
          const isCurrentJob = entry.end_date === null && !!entry.start_date

          return (
            <div
              key={index}
              className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden"
            >
              {/* Header - always visible */}
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className={cn(
                  "w-full flex items-center justify-between p-4 text-left transition-colors",
                  isExpanded
                    ? "bg-zinc-50 dark:bg-white/[0.02]"
                    : "hover:bg-zinc-50 dark:hover:bg-white/[0.02]"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {entry.position || entry.company
                      ? `${entry.position || "Position"} at ${entry.company || "Company"}`
                      : `Position ${index + 1}`}
                  </p>
                  {entry.start_date && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {startDate.month && months.find(m => m.value === startDate.month)?.label} {startDate.year}
                      {" - "}
                      {isCurrentJob
                        ? "Present"
                        : endDate.year
                        ? `${endDate.month && months.find(m => m.value === endDate.month)?.label} ${endDate.year}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {workHistory.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeEntry(index)
                      }}
                      className="h-8 w-8 p-0 text-zinc-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-4 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-800">
                  {/* Company & Position */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <Label>Company *</Label>
                      <Input
                        placeholder="Company name"
                        value={entry.company}
                        onChange={(e) => updateEntry(index, { company: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Position *</Label>
                      <Input
                        placeholder="Job title"
                        value={entry.position}
                        onChange={(e) => updateEntry(index, { position: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        Start Date *
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={startDate.month}
                          onChange={(e) =>
                            updateEntry(index, { start_date: formatDate(startDate.year, e.target.value) })
                          }
                          className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">Month</option>
                          {months.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={startDate.year}
                          onChange={(e) =>
                            updateEntry(index, { start_date: formatDate(e.target.value, startDate.month) })
                          }
                          className="w-24 h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">Year</option>
                          {years.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        End Date
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={isCurrentJob ? "" : endDate.month}
                          onChange={(e) =>
                            updateEntry(index, { end_date: formatDate(endDate.year, e.target.value) || null })
                          }
                          disabled={isCurrentJob}
                          className={cn(
                            "flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm",
                            isCurrentJob && "opacity-50"
                          )}
                        >
                          <option value="">Month</option>
                          {months.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={isCurrentJob ? "" : endDate.year}
                          onChange={(e) =>
                            updateEntry(index, { end_date: formatDate(e.target.value, endDate.month) || null })
                          }
                          disabled={isCurrentJob}
                          className={cn(
                            "w-24 h-10 px-3 rounded-md border border-input bg-background text-sm",
                            isCurrentJob && "opacity-50"
                          )}
                        >
                          <option value="">Year</option>
                          {years.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCurrentJob}
                          onChange={(e) =>
                            updateEntry(index, { end_date: e.target.checked ? null : "" })
                          }
                          className="w-4 h-4 rounded border-zinc-300"
                        />
                        <span className="text-sm text-muted-foreground">I currently work here</span>
                      </label>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      Location
                    </Label>
                    <Input
                      placeholder="e.g., New York, NY or Remote"
                      value={entry.location || ""}
                      onChange={(e) => updateEntry(index, { location: e.target.value })}
                    />
                  </div>

                  {/* Highlights */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Key Achievements / Responsibilities</Label>
                      <span className="text-xs text-muted-foreground">
                        {entry.highlights.length}/4 bullet points
                      </span>
                    </div>
                    <div className="space-y-2">
                      {entry.highlights.map((highlight, hIndex) => (
                        <div key={hIndex} className="flex gap-2">
                          <span className="text-muted-foreground mt-2.5">•</span>
                          <Textarea
                            placeholder={`Achievement or responsibility ${hIndex + 1}`}
                            value={highlight}
                            onChange={(e) => updateHighlight(index, hIndex, e.target.value)}
                            className="min-h-[60px] resize-none flex-1"
                          />
                          {entry.highlights.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeHighlight(index, hIndex)}
                              className="h-8 w-8 p-0 mt-1 text-zinc-500 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {entry.highlights.length < 4 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addHighlight(index)}
                        className="text-zinc-600 hover:text-zinc-900"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add bullet point
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {workHistory.length < 3 && (
        <Button
          variant="outline"
          onClick={addEntry}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add {workHistory.length === 0 ? "Work Experience" : "Another Position"}
        </Button>
      )}

      {workHistory.length === 0 && (
        <p className="text-sm text-amber-600 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          At least one work experience entry is required
        </p>
      )}
    </div>
  )
}
