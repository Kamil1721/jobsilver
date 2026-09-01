"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Globe,
  MapPin,
  Briefcase,
  X,
  Building2,
  Clock,
  GraduationCap,
  Laptop,
  AlertCircle,
  Home,
  Factory,
  Check,
  ChevronDown,
  Search,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { JobFilters, WorkArrangement } from "@/lib/supabase/types"
import { JOB_TITLES_BY_INDUSTRY, INDUSTRY_CATEGORIES } from "@/lib/job-titles-by-industry"
import { DEFAULT_JOB_FILTERS } from "./setup-wizard"

interface StepJobPreferencesProps {
  data: JobFilters
  onUpdate: (updates: Partial<JobFilters>) => void
  onReset?: () => void
}

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "Poland",
  "Netherlands",
  "France",
  "Spain",
  "Italy",
  "Australia",
  "Ireland",
  "Sweden",
  "Switzerland",
  "Singapore",
  "Japan",
  "Remote - Worldwide",
]

const JOB_TYPES = [
  { id: "fulltime", label: "Full-time", icon: Briefcase },
  { id: "part-time", label: "Part-Time", icon: Clock },
  { id: "contractor", label: "Contractor/Temp", icon: Building2 },
  { id: "internship", label: "Internship", icon: GraduationCap },
] as const

// Work arrangement options matching fantastic.jobs API
const WORK_ARRANGEMENTS: { id: WorkArrangement; label: string; description: string; icon: React.ElementType }[] = [
  { id: "on_site", label: "On-site Only", description: "Office-based, no remote", icon: Building2 },
  { id: "hybrid", label: "Hybrid", description: "Mix of office & remote", icon: Home },
  { id: "remote_ok", label: "Remote Flexible", description: "Remote with optional office", icon: Laptop },
  { id: "remote_only", label: "Fully Remote", description: "100% work from home", icon: Globe },
]

// Industry categories for the guided flow
const INDUSTRIES = Object.entries(INDUSTRY_CATEGORIES).map(([id, info]) => ({
  id,
  label: info.label,
  category: info.category,
}))

// Group industries by category for display
const INDUSTRIES_BY_CATEGORY = INDUSTRIES.reduce((acc, industry) => {
  if (!acc[industry.category]) {
    acc[industry.category] = []
  }
  acc[industry.category].push(industry)
  return acc
}, {} as Record<string, typeof INDUSTRIES>)

const CATEGORY_ORDER = ["Tech", "Business", "Service", "Trades", "Professional", "Creative", "Healthcare", "Other"]

