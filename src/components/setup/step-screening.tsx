"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  FileText,
  MapPin,
  Briefcase,
  Calendar,
  Globe,
  Linkedin,
  X,
  Shield,
  AlertCircle,
} from "lucide-react"
import type { ScreeningAnswers } from "@/lib/supabase/types"

interface StepScreeningProps {
  data: ScreeningAnswers
  onUpdate: (updates: Partial<ScreeningAnswers>) => void
}

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "Poland",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Australia",
  "Ireland",
  "Switzerland",
  "Singapore",
  "Japan",
]

const AVAILABILITY_OPTIONS = [
  { id: "immediately", label: "Immediately" },
  { id: "1_week", label: "1 Week" },
  { id: "2_weeks", label: "2 Weeks" },
  { id: "1_month", label: "1 Month" },
  { id: "2_months", label: "2 Months" },
] as const

const NATIONALITIES = [
  "American",
  "British",
  "Canadian",
  "German",
  "Polish",
  "French",
  "Spanish",
  "Italian",
  "Dutch",
  "Australian",
  "Irish",
  "Swiss",
  "Japanese",
  "Chinese",
  "Indian",
]

export function StepScreening({ data, onUpdate }: StepScreeningProps) {
  const [showCountryDropdown, setShowCountryDropdown] = React.useState(false)
  const [showAuthCountryDropdown, setShowAuthCountryDropdown] = React.useState(false)
  const [showNationalityDropdown, setShowNationalityDropdown] = React.useState(false)
  const [countrySearch, setCountrySearch] = React.useState("")

  const filteredCountries = COUNTRIES.filter(
    (c) => c.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const toggleWorkAuthCountry = (country: string) => {
    const newCountries = data.work_authorization_countries.includes(country)
      ? data.work_authorization_countries.filter((c) => c !== country)
      : [...data.work_authorization_countries, country]
    onUpdate({ work_authorization_countries: newCountries })
  }

  const toggleNationality = (nat: string) => {
    if (data.nationalities.includes(nat)) {
      onUpdate({ nationalities: data.nationalities.filter((n) => n !== nat) })
    } else if (data.nationalities.length < 3) {
      onUpdate({ nationalities: [...data.nationalities, nat] })
    }
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          Screening Questions
        </h2>
        <p className="text-muted-foreground text-sm">
          Information commonly requested in job applications
        </p>
      </div>

      {/* Personal Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Personal Information</h3>
          <span className="text-xs text-red-500 font-medium">Required</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              placeholder="John"
              value={data.first_name || ""}
              onChange={(e) => onUpdate({ first_name: e.target.value })}
              className={cn(
                !data.first_name && "border-amber-300 dark:border-amber-700"
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              placeholder="Doe"
              value={data.last_name || ""}
              onChange={(e) => onUpdate({ last_name: e.target.value })}
              className={cn(
                !data.last_name && "border-amber-300 dark:border-amber-700"
              )}
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Location</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Country */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Country</Label>
            <div className="relative">
              <button
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className="w-full flex items-center justify-between h-10 px-3 bg-background rounded-md border border-input hover:border-zinc-400 transition-colors text-sm"
              >
                <span className={data.country ? "text-foreground" : "text-muted-foreground"}>
                  {data.country || "Select country..."}
                </span>
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCountryDropdown && (
                <div className="absolute z-50 w-full mt-1 py-1 bg-white dark:bg-[#111113] rounded-lg border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-48 overflow-auto">
                  <div className="px-2 py-1.5">
                    <Input
                      placeholder="Search..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  {filteredCountries.map((country) => (
                    <button
                      key={country}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.05]"
                      onClick={() => {
                        onUpdate({ country })
                        setShowCountryDropdown(false)
                        setCountrySearch("")
                      }}
                    >
                      {country}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">City</Label>
            <Input
              placeholder="City"
              value={data.city}
              onChange={(e) => onUpdate({ city: e.target.value })}
            />
          </div>

          {/* State/Region */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">State / Region</Label>
            <Input
              placeholder="State or region"
              value={data.state_region}
              onChange={(e) => onUpdate({ state_region: e.target.value })}
            />
          </div>

          {/* Postcode */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Postcode</Label>
            <Input
              placeholder="Postcode / ZIP"
              value={data.postcode}
              onChange={(e) => onUpdate({ postcode: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Current Job Title */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-zinc-500" />
          <Label className="font-medium">Current Job Title</Label>
        </div>
        <Input
          placeholder="e.g., Senior Software Engineer"
          value={data.current_job_title}
          onChange={(e) => onUpdate({ current_job_title: e.target.value })}
        />
      </div>

      {/* Availability */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Availability</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => onUpdate({ availability: option.id })}
              className={cn(
                "px-4 py-2.5 rounded-full text-sm font-medium transition-all",
                data.availability === option.id
                  ? "bg-gradient-to-r from-zinc-500 to-zinc-600 text-white shadow-md shadow-zinc-500/25"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work Authorization */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-zinc-500" />
          <h3 className="font-medium">Work Authorization</h3>
          <span className="text-xs text-red-500 font-medium">* Required</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Which countries are you authorized to work in?
        </p>

        {/* Validation Warning */}
        {data.work_authorization_countries.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one country where you are authorized to work
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowAuthCountryDropdown(!showAuthCountryDropdown)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.work_authorization_countries.length > 0
                ? `${data.work_authorization_countries.length} countries selected`
                : "Select countries..."}
            </span>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </button>
          {showAuthCountryDropdown && (
            <div className="absolute z-50 w-full mt-1 py-2 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-60 overflow-auto">
              {COUNTRIES.map((country) => (
                <button
                  key={country}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors",
                    data.work_authorization_countries.includes(country) && "bg-zinc-50 dark:bg-white/[0.05]"
                  )}
                  onClick={() => toggleWorkAuthCountry(country)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.work_authorization_countries.includes(country)
                      ? "bg-zinc-500 border-zinc-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  )}>
                    {data.work_authorization_countries.includes(country) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {country}
                </button>
              ))}
            </div>
          )}
        </div>
        {data.work_authorization_countries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.work_authorization_countries.map((country) => (
              <Badge
                key={country}
                className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {country}
                <button
                  onClick={() => toggleWorkAuthCountry(country)}
                  className="hover:bg-zinc-300/50 dark:hover:bg-white/[0.1] rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Visa Sponsorship */}
      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-white/[0.02] rounded-xl">
        <div>
          <Label htmlFor="visa-toggle" className="text-base font-medium cursor-pointer">
            Require Visa Sponsorship?
          </Label>
          <p className="text-sm text-muted-foreground">
            Do you need visa sponsorship to work?
          </p>
        </div>
        <Switch
          id="visa-toggle"
          checked={data.requires_visa_sponsorship}
          onCheckedChange={(checked) => onUpdate({ requires_visa_sponsorship: checked })}
        />
      </div>

      {/* Nationality */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="font-medium">Nationality</Label>
          <span className="text-xs text-muted-foreground">{data.nationalities.length}/3</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowNationalityDropdown(!showNationalityDropdown)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.nationalities.length > 0
                ? `${data.nationalities.length} selected`
                : "Select up to 3 nationalities..."}
            </span>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </button>
          {showNationalityDropdown && (
            <div className="absolute z-50 w-full mt-1 py-2 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-white/[0.06] shadow-lg max-h-60 overflow-auto">
              {NATIONALITIES.map((nat) => (
                <button
                  key={nat}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors",
                    data.nationalities.includes(nat) && "bg-zinc-50 dark:bg-white/[0.05]",
                    !data.nationalities.includes(nat) && data.nationalities.length >= 3 && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => toggleNationality(nat)}
                  disabled={!data.nationalities.includes(nat) && data.nationalities.length >= 3}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.nationalities.includes(nat)
                      ? "bg-zinc-500 border-zinc-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  )}>
                    {data.nationalities.includes(nat) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {nat}
                </button>
              ))}
            </div>
          )}
        </div>
        {data.nationalities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.nationalities.map((nat) => (
              <Badge
                key={nat}
                className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {nat}
                <button
                  onClick={() => toggleNationality(nat)}
                  className="hover:bg-zinc-300/50 dark:hover:bg-white/[0.1] rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* LinkedIn */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Linkedin className="w-4 h-4 text-zinc-500" />
          <Label className="font-medium">LinkedIn Profile</Label>
        </div>
        <Input
          placeholder="https://linkedin.com/in/your-profile"
          value={data.linkedin_url || ""}
          onChange={(e) => onUpdate({ linkedin_url: e.target.value || null })}
          disabled={data.no_linkedin}
          className={data.no_linkedin ? "opacity-50" : ""}
        />
        <div className="flex items-center gap-3">
          <Checkbox
            id="no-linkedin"
            checked={data.no_linkedin}
            onCheckedChange={(checked) => onUpdate({
              no_linkedin: checked as boolean,
              linkedin_url: checked ? null : data.linkedin_url,
            })}
          />
          <Label htmlFor="no-linkedin" className="text-sm cursor-pointer text-muted-foreground">
            I do not use LinkedIn
          </Label>
        </div>
      </div>

      {/* Experience Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium">Experience Summary</Label>
          <span className={cn(
            "text-xs",
            data.experience_summary.length > 450 ? "text-amber-600" : "text-muted-foreground"
          )}>
            {data.experience_summary.length}/500
          </span>
        </div>
        <Textarea
          placeholder="Brief summary of your professional experience..."
          value={data.experience_summary}
          onChange={(e) => {
            // Allow the change but truncate to 500 chars if needed
            const value = e.target.value.slice(0, 500)
            onUpdate({ experience_summary: value })
          }}
          className="min-h-[120px] resize-none"
        />
      </div>

      {/* Click outside to close dropdowns */}
      {(showCountryDropdown || showAuthCountryDropdown || showNationalityDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowCountryDropdown(false)
            setShowAuthCountryDropdown(false)
            setShowNationalityDropdown(false)
          }}
        />
      )}
    </div>
  )
}
