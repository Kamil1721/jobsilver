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
  Settings,
  Users,
  Rocket,
  Building,
  Landmark,
  Factory,
  Lock,
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
            <Filter className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            Advanced Filters
            <LockedBadge feature="advanced_filters" className="ml-1" />
          </h2>
          <p className="text-muted-foreground text-sm">
            Fine-tune your job matching with Pro features
          </p>
        </div>

        {/* Upgrade Prompt */}
        <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-white/[0.08] p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
            <Crown className="w-6 h-6 text-white" />
          </div>

          <h3 className="text-lg font-semibold mb-2">Upgrade to Pro for Advanced Filters</h3>

          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Take control of your job search with powerful filtering options.
            Free users get all matching jobs - Pro users can fine-tune results.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-left max-w-md mx-auto mb-6">
            {PRO_FILTER_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-zinc-600 dark:text-zinc-400">{feature}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={() => showUpgradeModal()}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
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
            <Filter className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            Advanced Filters
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs py-0">
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
          <Sliders className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Job Match Threshold</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Control how strictly jobs must match your profile. Lower threshold = more jobs.
        </p>

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

      {/* Seniority Level */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Seniority Level</h3>
          <span className="text-xs text-muted-foreground">(Optional - scoring only)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Prioritize jobs at specific experience levels. Non-matching jobs still appear but rank lower.
        </p>

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

      {/* Company Size */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Company Size</h3>
          <span className="text-xs text-muted-foreground">(Optional - scoring only)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Prefer jobs at specific company sizes. All companies still appear, matching sizes rank higher.
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

      {/* Time Zones */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Time Zones</h3>
          <span className="text-xs text-muted-foreground">(Optional - scoring only)</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Prefer jobs in specific time zones. Jobs in other time zones still appear but rank lower.
        </p>

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
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              showTimeZoneDropdown && "rotate-180"
            )} />
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
            Boost jobs that are flexible with time zones
          </Label>
        </div>

        {/* Selected Time Zones Tags */}
        {data.time_zones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.time_zones.map((tz) => (
              <Badge
                key={tz}
                className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {tz.split(' ')[0]}
                <button
                  onClick={() => toggleTimeZone(tz)}
                  className="hover:bg-zinc-300/50 dark:hover:bg-white/[0.1] rounded-full p-0.5"
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
          <DollarSign className="w-4 h-4 text-zinc-500" />
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
            className="text-sm px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#111113]"
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
