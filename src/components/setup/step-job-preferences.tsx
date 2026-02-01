"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Globe,
  MapPin,
  Briefcase,
  X,
  Plus,
  Building2,
  Clock,
  GraduationCap,
  Laptop,
  AlertCircle,
  Home,
  Factory,
  Check,
  ChevronDown,
} from "lucide-react"
import type { JobFilters, WorkArrangement } from "@/lib/supabase/types"

interface StepJobPreferencesProps {
  data: JobFilters
  onUpdate: (updates: Partial<JobFilters>) => void
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

// Industry categories from fantastic.jobs API (ai_taxonomies_a_filter)
const INDUSTRIES = [
  // Healthcare & Medical
  { id: "Healthcare", label: "Healthcare", category: "Healthcare" },
  // Business & Sales
  { id: "Sales", label: "Sales", category: "Business" },
  { id: "Marketing", label: "Marketing", category: "Business" },
  { id: "Finance & Accounting", label: "Finance & Accounting", category: "Business" },
  { id: "Consulting", label: "Consulting", category: "Business" },
  { id: "Human Resources", label: "Human Resources", category: "Business" },
  { id: "Administrative", label: "Administrative", category: "Business" },
  // Customer Facing
  { id: "Customer Service & Support", label: "Customer Service", category: "Service" },
  { id: "Retail", label: "Retail", category: "Service" },
  { id: "Hospitality", label: "Hospitality", category: "Service" },
  { id: "Food & Beverage", label: "Food & Beverage", category: "Service" },
  // Technology
  { id: "Technology", label: "Technology", category: "Tech" },
  { id: "Software", label: "Software", category: "Tech" },
  { id: "Data & Analytics", label: "Data & Analytics", category: "Tech" },
  { id: "Engineering", label: "Engineering", category: "Tech" },
  // Trade & Industry
  { id: "Construction", label: "Construction", category: "Trades" },
  { id: "Manufacturing", label: "Manufacturing", category: "Trades" },
  { id: "Trades", label: "Skilled Trades", category: "Trades" },
  { id: "Logistics", label: "Logistics & Supply Chain", category: "Trades" },
  { id: "Transportation", label: "Transportation", category: "Trades" },
  // Professional & Public
  { id: "Education", label: "Education", category: "Professional" },
  { id: "Legal", label: "Legal", category: "Professional" },
  { id: "Government & Public Sector", label: "Government", category: "Professional" },
  { id: "Science & Research", label: "Science & Research", category: "Professional" },
  { id: "Social Services", label: "Social Services", category: "Professional" },
  // Creative & Other
  { id: "Creative & Media", label: "Creative & Media", category: "Creative" },
  { id: "Art & Design", label: "Art & Design", category: "Creative" },
  { id: "Sports & Recreation", label: "Sports & Recreation", category: "Other" },
  { id: "Security & Safety", label: "Security & Safety", category: "Other" },
  { id: "Environmental & Sustainability", label: "Environmental", category: "Other" },
  { id: "Energy", label: "Energy", category: "Other" },
  { id: "Agriculture", label: "Agriculture", category: "Other" },
  { id: "Management & Leadership", label: "Management", category: "Other" },
]

export function StepJobPreferences({ data, onUpdate }: StepJobPreferencesProps) {
  const [newJobTitle, setNewJobTitle] = React.useState("")
  const [showCountryDropdown, setShowCountryDropdown] = React.useState(false)
  const [countrySearch, setCountrySearch] = React.useState("")
  const [showIndustryDropdown, setShowIndustryDropdown] = React.useState(false)
  const countryInputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const industryDropdownRef = React.useRef<HTMLDivElement>(null)

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

  const toggleIndustry = (industry: string) => {
    const current = data.industries || []
    const newIndustries = current.includes(industry)
      ? current.filter((i) => i !== industry)
      : [...current, industry]
    onUpdate({ industries: newIndustries })
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredCountries = COUNTRIES.filter(
    (country) =>
      country.toLowerCase().includes(countrySearch.toLowerCase()) &&
      !data.remote_countries.includes(country)
  )

  const addCountry = (country: string) => {
    if (!data.remote_countries.includes(country)) {
      onUpdate({ remote_countries: [...data.remote_countries, country] })
    }
    setCountrySearch("")
    setShowCountryDropdown(false)
    countryInputRef.current?.focus()
  }

  const removeCountry = (country: string) => {
    onUpdate({
      remote_countries: data.remote_countries.filter((c) => c !== country),
    })
  }

  const addJobTitle = () => {
    const title = newJobTitle.trim()
    if (title && !data.job_titles.includes(title) && data.job_titles.length < 5) {
      onUpdate({ job_titles: [...data.job_titles, title] })
      setNewJobTitle("")
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

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          Job Preferences
        </h2>
        <p className="text-muted-foreground text-sm">
          Tell us about the type of work you are looking for
        </p>
      </div>

      {/* Work Arrangement Section */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Work Arrangement</h3>
          <span className="text-xs text-red-500 font-medium">* Required</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Where would you like to work? Select all that apply.
        </p>

        {/* Validation Warning */}
        {workArrangements.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one work arrangement to enable job search
          </div>
        )}

        {/* Work Arrangement Grid */}
        <div className="grid grid-cols-2 gap-3">
          {WORK_ARRANGEMENTS.map((arrangement) => {
            const isSelected = workArrangements.includes(arrangement.id)
            const Icon = arrangement.icon

            return (
              <button
                key={arrangement.id}
                type="button"
                onClick={() => toggleWorkArrangement(arrangement.id)}
                className={cn(
                  "relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
                  isSelected
                    ? "border-zinc-400 bg-zinc-50 dark:bg-white/[0.05]"
                    : "border-zinc-200 dark:border-white/[0.06] hover:border-zinc-400"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-gradient-to-r from-zinc-500 to-zinc-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className={cn("font-medium text-sm", isSelected ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-600 dark:text-zinc-400")}>
                    {arrangement.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{arrangement.description}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-r from-zinc-500 to-zinc-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Remote Countries - show when remote options selected */}
        {(workArrangements.includes('remote_ok') || workArrangements.includes('remote_only')) && (
          <div className="space-y-3 animate-fade-in-up">
            <Label className="text-sm text-muted-foreground">
              Which countries would you consider for remote work?
            </Label>
            <div className="relative">
              <Input
                ref={countryInputRef}
                placeholder="Search and select countries..."
                value={countrySearch}
                onChange={(e) => {
                  setCountrySearch(e.target.value)
                  setShowCountryDropdown(true)
                }}
                onFocus={() => setShowCountryDropdown(true)}
                className="pl-10"
              />
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              {/* Dropdown */}
              {showCountryDropdown && filteredCountries.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-1 py-1 bg-white dark:bg-[#111113] rounded-lg border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-48 overflow-auto"
                >
                  {filteredCountries.map((country) => (
                    <button
                      key={country}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        addCountry(country)
                      }}
                    >
                      {country}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Countries */}
            {data.remote_countries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.remote_countries.map((country) => (
                  <Badge
                    key={country}
                    className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/[0.08] pl-3 pr-1.5 py-1.5 gap-1.5 transition-colors"
                  >
                    {country}
                    <button
                      onClick={() => removeCountry(country)}
                      className="hover:bg-zinc-300/50 dark:hover:bg-white/[0.1] rounded-full p-0.5 transition-colors"
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

      {/* Industry Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Factory className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Industries</h3>
          <span className="text-xs text-muted-foreground">(Optional)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Filter by industry sector. Leave empty to search all industries.
        </p>

        {/* Industry Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowIndustryDropdown(!showIndustryDropdown)}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-white/[0.06] hover:border-zinc-400 transition-colors text-left"
          >
            <span className="text-sm text-muted-foreground">
              {(data.industries?.length || 0) > 0
                ? `${data.industries?.length} industries selected`
                : "Select industries..."}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showIndustryDropdown && "rotate-180")} />
          </button>

          {showIndustryDropdown && (
            <div
              ref={industryDropdownRef}
              className="absolute z-50 w-full mt-1 py-2 bg-white dark:bg-[#111113] rounded-lg border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-64 overflow-auto"
            >
              {INDUSTRIES.map((industry) => {
                const isSelected = data.industries?.includes(industry.id)
                return (
                  <button
                    key={industry.id}
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors",
                      isSelected && "bg-zinc-50 dark:bg-white/[0.03]"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      toggleIndustry(industry.id)
                    }}
                  >
                    <span>{industry.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Industries */}
        {(data.industries?.length || 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.industries?.map((industry) => (
              <Badge
                key={industry}
                className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/[0.08] pl-3 pr-1.5 py-1.5 gap-1.5 transition-colors"
              >
                {INDUSTRIES.find(i => i.id === industry)?.label || industry}
                <button
                  onClick={() => toggleIndustry(industry)}
                  className="hover:bg-zinc-300/50 dark:hover:bg-white/[0.1] rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Job Types Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Job Types</h3>
          <span className="text-xs text-red-500 font-medium">* Required</span>
        </div>

        {/* Validation Warning */}
        {data.job_types.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one job type to enable job search
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {JOB_TYPES.map((type) => {
            const isSelected = data.job_types.includes(type.id)
            const Icon = type.icon

            return (
              <button
                key={type.id}
                onClick={() => toggleJobType(type.id)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
                  isSelected
                    ? "border-zinc-400 bg-zinc-50 dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300"
                    : "border-zinc-200 dark:border-white/[0.06] hover:border-zinc-400 text-zinc-600 dark:text-zinc-400"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    isSelected
                      ? "bg-gradient-to-r from-zinc-500 to-zinc-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{type.label}</span>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-r from-zinc-500 to-zinc-600 text-white flex items-center justify-center">
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

      {/* Job Titles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-zinc-500" />
            <h3 className="font-medium">Job Titles</h3>
            <span className="text-xs text-red-500 font-medium">* Required</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.job_titles.length}/5 selected
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          What job titles are you looking for? Type in and select up to 5.
        </p>

        {/* Validation Warning */}
        {data.job_titles.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Add at least one job title to enable job search
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="e.g., Software Engineer, Product Manager..."
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addJobTitle()
                }
              }}
              disabled={data.job_titles.length >= 5}
              className="pr-10"
            />
            {newJobTitle && (
              <button
                onClick={addJobTitle}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-gradient-to-r from-zinc-500 to-zinc-600 text-white flex items-center justify-center hover:from-zinc-400 hover:to-zinc-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Job Titles */}
        {data.job_titles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.job_titles.map((title) => (
              <Badge
                key={title}
                className="bg-gradient-to-r from-zinc-500 to-zinc-600 text-white hover:from-zinc-400 hover:to-zinc-500 pl-3 pr-1.5 py-1.5 gap-1.5 transition-colors"
              >
                {title}
                <button
                  onClick={() => removeJobTitle(title)}
                  className="hover:bg-zinc-400 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

      </div>

    </div>
  )
}
