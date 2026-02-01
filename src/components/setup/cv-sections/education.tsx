"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  GraduationCap,
  Plus,
  Trash2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react"
import type { ScreeningAnswers } from "@/lib/supabase/types"

interface EducationEntry {
  institution: string
  degree: string
  area: string
  graduation_year: string
  location?: string
  highlights?: string[]
}

interface EducationSectionProps {
  data: ScreeningAnswers
  onUpdate: (updates: Partial<ScreeningAnswers>) => void
}

const EMPTY_ENTRY: EducationEntry = {
  institution: "",
  degree: "",
  area: "",
  graduation_year: "",
  location: "",
  highlights: [],
}

// International degree options organized by region
const DEGREE_OPTIONS = [
  // Secondary Education
  { value: "High School Diploma", label: "High School Diploma (US)", region: "Secondary" },
  { value: "GCSEs", label: "GCSEs (UK)", region: "Secondary" },
  { value: "A-Levels", label: "A-Levels (UK)", region: "Secondary" },
  { value: "IB Diploma", label: "International Baccalaureate (IB)", region: "Secondary" },
  { value: "Abitur", label: "Abitur (Germany)", region: "Secondary" },
  { value: "Baccalauréat", label: "Baccalauréat (France)", region: "Secondary" },

  // Vocational / Technical
  { value: "BTEC", label: "BTEC (UK)", region: "Vocational" },
  { value: "NVQ", label: "NVQ (UK)", region: "Vocational" },
  { value: "HNC", label: "HNC - Higher National Certificate (UK)", region: "Vocational" },
  { value: "HND", label: "HND - Higher National Diploma (UK)", region: "Vocational" },
  { value: "Foundation Degree", label: "Foundation Degree (UK)", region: "Vocational" },
  { value: "Associate Degree", label: "Associate Degree (US)", region: "Vocational" },
  { value: "Diploma", label: "Diploma / Certificate", region: "Vocational" },

  // Bachelor's Degrees
  { value: "BA", label: "Bachelor of Arts (BA)", region: "Bachelor" },
  { value: "BS", label: "Bachelor of Science (BS/BSc)", region: "Bachelor" },
  { value: "BEng", label: "Bachelor of Engineering (BEng)", region: "Bachelor" },
  { value: "BBA", label: "Bachelor of Business Administration (BBA)", region: "Bachelor" },
  { value: "LLB", label: "Bachelor of Laws (LLB)", region: "Bachelor" },
  { value: "BEd", label: "Bachelor of Education (BEd)", region: "Bachelor" },
  { value: "BN", label: "Bachelor of Nursing (BN/BSN)", region: "Bachelor" },
  { value: "BFA", label: "Bachelor of Fine Arts (BFA)", region: "Bachelor" },

  // Master's Degrees
  { value: "MA", label: "Master of Arts (MA)", region: "Master" },
  { value: "MS", label: "Master of Science (MS/MSc)", region: "Master" },
  { value: "MEng", label: "Master of Engineering (MEng)", region: "Master" },
  { value: "MBA", label: "Master of Business Administration (MBA)", region: "Master" },
  { value: "MPhil", label: "Master of Philosophy (MPhil)", region: "Master" },
  { value: "LLM", label: "Master of Laws (LLM)", region: "Master" },
  { value: "MEd", label: "Master of Education (MEd)", region: "Master" },
  { value: "MFA", label: "Master of Fine Arts (MFA)", region: "Master" },

  // Doctoral Degrees
  { value: "PhD", label: "Doctor of Philosophy (PhD)", region: "Doctoral" },
  { value: "DPhil", label: "Doctor of Philosophy (DPhil - Oxford)", region: "Doctoral" },
  { value: "MD", label: "Doctor of Medicine (MD)", region: "Doctoral" },
  { value: "JD", label: "Juris Doctor (JD)", region: "Doctoral" },
  { value: "EdD", label: "Doctor of Education (EdD)", region: "Doctoral" },
  { value: "DBA", label: "Doctor of Business Administration (DBA)", region: "Doctoral" },
]

// Group degrees by region for display
const DEGREE_REGIONS = ["Secondary", "Vocational", "Bachelor", "Master", "Doctoral"]