export function StepJobPreferences({ data, onUpdate, onReset }: StepJobPreferencesProps) {
  const [showCountryDropdown, setShowCountryDropdown] = React.useState(false)
  const [countrySearch, setCountrySearch] = React.useState("")
  const [showIndustryDropdown, setShowIndustryDropdown] = React.useState(false)
  const [showJobTitleDropdown, setShowJobTitleDropdown] = React.useState(false)
  const [jobTitleSearch, setJobTitleSearch] = React.useState("")
  const industryTriggerRef = React.useRef<HTMLButtonElement>(null)
  const countryInputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const industryDropdownRef = React.useRef<HTMLDivElement>(null)
  const jobTitleDropdownRef = React.useRef<HTMLDivElement>(null)
  const jobTitleInputRef = React.useRef<HTMLInputElement>(null)
  const industryListId = "setup-industry-listbox"
  const jobTitleListId = "setup-job-title-listbox"
  const countryListId = "setup-country-listbox"

  const focusFirstOption = (listId: string) => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`#${listId} [role="option"]`)?.focus()
    })
  }

  const handleListboxKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    close: () => void,
    returnFocus: React.RefObject<HTMLElement | null>
  ) => {
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]:not([disabled])')
    )
    const currentIndex = options.indexOf(document.activeElement as HTMLElement)

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const direction = event.key === "ArrowDown" ? 1 : -1
      const nextIndex = currentIndex < 0
        ? direction > 0 ? 0 : options.length - 1
        : (currentIndex + direction + options.length) % options.length
      options[nextIndex]?.focus()
    } else if (event.key === "Home") {
      event.preventDefault()
      options[0]?.focus()
    } else if (event.key === "End") {
      event.preventDefault()
      options.at(-1)?.focus()
    } else if (event.key === "Escape") {
      event.preventDefault()
      close()
      returnFocus.current?.focus()
    }
  }

  // Get selected industry for job title suggestions
  const selectedIndustry = data.industries?.[0] || null

  // Get job titles for selected industry (or all if none selected)
  const availableJobTitles = React.useMemo(() => {
    if (selectedIndustry && JOB_TITLES_BY_INDUSTRY[selectedIndustry]) {
      return JOB_TITLES_BY_INDUSTRY[selectedIndustry]
    }
    // If no industry selected, show all job titles
    return Object.values(JOB_TITLES_BY_INDUSTRY).flat()
  }, [selectedIndustry])

  // Filter job titles based on search
  const filteredJobTitles = React.useMemo(() => {
    const search = jobTitleSearch.toLowerCase()
    return availableJobTitles
      .filter(title =>
        title.toLowerCase().includes(search) &&
        !data.job_titles.includes(title)
      )
      .slice(0, 15) // Limit to prevent overwhelming the UI
  }, [availableJobTitles, jobTitleSearch, data.job_titles])

  // Initialize work_arrangements from legacy fields if not set
  const workArrangements = data.work_arrangements || []

  // Sync legacy fields with work_arrangements for backward compatibility
  const updateWorkArrangements = (arrangements: WorkArrangement[]) => {
    const hasOnsite = arrangements.includes('on_site')
    const hasHybrid = arrangements.includes('hybrid')
    const hasRemote = arrangements.includes('remote_ok') || arrangements.includes('remote_only')

    onUpdate({
      work_arrangements: arrangements,
      // Keep legacy fields in sync
      onsite_hybrid: hasOnsite || hasHybrid,
      remote_jobs: hasRemote,
    })
  }

  const toggleWorkArrangement = (arrangement: WorkArrangement) => {
    const current = workArrangements
    const newArrangements = current.includes(arrangement)
      ? current.filter((a) => a !== arrangement)
      : [...current, arrangement]
    updateWorkArrangements(newArrangements)
  }

  // Check if location is required (on-site or hybrid selected)
  const requiresLocation = workArrangements.includes('on_site') || workArrangements.includes('hybrid')

  // Check if user wants fully remote work
  const isRemoteOnly = workArrangements.length > 0 &&
    !workArrangements.includes('on_site') &&
    !workArrangements.includes('hybrid')

  const selectIndustry = (industry: string) => {
    // Only allow single industry selection for free users
    // Clear job titles if industry changes
    if (data.industries?.[0] !== industry) {
      onUpdate({
        industries: [industry],
        job_titles: [], // Reset job titles when industry changes
      })
    } else {
      onUpdate({ industries: [industry] })
    }
    setShowIndustryDropdown(false)
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        industryDropdownRef.current &&
        !industryDropdownRef.current.contains(event.target as Node) &&
        industryTriggerRef.current &&
        !industryTriggerRef.current.contains(event.target as Node)
      ) {
        setShowIndustryDropdown(false)
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false)
      }
      if (
        jobTitleDropdownRef.current &&
        !jobTitleDropdownRef.current.contains(event.target as Node) &&
        jobTitleInputRef.current &&
        !jobTitleInputRef.current.contains(event.target as Node)
      ) {
        setShowJobTitleDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredCountries = COUNTRIES.filter(
    (country) =>
      country.toLowerCase().includes(countrySearch.toLowerCase()) &&
      !data.remote_countries.includes(country) &&
      !data.onsite_locations?.includes(country)
  )

  const addCountry = (country: string) => {
    // Add to both remote_countries and onsite_locations if on-site/hybrid selected
    if (requiresLocation && !isRemoteOnly) {
      if (!data.onsite_locations?.includes(country)) {
        onUpdate({
          onsite_locations: [...(data.onsite_locations || []), country],
          remote_countries: [...data.remote_countries, country],
        })
      }
    } else {
      if (!data.remote_countries.includes(country)) {
        onUpdate({ remote_countries: [...data.remote_countries, country] })
      }
    }
    setCountrySearch("")
    setShowCountryDropdown(false)
    countryInputRef.current?.focus()
  }

  const removeCountry = (country: string) => {
    onUpdate({
      remote_countries: data.remote_countries.filter((c) => c !== country),
      onsite_locations: (data.onsite_locations || []).filter((c) => c !== country),
    })
  }

  const addJobTitle = (title: string) => {
    if (title && !data.job_titles.includes(title) && data.job_titles.length < 5) {
      onUpdate({ job_titles: [...data.job_titles, title] })
      setJobTitleSearch("")
      setShowJobTitleDropdown(false)
    }
  }

  const removeJobTitle = (title: string) => {
    onUpdate({ job_titles: data.job_titles.filter((t) => t !== title) })
  }

  const toggleJobType = (type: typeof JOB_TYPES[number]["id"]) => {
    const newTypes = data.job_types.includes(type)
      ? data.job_types.filter((t) => t !== type)
      : [...data.job_types, type]
    onUpdate({ job_types: newTypes })
  }

  // Get all selected locations
  const selectedLocations = Array.from(new Set([
    ...data.remote_countries,
    ...(data.onsite_locations || []),
  ]))

  // Handle reset all filters
  const handleReset = () => {
    if (onReset) {
      onReset()
    } else {
      // Fallback: reset to defaults inline
      onUpdate(DEFAULT_JOB_FILTERS)
    }
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-muted-foreground" />
            Job Preferences
          </h2>
          <p className="text-muted-foreground text-sm">
            Tell us about the type of work you are looking for
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Reset All
        </Button>
      </div>

      {/* Step 1: Industry Section - Required */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Factory className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Step 1: Industry</h3>
          <span className="text-xs text-red-500 font-medium">* Required</span>
        </div>

        <p className="text-sm text-muted-foreground">
          What industry do you work in? This helps us show relevant job titles.
        </p>

        {/* Validation Warning */}
        {!selectedIndustry && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--coral-soft)] p-3 text-sm text-[var(--coral-lo)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select an industry to continue
          </div>
        )}

        {/* Industry Selector */}
        <div className="relative">
          <button
            id="industry-trigger"
            ref={industryTriggerRef}
            type="button"
            onClick={() => setShowIndustryDropdown(!showIndustryDropdown)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                setShowIndustryDropdown(true)
                focusFirstOption(industryListId)
              } else if (event.key === "Escape") {
                setShowIndustryDropdown(false)
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={showIndustryDropdown}
            aria-controls={industryListId}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left",
              selectedIndustry
                ? "border-[var(--coral)] bg-[var(--coral-soft)]"
                : "border-border hover:border-muted-foreground/40"
            )}
          >
            <span className={cn(
              "text-sm",
              selectedIndustry ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {selectedIndustry
                ? INDUSTRY_CATEGORIES[selectedIndustry as keyof typeof INDUSTRY_CATEGORIES]?.label || selectedIndustry
                : "Select your industry..."}
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              showIndustryDropdown && "rotate-180"
            )} />
          </button>

          {showIndustryDropdown && (
            <div
              id={industryListId}
              ref={industryDropdownRef}
              role="listbox"
              aria-label="Industry"
              onKeyDown={(event) => handleListboxKeyDown(
                event,
                () => setShowIndustryDropdown(false),
                industryTriggerRef
              )}
              className="absolute z-[100] w-full mt-1 py-2 bg-popover rounded-lg border border-border shadow-xl max-h-80 overflow-auto"
            >
              {CATEGORY_ORDER.map(category => {
                const industriesInCategory = INDUSTRIES_BY_CATEGORY[category]
                if (!industriesInCategory) return null

                return (
                  <div key={category}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted">
                      {category}
                    </div>
                    {industriesInCategory.map((industry) => {
                      const isSelected = selectedIndustry === industry.id
                      return (
                        <button
                          key={industry.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-accent transition-colors",
                            isSelected && "bg-secondary"
                          )}
                          onClick={() => selectIndustry(industry.id)}
                        >
                          <span>{industry.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-[var(--coral-lo)]" />}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Job Titles Section - Required, dependent on industry */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium">Step 2: Job Titles</h3>
            <span className="text-xs text-red-500 font-medium">* Required</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.job_titles.length}/5 selected
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {selectedIndustry
            ? `Select job titles you're interested in for ${INDUSTRY_CATEGORIES[selectedIndustry as keyof typeof INDUSTRY_CATEGORIES]?.label || selectedIndustry}.`
            : "Select an industry first to see relevant job titles."}
        </p>

        {/* Validation Warning */}
        {data.job_titles.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--coral-soft)] p-3 text-sm text-[var(--coral-lo)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {selectedIndustry ? "Select at least one job title" : "Select an industry first"}
          </div>
        )}

        {/* Job Title Selector */}
        <div className="relative">
          <div className="relative">
            <Input
              id="job-title-input"
              ref={jobTitleInputRef}
              placeholder={selectedIndustry ? "Search job titles..." : "Select an industry first"}
              value={jobTitleSearch}
              onChange={(e) => {
                setJobTitleSearch(e.target.value)
                setShowJobTitleDropdown(true)
              }}
              onFocus={() => setShowJobTitleDropdown(true)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setShowJobTitleDropdown(true)
                  focusFirstOption(jobTitleListId)
                } else if (event.key === "Escape") {
                  setShowJobTitleDropdown(false)
                }
              }}
              role="combobox"
              aria-label="Job titles"
              aria-autocomplete="list"
              aria-expanded={showJobTitleDropdown && filteredJobTitles.length > 0}
              aria-controls={jobTitleListId}
              disabled={!selectedIndustry || data.job_titles.length >= 5}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>

          {/* Job Title Dropdown */}
          {showJobTitleDropdown && selectedIndustry && filteredJobTitles.length > 0 && (
            <div
              id={jobTitleListId}
              ref={jobTitleDropdownRef}
              role="listbox"
              aria-label="Job title suggestions"
              onKeyDown={(event) => handleListboxKeyDown(
                event,
                () => setShowJobTitleDropdown(false),
                jobTitleInputRef
              )}
              className="absolute z-[100] w-full mt-1 py-1 bg-popover rounded-lg border border-border shadow-xl max-h-48 overflow-auto"
            >
              {filteredJobTitles.map((title) => (
                <button
                  key={title}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  onClick={() => addJobTitle(title)}
                >
                  {title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Job Titles */}
        {data.job_titles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.job_titles.map((title) => (
              <Badge
                key={title}
                className="bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)] pl-3 pr-1.5 py-1.5 gap-1.5 transition-colors"
              >
                {title}
                <button
                  type="button"
                  aria-label={`Remove ${title}`}
                  onClick={() => removeJobTitle(title)}
                  className="hover:bg-[var(--coral-hi)] rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Step 3: Work Arrangement Section */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Step 3: Work Arrangement</h3>
          <span className="text-xs text-red-500 font-medium">* Required</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Where would you like to work? Select all that apply.
        </p>

        {/* Validation Warning */}
        {workArrangements.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--coral-soft)] p-3 text-sm text-[var(--coral-lo)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one work arrangement
          </div>
        )}

        {/* Work Arrangement Grid */}
        <div
          className="grid grid-cols-2 gap-3"
          role="group"
          aria-label="Work arrangements"
          data-setup-field="work-arrangements"
        >
          {WORK_ARRANGEMENTS.map((arrangement) => {
            const isSelected = workArrangements.includes(arrangement.id)
            const Icon = arrangement.icon

            return (
              <button
                key={arrangement.id}
                type="button"
                onClick={() => toggleWorkArrangement(arrangement.id)}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2",
                  isSelected
                    ? "border-[var(--coral)] bg-[var(--coral-soft)]"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-[var(--coral)] text-[var(--coral-ink)]"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className={cn("font-medium text-sm", isSelected ? "text-foreground" : "text-muted-foreground")}>
                    {arrangement.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{arrangement.description}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--coral)] text-[var(--coral-ink)] flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Location - show for on-site/hybrid, or for any remote option */}
        {workArrangements.length > 0 && (
          <div className={cn("space-y-3 animate-fade-in-up", showCountryDropdown && "relative z-50")}>
            <Label className="text-sm text-muted-foreground">
              {requiresLocation
                ? "Where would you like to work? (Required for on-site/hybrid)"
                : "Which countries would you consider for remote work? (Optional)"}
            </Label>

            {/* Validation Warning for location */}
            {requiresLocation && selectedLocations.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--coral-soft)] p-3 text-sm text-[var(--coral-lo)]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Add at least one location for on-site or hybrid work
              </div>
            )}

            <div className="relative">
              <Input
                id="job-location-input"
                ref={countryInputRef}
                placeholder="Search and select countries..."
                value={countrySearch}
                onChange={(e) => {
                  setCountrySearch(e.target.value)
                  setShowCountryDropdown(true)
                }}
                onFocus={() => setShowCountryDropdown(true)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setShowCountryDropdown(true)
                    focusFirstOption(countryListId)
                  } else if (event.key === "Escape") {
                    setShowCountryDropdown(false)
                  }
                }}
                role="combobox"
                aria-label="Work locations"
                aria-autocomplete="list"
                aria-expanded={showCountryDropdown && filteredCountries.length > 0}
                aria-controls={countryListId}
                className="pl-10"
              />
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              {/* Dropdown */}
              {showCountryDropdown && filteredCountries.length > 0 && (
                <div
                  id={countryListId}
                  ref={dropdownRef}
                  role="listbox"
                  aria-label="Location suggestions"
                  onKeyDown={(event) => handleListboxKeyDown(
                    event,
                    () => setShowCountryDropdown(false),
                    countryInputRef
                  )}
                  className="absolute z-[100] w-full mt-1 py-1 bg-popover rounded-lg border border-border shadow-xl max-h-48 overflow-auto"
                >
                  {filteredCountries.map((country) => (
                    <button
                      key={country}
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                      onClick={() => addCountry(country)}
                    >
                      {country}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Locations */}
            {selectedLocations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedLocations.map((country) => (
                  <Badge
                    key={country}
                    className="bg-secondary text-foreground hover:bg-accent pl-3 pr-1.5 py-1.5 gap-1.5 transition-colors"
                  >
                    {country}
                    <button
                      type="button"
                      aria-label={`Remove ${country}`}
                      onClick={() => removeCountry(country)}
                      className="hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 4: Job Types Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Step 4: Job Types</h3>
          <span className="text-xs text-red-500 font-medium">* Required</span>
        </div>

        <p className="text-sm text-muted-foreground">
          What type of employment are you looking for?
        </p>

        {/* Validation Warning */}
        {data.job_types.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--coral-soft)] p-3 text-sm text-[var(--coral-lo)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one job type
          </div>
        )}

        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          role="group"
          aria-label="Job types"
          data-setup-field="job-types"
        >
          {JOB_TYPES.map((type) => {
            const isSelected = data.job_types.includes(type.id)
            const Icon = type.icon

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => toggleJobType(type.id)}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2",
                  isSelected
                    ? "border-[var(--coral)] bg-[var(--coral-soft)] text-foreground"
                    : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    isSelected
                      ? "bg-[var(--coral)] text-[var(--coral-ink)]"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{type.label}</span>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--coral)] text-[var(--coral-ink)] flex items-center justify-center">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
