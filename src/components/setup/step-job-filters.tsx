"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Filter,
  Sliders,
  Clock,
  Building2,
  X,
  Plus,
  Ban,
  Target,
  TrendingUp,
  Zap,
  ChevronDown,
  Users,
  Rocket,
  Building,
  Landmark,
  Factory,
  Crown,
  DollarSign,
  RotateCcw,
} from "lucide-react"
import type { JobFilters } from "@/lib/supabase/types"
import { useFeatureAccess } from "@/hooks/useFeatureAccess"
import { LockedBadge } from "@/components/ui/feature-gate"

interface StepJobFiltersProps {
  data: JobFilters
  onUpdate: (updates: Partial<JobFilters>) => void
  onReset?: () => void
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

// Pro features list for the upgrade prompt
const PRO_FILTER_FEATURES = [
  "Match quality threshold control",
  "Seniority level filtering",
  "Company size preferences",
  "Time zone filtering",
  "Salary range filtering",
  "Exclude specific keywords",
  "Block specific companies",
]

export function StepJobFilters({ data, onUpdate, onReset }: StepJobFiltersProps) {
  const { hasAccess: hasAdvancedFilters, showUpgradeModal } = useFeatureAccess('advanced_filters')
  const [excludeKeyword, setExcludeKeyword] = React.useState("")
  const [excludeCompany, setExcludeCompany] = React.useState("")
  const [showTimeZoneDropdown, setShowTimeZoneDropdown] = React.useState(false)

  const toggleSeniority = (level: typeof SENIORITY_LEVELS[number]["id"]) => {
    const newLevels = data.seniority_levels.includes(level)
      ? data.seniority_levels.filter((l) => l !== level)
      : [...data.seniority_levels, level]
    onUpdate({ seniority_levels: newLevels })
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

  const toggleCompanySize = (size: typeof COMPANY_SIZES[number]["id"]) => {
    const currentSizes = data.company_size || []
    const newSizes = currentSizes.includes(size)
      ? currentSizes.filter((s) => s !== size)
      : [...currentSizes, size]
    onUpdate({ company_size: newSizes })
  }

  // Free users see upgrade prompt instead of filters
  if (!hasAdvancedFilters) {
    return (
      <div className="space-y-8">
        {/* Section Header */}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            Advanced Filters
            <LockedBadge feature="advanced_filters" className="ml-1" />
          </h2>
          <p className="text-muted-foreground text-sm">
            Fine-tune your job matching with Pro features
          </p>
        </div>

        {/* Upgrade Prompt */}
        <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--coral-soft)]">
            <Crown className="h-6 w-6 text-[var(--coral-lo)]" />
          </div>

          <h3 className="text-lg font-semibold mb-2">Upgrade to Pro for Advanced Filters</h3>

          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Take control of your job search with powerful filtering options.
            Free users get all matching jobs - Pro users can fine-tune results.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-left max-w-md mx-auto mb-6">
            {PRO_FILTER_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--coral-soft)]">
                  <svg className="h-3 w-3 text-[var(--coral-lo)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={() => showUpgradeModal()}
            className="bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)]"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            You can skip this step - your essential filters are already set.
          </p>
        </div>
      </div>
    )
  }

  // Pro users see full advanced filters
  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            Advanced Filters
            <Badge className="border border-[var(--coral)]/20 bg-[var(--coral-soft)] py-0 text-xs text-[var(--coral-lo)]">
              Pro
            </Badge>
          </h2>
          <p className="text-muted-foreground text-sm">
            Fine-tune your job matching with advanced options
          </p>
        </div>
        {onReset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset All
          </Button>
        )}
      </div>

      {/* Job Match Threshold */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Job Match Threshold</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Control how strictly jobs must match your profile. Lower threshold = more jobs.
        </p>

        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Job match threshold">
          {MATCH_LEVELS.map((level) => {
            const isSelected = data.match_threshold === level.id
            const Icon = level.icon

            return (
              <button
                key={level.id}
                type="button"
                onClick={() => onUpdate({ match_threshold: level.id })}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2",
                  isSelected
                    ? "border-[var(--coral)] bg-[var(--coral-soft)]"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isSelected
                      ? "bg-[var(--coral)] text-[var(--coral-ink)]"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-foreground" : "text-foreground"
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

      {/* Seniority Level */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Seniority Level</h3>
          <span className="text-xs text-muted-foreground">(Optional - scoring only)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Prioritize jobs at specific experience levels. Non-matching jobs still appear but rank lower.
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Seniority levels">
          {SENIORITY_LEVELS.map((level) => {
            const isSelected = data.seniority_levels.includes(level.id)

            return (
              <button
                key={level.id}
                type="button"
                onClick={() => toggleSeniority(level.id)}
                aria-pressed={isSelected}
                className={cn(
                  "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2",
                  isSelected
                    ? "bg-[var(--coral)] text-[var(--coral-ink)] shadow-md shadow-[var(--coral)]/25"
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                )}
              >
                {level.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Company Size */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Company Size</h3>
          <span className="text-xs text-muted-foreground">(Optional - scoring only)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Prefer jobs at specific company sizes. All companies still appear, matching sizes rank higher.
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Company sizes">
          {COMPANY_SIZES.map((size) => {
            const isSelected = (data.company_size || []).includes(size.id)
            const Icon = size.icon

            return (
              <button
                key={size.id}
                type="button"
                onClick={() => toggleCompanySize(size.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2",
                  isSelected
                    ? "bg-[var(--coral)] text-[var(--coral-ink)] shadow-md shadow-[var(--coral)]/25"
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                )}
              >
                <Icon className="w-4 h-4" />
                {size.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time Zones */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Time Zones</h3>
          <span className="text-xs text-muted-foreground">(Optional - scoring only)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Prefer jobs in specific time zones. Jobs in other time zones still appear but rank lower.
        </p>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTimeZoneDropdown(!showTimeZoneDropdown)}
            aria-haspopup="listbox"
            aria-expanded={showTimeZoneDropdown}
            aria-controls="setup-time-zone-listbox"
            className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-xl border border-border hover:border-muted-foreground/40 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.time_zones.length > 0
                ? `${data.time_zones.length} time zone(s) selected`
                : "Select time zones..."}
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              showTimeZoneDropdown && "rotate-180"
            )} />
          </button>

          {showTimeZoneDropdown && (
            <div
              id="setup-time-zone-listbox"
              role="listbox"
              aria-label="Time zones"
              className="absolute z-50 w-full mt-1 py-2 bg-popover rounded-xl border border-border shadow-lg max-h-60 overflow-auto"
            >
              {TIME_ZONES.map((tz) => (
                <button
                  key={tz}
                  type="button"
                  role="option"
                  aria-selected={data.time_zones.includes(tz)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-accent transition-colors",
                    data.time_zones.includes(tz) && "bg-secondary"
                  )}
                  onClick={() => toggleTimeZone(tz)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.time_zones.includes(tz)
                      ? "bg-[var(--coral)] border-[var(--coral)]"
                      : "border-input"
                  )}>
                    {data.time_zones.includes(tz) && (
                      <svg className="w-3 h-3 text-[var(--coral-ink)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            Boost jobs that are flexible with time zones
          </Label>
        </div>

        {/* Selected Time Zones Tags */}
        {data.time_zones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.time_zones.map((tz) => (
              <Badge
                key={tz}
                className="bg-secondary text-foreground pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {tz.split(' ')[0]}
                  <button
                    type="button"
                    aria-label={`Remove ${tz}`}
                    onClick={() => toggleTimeZone(tz)}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Salary Range */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Salary Range</h3>
          <span className="text-xs text-muted-foreground">(Optional - scoring only)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Set salary expectations. Jobs outside this range still appear but rank lower.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Minimum Salary</Label>
            <Input
              type="number"
              placeholder="e.g., 50000"
              value={data.salary_min || ""}
              onChange={(e) => onUpdate({ salary_min: e.target.value ? parseInt(e.target.value) : null })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Maximum Salary</Label>
            <Input
              type="number"
              placeholder="e.g., 150000"
              value={data.salary_max || ""}
              onChange={(e) => onUpdate({ salary_max: e.target.value ? parseInt(e.target.value) : null })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Currency:</Label>
          <select
            value={data.salary_currency || "USD"}
            onChange={(e) => onUpdate({ salary_currency: e.target.value })}
            className="text-sm px-2 py-1 rounded-lg border border-border bg-card"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="PLN">PLN</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>
      </div>

      {/* Exclude Keywords - HARD Filter */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-red-500" />
          <h3 className="font-medium">Exclude Keywords</h3>
          <span className="text-xs text-red-500 font-medium">(Hard filter - blocks jobs)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Jobs containing these keywords will be completely hidden from your results.
        </p>

        <div className="space-y-3 p-4 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
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
              className="bg-card"
            />
            <button
              type="button"
              onClick={addExcludeKeyword}
              aria-label="Add excluded keyword"
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
                    type="button"
                    aria-label={`Remove excluded keyword ${kw}`}
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

      {/* Exclude Companies - HARD Filter */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-red-500" />
          <h3 className="font-medium">Exclude Companies</h3>
          <span className="text-xs text-red-500 font-medium">(Hard filter - blocks jobs)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Jobs from these companies will be completely hidden from your results.
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
            type="button"
            onClick={addExcludeCompany}
            aria-label="Add excluded company"
            className="px-4 rounded-lg bg-secondary text-foreground hover:bg-accent transition-colors"
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
                className="pl-3 pr-1.5 py-1.5 gap-1.5 border-border"
              >
                {company}
                <button
                  type="button"
                  aria-label={`Remove excluded company ${company}`}
                  onClick={() => onUpdate({
                    exclude_companies: data.exclude_companies.filter((c) => c !== company),
                  })}
                  className="hover:bg-accent rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close dropdowns */}
      {showTimeZoneDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowTimeZoneDropdown(false)}
        />
      )}
    </div>
  )
}
