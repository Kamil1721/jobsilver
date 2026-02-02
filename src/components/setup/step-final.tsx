"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  MapPin,
  Plane,
  Languages,
  Car,
  Lock,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react"
import type { ScreeningAnswers } from "@/lib/supabase/types"

interface StepFinalProps {
  data: ScreeningAnswers
  onUpdate: (updates: Partial<ScreeningAnswers>) => void
  isFirstTimeSetup?: boolean
}

const SPOKEN_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Polish",
  "Portuguese",
  "Italian",
  "Dutch",
  "Russian",
  "Chinese (Mandarin)",
  "Japanese",
  "Korean",
  "Arabic",
  "Hindi",
  "Swedish",
  "Norwegian",
]

export function StepFinal({ data, onUpdate, isFirstTimeSetup = true }: StepFinalProps) {
  const [showLanguageDropdown, setShowLanguageDropdown] = React.useState(false)

  const toggleLanguage = (lang: string) => {
    if (data.spoken_languages.includes(lang)) {
      onUpdate({ spoken_languages: data.spoken_languages.filter((l) => l !== lang) })
    } else if (data.spoken_languages.length < 6) {
      onUpdate({ spoken_languages: [...data.spoken_languages, lang] })
    }
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          Additional Information
        </h2>
        <p className="text-muted-foreground text-sm">
          Optional details that may help with certain job applications
        </p>
      </div>

      {/* Travel & Relocation */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Travel & Relocation</h3>
        </div>

        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-white/[0.02] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center">
              <Plane className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <Label htmlFor="travel-toggle" className="text-base font-medium cursor-pointer">
                Open to Travel
              </Label>
              <p className="text-sm text-muted-foreground">
                Willing to travel for work
              </p>
            </div>
          </div>
          <Switch
            id="travel-toggle"
            checked={data.open_to_travel}
            onCheckedChange={(checked) => onUpdate({ open_to_travel: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-white/[0.02] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <Label htmlFor="relocate-toggle" className="text-base font-medium cursor-pointer">
                Open to Relocation
              </Label>
              <p className="text-sm text-muted-foreground">
                Willing to relocate for the right opportunity
              </p>
            </div>
          </div>
          <Switch
            id="relocate-toggle"
            checked={data.open_to_relocation}
            onCheckedChange={(checked) => onUpdate({ open_to_relocation: checked })}
          />
        </div>
      </div>

      {/* Languages Spoken */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-zinc-500" />
            <h3 className="font-medium">Languages Spoken</h3>
          </div>
          <span className="text-xs text-muted-foreground">{data.spoken_languages.length}/6</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.spoken_languages.length > 0
                ? `${data.spoken_languages.length} language(s) selected`
                : "Select up to 6 languages..."}
            </span>
            <Languages className="w-4 h-4 text-muted-foreground" />
          </button>
          {showLanguageDropdown && (
            <div className="absolute z-[100] w-full mt-1 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl max-h-60 overflow-auto">
              {SPOKEN_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors",
                    data.spoken_languages.includes(lang) && "bg-zinc-50 dark:bg-white/[0.05]",
                    !data.spoken_languages.includes(lang) && data.spoken_languages.length >= 6 && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => toggleLanguage(lang)}
                  disabled={!data.spoken_languages.includes(lang) && data.spoken_languages.length >= 6}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.spoken_languages.includes(lang)
                      ? "bg-zinc-500 border-zinc-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  )}>
                    {data.spoken_languages.includes(lang) && (
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
        {data.spoken_languages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.spoken_languages.map((lang) => (
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

      {/* Driving License & Security Clearance */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Credentials (Optional)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Some jobs may require these. Leave blank if not applicable.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Car className="w-4 h-4" />
              Driving License
            </Label>
            <Input
              placeholder="e.g., Full, Class B"
              value={data.driving_license || ""}
              onChange={(e) => onUpdate({ driving_license: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Security Clearance
            </Label>
            <Input
              placeholder="e.g., Secret, Top Secret"
              value={data.security_clearance || ""}
              onChange={(e) => onUpdate({ security_clearance: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      {/* Summary Card - only show for first-time setup */}
      {isFirstTimeSetup && (
        <div className="p-6 bg-gradient-to-br from-zinc-50 to-zinc-50 dark:from-white/[0.03] dark:to-white/[0.03] rounded-2xl border border-zinc-200 dark:border-white/[0.06]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Ready to Find Jobs!</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Click &quot;Save Configuration&quot; to start discovering job matches. Your <strong>first matches arrive instantly</strong>, then new jobs are delivered <strong>daily</strong>.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>First matches: Instant</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>New matches: Daily</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>AI assistant ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showLanguageDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowLanguageDropdown(false)}
        />
      )}
    </div>
  )
}
