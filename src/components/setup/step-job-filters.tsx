"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Filter,
  Sliders,
  Clock,
  Building2,
  Languages,
  Search,
  X,
  Plus,
  Ban,
  Target,
  TrendingUp,
  Zap,
  ChevronDown,
  Settings,
  Users,
  Rocket,
  Building,
  Landmark,
  Factory,
  Lock,
} from "lucide-react"
import type { JobFilters } from "@/lib/supabase/types"
import { useFeatureAccess } from "@/hooks/useFeatureAccess"
import { LockedBadge } from "@/components/ui/feature-gate"

interface StepJobFiltersProps {
  data: JobFilters
  onUpdate: (updates: Partial<JobFilters>) => void
}

const SENIORITY_LEVELS = [
  { id: "entry", label: "Entry Level" },
  { id: "associate", label: "Associate Level" },
  { id: "mid-senior", label: "Mid-to-Senior Level" },
  { id: "director", label: "Director Level +" },
] as const

const TIME_ZONES = [
  "UTC-12:00 to UTC-8:00 (Pacific)",
  "UTC-7:00 to UTC-5:00 (Americas)",
  "UTC-4:00 to UTC-1:00 (Atlantic)",
  "UTC+0:00 to UTC+3:00 (Europe/Africa)",
  "UTC+4:00 to UTC+6:00 (Middle East/Asia)",
  "UTC+7:00 to UTC+9:00 (East Asia)",
  "UTC+10:00 to UTC+12:00 (Oceania)",
]

const INDUSTRIES = [
  "Technology",
  "Finance & Banking",
  "Healthcare",
  "E-commerce",
  "SaaS",
  "Consulting",
  "Manufacturing",
  "Education",
  "Media & Entertainment",
  "Real Estate",
  "Transportation",
  "Energy",
  "Non-profit",
  "Government",
]

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Polish",
  "Portuguese",
  "Italian",
  "Dutch",
  "Russian",
  "Chinese",
  "Japanese",
  "Korean",
]

const COMPANY_SIZES = [
  { id: "startup", label: "Startup (1-50)", icon: Rocket },
  { id: "small", label: "Small (51-200)", icon: Building },
  { id: "medium", label: "Medium (201-1K)", icon: Building2 },
  { id: "large", label: "Large (1K-5K)", icon: Landmark },
  { id: "enterprise", label: "Enterprise (5K+)", icon: Factory },
] as const

const MATCH_LEVELS = [
  { id: "high", label: "High", description: "More jobs, broader match", icon: Target },
  { id: "higher", label: "Higher", description: "Balanced matching", icon: TrendingUp },
  { id: "highest", label: "Highest", description: "Fewer jobs, precise match", icon: Zap },
] as const