// Custom combobox for degree selection with custom input support
function DegreeCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Sync inputValue with value prop
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        // If there's input value, use it
        if (inputValue && inputValue !== value) {
          onChange(inputValue)
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [inputValue, value, onChange])

  // Filter options based on input
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return DEGREE_OPTIONS
    const search = inputValue.toLowerCase()
    return DEGREE_OPTIONS.filter(
      (opt) =>
        opt.value.toLowerCase().includes(search) ||
        opt.label.toLowerCase().includes(search)
    )
  }, [inputValue])

  // Check if current input matches an existing option
  const matchesExisting = DEGREE_OPTIONS.some(
    (opt) => opt.value.toLowerCase() === inputValue.toLowerCase() ||
             opt.label.toLowerCase() === inputValue.toLowerCase()
  )

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue)
    onChange(selectedValue)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (inputValue) {
        onChange(inputValue)
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type or select a degree..."
          className="pr-8"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-[280px] overflow-y-auto">
          {/* Custom value option if typing something not in list */}
          {inputValue && !matchesExisting && (
            <button
              type="button"
              onClick={() => handleSelect(inputValue)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/[0.05] flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800"
            >
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>Use &quot;{inputValue}&quot;</span>
            </button>
          )}

          {/* Grouped options */}
          {DEGREE_REGIONS.map((region) => {
            const regionOptions = filteredOptions.filter((opt) => opt.region === region)
            if (regionOptions.length === 0) return null

            return (
              <div key={region}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-zinc-50 dark:bg-white/[0.02] sticky top-0">
                  {region === "Secondary" && "Secondary Education"}
                  {region === "Vocational" && "Vocational / Technical"}
                  {region === "Bachelor" && "Bachelor's Degrees"}
                  {region === "Master" && "Master's Degrees"}
                  {region === "Doctoral" && "Doctoral Degrees"}
                </div>
                {regionOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/[0.05] flex items-center justify-between",
                      value === option.value && "bg-zinc-100 dark:bg-white/[0.05]"
                    )}
                  >
                    <span>{option.label}</span>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            )
          })}

          {filteredOptions.length === 0 && !inputValue && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Start typing to search...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EducationSection({ data, onUpdate }: EducationSectionProps) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(0)
  const education = data.education || []

  const updateEntry = (index: number, updates: Partial<EducationEntry>) => {
    const newEducation = [...education]
    newEducation[index] = { ...newEducation[index], ...updates }
    onUpdate({ education: newEducation })
  }

  const addEntry = () => {
    if (education.length < 2) {
      onUpdate({ education: [...education, { ...EMPTY_ENTRY }] })
      setExpandedIndex(education.length)
    }
  }

  const removeEntry = (index: number) => {
    const newEducation = education.filter((_, i) => i !== index)
    onUpdate({ education: newEducation })
    if (expandedIndex === index) {
      setExpandedIndex(newEducation.length > 0 ? 0 : null)
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  // Generate year options (current year - 60 to current year + 5 for expected graduation)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 66 }, (_, i) => currentYear + 5 - i)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Education</h3>
          <span className="text-xs text-amber-600 font-medium">Required</span>
        </div>
        <span className="text-xs text-muted-foreground">{education.length}/2 entries</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Add your educational background (1-2 entries)
      </p>

      <div className="space-y-3">
        {education.map((entry, index) => {
          const isExpanded = expandedIndex === index

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
                    {entry.institution || entry.degree
                      ? entry.institution || "Institution"
                      : `Education ${index + 1}`}
                  </p>
                  {(entry.degree || entry.area) && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {entry.degree}
                      {entry.degree && entry.area && " in "}
                      {entry.area}
                      {entry.graduation_year && ` (${entry.graduation_year})`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {education.length > 1 && (
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
                  {/* Institution */}
                  <div className="space-y-2 pt-4">
                    <Label>Institution *</Label>
                    <Input
                      placeholder="University or school name"
                      value={entry.institution}
                      onChange={(e) => updateEntry(index, { institution: e.target.value })}
                    />
                  </div>

                  {/* Degree & Area */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Degree / Qualification *</Label>
                      <DegreeCombobox
                        value={entry.degree}
                        onChange={(value) => updateEntry(index, { degree: value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Field of Study *</Label>
                      <Input
                        placeholder="e.g., Computer Science"
                        value={entry.area}
                        onChange={(e) => updateEntry(index, { area: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Graduation Year & Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Graduation Year *</Label>
                      <select
                        value={entry.graduation_year}
                        onChange={(e) => updateEntry(index, { graduation_year: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="">Select year...</option>
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y} {y > currentYear ? "(Expected)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        Location
                      </Label>
                      <Input
                        placeholder="e.g., Boston, MA"
                        value={entry.location || ""}
                        onChange={(e) => updateEntry(index, { location: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Highlights (optional) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-sm">
                        Honors / Activities (Optional)
                      </Label>
                    </div>
                    <Textarea
                      placeholder="e.g., Dean's List, GPA 3.8/4.0, Relevant coursework..."
                      value={entry.highlights?.join("\n") || ""}
                      onChange={(e) =>
                        updateEntry(index, {
                          highlights: e.target.value ? e.target.value.split("\n").filter(Boolean) : [],
                        })
                      }
                      className="min-h-[80px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      One item per line
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {education.length < 2 && (
        <Button
          variant="outline"
          onClick={addEntry}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add {education.length === 0 ? "Education" : "Another Degree"}
        </Button>
      )}

      {education.length === 0 && (
        <p className="text-sm text-amber-600 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          At least one education entry is required
        </p>
      )}
    </div>
  )
}