export function StepJobFilters({ data, onUpdate }: StepJobFiltersProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const { hasAccess: hasAdvancedFilters, showUpgradeModal } = useFeatureAccess('advanced_filters')
  const [includeKeyword, setIncludeKeyword] = React.useState("")
  const [excludeKeyword, setExcludeKeyword] = React.useState("")
  const [excludeCompany, setExcludeCompany] = React.useState("")
  const [showTimeZoneDropdown, setShowTimeZoneDropdown] = React.useState(false)
  const [showIndustryDropdown, setShowIndustryDropdown] = React.useState(false)
  const [showLanguageDropdown, setShowLanguageDropdown] = React.useState(false)

  const toggleSeniority = (level: typeof SENIORITY_LEVELS[number]["id"]) => {
    const newLevels = data.seniority_levels.includes(level)
      ? data.seniority_levels.filter((l) => l !== level)
      : [...data.seniority_levels, level]
    onUpdate({ seniority_levels: newLevels })
  }

  const addIncludeKeyword = () => {
    const keyword = includeKeyword.trim()
    if (keyword && !data.include_keywords.includes(keyword)) {
      onUpdate({ include_keywords: [...data.include_keywords, keyword] })
      setIncludeKeyword("")
    }
  }

  const addExcludeKeyword = () => {
    const keyword = excludeKeyword.trim()
    if (keyword && !data.exclude_keywords.includes(keyword)) {
      onUpdate({ exclude_keywords: [...data.exclude_keywords, keyword] })
      setExcludeKeyword("")
    }
  }

  const addExcludeCompany = () => {
    const company = excludeCompany.trim()
    if (company && !data.exclude_companies.includes(company)) {
      onUpdate({ exclude_companies: [...data.exclude_companies, company] })
      setExcludeCompany("")
    }
  }

  const toggleTimeZone = (tz: string) => {
    const newZones = data.time_zones.includes(tz)
      ? data.time_zones.filter((z) => z !== tz)
      : [...data.time_zones, tz]
    onUpdate({ time_zones: newZones })
  }

  const toggleIndustry = (industry: string) => {
    const newIndustries = data.industries.includes(industry)
      ? data.industries.filter((i) => i !== industry)
      : [...data.industries, industry]
    onUpdate({ industries: newIndustries })
  }

  const toggleLanguage = (lang: string) => {
    const newLangs = data.job_languages.includes(lang)
      ? data.job_languages.filter((l) => l !== lang)
      : [...data.job_languages, lang]
    onUpdate({ job_languages: newLangs })
  }

  const toggleCompanySize = (size: typeof COMPANY_SIZES[number]["id"]) => {
    const currentSizes = data.company_size || []
    const newSizes = currentSizes.includes(size)
      ? currentSizes.filter((s) => s !== size)
      : [...currentSizes, size]
    onUpdate({ company_size: newSizes })
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Filter className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          Job Filters
        </h2>
        <p className="text-muted-foreground text-sm">
          Fine-tune your job matching criteria
        </p>
      </div>

      {/* Job Match Threshold */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Job Match Threshold</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {MATCH_LEVELS.map((level) => {
            const isSelected = data.match_threshold === level.id
            const Icon = level.icon

            return (
              <button
                key={level.id}
                onClick={() => onUpdate({ match_threshold: level.id })}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
                  isSelected
                    ? "border-zinc-400 bg-gradient-to-br from-zinc-50 to-zinc-50 dark:from-white/[0.03] dark:to-white/[0.03]"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isSelected
                      ? "bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-zinc-700 dark:text-zinc-300" : "text-foreground"
                  )}>
                    {level.label}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {level.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div className="border-t border-zinc-200 dark:border-white/[0.06] pt-6">
        <button
          onClick={() => {
            if (hasAdvancedFilters) {
              setShowAdvanced(!showAdvanced)
            } else {
              showUpgradeModal()
            }
          }}
          className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          {!hasAdvancedFilters && <Lock className="w-4 h-4" />}
          <Settings className="w-4 h-4" />
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          {hasAdvancedFilters ? (
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform duration-200",
              showAdvanced && "rotate-180"
            )} />
          ) : (
            <LockedBadge feature="advanced_filters" className="ml-1" />
          )}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          Seniority, time zones, industries, languages, keywords, and exclusions
        </p>
      </div>

      {/* Advanced Filters (Collapsible) */}
      {showAdvanced && (
      <div className="space-y-8 animate-in fade-in-0 slide-in-from-top-2 duration-200">

      {/* Seniority Level */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Seniority Level</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {SENIORITY_LEVELS.map((level) => {
            const isSelected = data.seniority_levels.includes(level.id)

            return (
              <button
                key={level.id}
                onClick={() => toggleSeniority(level.id)}
                className={cn(
                  "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
                  isSelected
                    ? "bg-gradient-to-r from-zinc-500 to-zinc-600 text-white shadow-md shadow-zinc-500/25"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                )}
              >
                {level.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time Zones */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Time Zones</h3>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowTimeZoneDropdown(!showTimeZoneDropdown)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.time_zones.length > 0
                ? `${data.time_zones.length} time zone(s) selected`
                : "Select time zones..."}
            </span>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </button>

          {showTimeZoneDropdown && (
            <div className="absolute z-50 w-full mt-1 py-2 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-60 overflow-auto">
              {TIME_ZONES.map((tz) => (
                <button
                  key={tz}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors",
                    data.time_zones.includes(tz) && "bg-zinc-50 dark:bg-white/[0.05]"
                  )}
                  onClick={() => toggleTimeZone(tz)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.time_zones.includes(tz)
                      ? "bg-zinc-500 border-zinc-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  )}>
                    {data.time_zones.includes(tz) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {tz}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Flexible timezone checkbox */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="flexible-tz"
            checked={data.include_flexible_timezone}
            onCheckedChange={(checked) =>
              onUpdate({ include_flexible_timezone: checked as boolean })
            }
          />
          <Label htmlFor="flexible-tz" className="text-sm cursor-pointer">
            Include jobs open to any time zone / flexible
          </Label>
        </div>
      </div>

      {/* Industry */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Industry</h3>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowIndustryDropdown(!showIndustryDropdown)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.industries.length > 0
                ? `${data.industries.length} industry(s) selected`
                : "Select industries..."}
            </span>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </button>

          {showIndustryDropdown && (
            <div className="absolute z-50 w-full mt-1 py-2 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-60 overflow-auto">
              {INDUSTRIES.map((industry) => (
                <button
                  key={industry}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors",
                    data.industries.includes(industry) && "bg-zinc-50 dark:bg-white/[0.05]"
                  )}
                  onClick={() => toggleIndustry(industry)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.industries.includes(industry)
                      ? "bg-zinc-500 border-zinc-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  )}>
                    {data.industries.includes(industry) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {industry}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Industries Tags */}
        {data.industries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.industries.map((industry) => (
              <Badge
                key={industry}
                className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {industry}
                <button
                  onClick={() => toggleIndustry(industry)}
                  className="hover:bg-zinc-300/50 dark:hover:bg-white/[0.1] rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Company Size */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Company Size</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Filter by company size based on employee count (optional)
        </p>

        <div className="flex flex-wrap gap-2">
          {COMPANY_SIZES.map((size) => {
            const isSelected = (data.company_size || []).includes(size.id)
            const Icon = size.icon

            return (
              <button
                key={size.id}
                onClick={() => toggleCompanySize(size.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
                  isSelected
                    ? "bg-gradient-to-r from-zinc-500 to-zinc-600 text-white shadow-md shadow-zinc-500/25"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                )}
              >
                <Icon className="w-4 h-4" />
                {size.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Job Description Language */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Job Description Language</h3>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.job_languages.length > 0
                ? `${data.job_languages.length} language(s) selected`
                : "Select languages..."}
            </span>
            <Languages className="w-4 h-4 text-muted-foreground" />
          </button>

          {showLanguageDropdown && (
            <div className="absolute z-50 w-full mt-1 py-2 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-60 overflow-auto">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors",
                    data.job_languages.includes(lang) && "bg-zinc-50 dark:bg-white/[0.05]"
                  )}
                  onClick={() => toggleLanguage(lang)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.job_languages.includes(lang)
                      ? "bg-zinc-500 border-zinc-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  )}>
                    {data.job_languages.includes(lang) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Languages Tags */}
        {data.job_languages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.job_languages.map((lang) => (
              <Badge
                key={lang}
                className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {lang}
                <button
                  onClick={() => toggleLanguage(lang)}
                  className="hover:bg-zinc-300/50 dark:hover:bg-white/[0.1] rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Keywords */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Job Description Keywords</h3>
        </div>

        {/* Include Keywords */}
        <div className="space-y-3 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
          <Label className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            INCLUDE - Jobs must contain these keywords
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add keyword to include..."
              value={includeKeyword}
              onChange={(e) => setIncludeKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addIncludeKeyword()
                }
              }}
              className="bg-white dark:bg-[#111113]"
            />
            <button
              onClick={addIncludeKeyword}
              className="px-3 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {data.include_keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.include_keywords.map((kw) => (
                <Badge
                  key={kw}
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 pl-3 pr-1.5 py-1.5 gap-1.5"
                >
                  {kw}
                  <button
                    onClick={() => onUpdate({
                      include_keywords: data.include_keywords.filter((k) => k !== kw),
                    })}
                    className="hover:bg-emerald-300/50 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Exclude Keywords */}
        <div className="space-y-3 p-4 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
          <Label className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
            <Ban className="w-4 h-4" />
            EXCLUDE - Jobs must NOT contain these keywords
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add keyword to exclude..."
              value={excludeKeyword}
              onChange={(e) => setExcludeKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addExcludeKeyword()
                }
              }}
              className="bg-white dark:bg-[#111113]"
            />
            <button
              onClick={addExcludeKeyword}
              className="px-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {data.exclude_keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.exclude_keywords.map((kw) => (
                <Badge
                  key={kw}
                  className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 pl-3 pr-1.5 py-1.5 gap-1.5"
                >
                  {kw}
                  <button
                    onClick={() => onUpdate({
                      exclude_keywords: data.exclude_keywords.filter((k) => k !== kw),
                    })}
                    className="hover:bg-red-300/50 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Exclude Companies */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Exclude Companies</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Add companies you do not want to see jobs from
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Company name to exclude..."
            value={excludeCompany}
            onChange={(e) => setExcludeCompany(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addExcludeCompany()
              }
            }}
          />
          <button
            onClick={addExcludeCompany}
            className="px-4 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {data.exclude_companies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.exclude_companies.map((company) => (
              <Badge
                key={company}
                variant="outline"
                className="pl-3 pr-1.5 py-1.5 gap-1.5 border-zinc-300 dark:border-zinc-600"
              >
                {company}
                <button
                  onClick={() => onUpdate({
                    exclude_companies: data.exclude_companies.filter((c) => c !== company),
                  })}
                  className="hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showTimeZoneDropdown || showIndustryDropdown || showLanguageDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowTimeZoneDropdown(false)
            setShowIndustryDropdown(false)
            setShowLanguageDropdown(false)
          }}
        />
      )}
    </div>
  )
}
