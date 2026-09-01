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
  Link2,
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
          <FileText className="w-5 h-5 text-muted-foreground" />
          Screening Questions
        </h2>
        <p className="text-muted-foreground text-sm">
          Information commonly requested in job applications
        </p>
      </div>

      {/* Personal Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Personal Information</h3>
          <span className="text-xs text-red-500 font-medium">Required</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              placeholder="Maya"
              value={data.first_name || ""}
              onChange={(e) => onUpdate({ first_name: e.target.value })}
              className={cn(
                !data.first_name && "border-[var(--coral)]/45"
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              placeholder="Nowak"
              value={data.last_name || ""}
              onChange={(e) => onUpdate({ last_name: e.target.value })}
              className={cn(
                !data.last_name && "border-[var(--coral)]/45"
              )}
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Location</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="screening-country" className="text-sm text-muted-foreground">Country</Label>
            <div className="relative">
              <button
                id="screening-country"
                type="button"
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                aria-haspopup="dialog"
                aria-expanded={showCountryDropdown}
                aria-controls="screening-country-dialog"
                className="w-full flex items-center justify-between h-10 px-3 bg-background rounded-md border border-input hover:border-muted-foreground/40 transition-colors text-sm"
              >
                <span className={data.country ? "text-foreground" : "text-muted-foreground"}>
                  {data.country || "Select country..."}
                </span>
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCountryDropdown && (
                <div
                  id="screening-country-dialog"
                  role="dialog"
                  aria-label="Choose country"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setShowCountryDropdown(false)
                      document.getElementById("screening-country")?.focus()
                    }
                  }}
                  className="absolute z-50 w-full mt-1 py-1 bg-popover rounded-lg border border-border shadow-lg max-h-48 overflow-auto"
                >
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
                      type="button"
                      aria-pressed={data.country === country}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
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
            <Label htmlFor="screening-city" className="text-sm text-muted-foreground">City</Label>
            <Input
              id="screening-city"
              placeholder="City"
              value={data.city}
              onChange={(e) => onUpdate({ city: e.target.value })}
            />
          </div>

          {/* State/Region */}
          <div className="space-y-2">
            <Label htmlFor="screening-state-region" className="text-sm text-muted-foreground">State / Region</Label>
            <Input
              id="screening-state-region"
              placeholder="State or region"
              value={data.state_region}
              onChange={(e) => onUpdate({ state_region: e.target.value })}
            />
          </div>

          {/* Postcode */}
          <div className="space-y-2">
            <Label htmlFor="screening-postcode" className="text-sm text-muted-foreground">Postcode</Label>
            <Input
              id="screening-postcode"
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
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          <Label htmlFor="screening-current-job-title" className="font-medium">Current Job Title</Label>
        </div>
        <Input
          id="screening-current-job-title"
          placeholder="e.g., Senior Software Engineer"
          value={data.current_job_title}
          onChange={(e) => onUpdate({ current_job_title: e.target.value })}
        />
      </div>

      {/* Availability */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Availability</h3>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Availability">
          {AVAILABILITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onUpdate({ availability: option.id })}
              aria-pressed={data.availability === option.id}
              className={cn(
                "px-4 py-2.5 rounded-full text-sm font-medium transition-all",
                data.availability === option.id
                  ? "bg-[var(--coral)] text-[var(--coral-ink)] shadow-md shadow-[var(--coral)]/25"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
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
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Work Authorization</h3>
          <span className="text-xs text-red-500 font-medium">* Required</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Which countries are you authorized to work in?
        </p>

        {/* Validation Warning */}
        {data.work_authorization_countries.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--coral-soft)] p-3 text-sm text-[var(--coral-lo)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Select at least one country where you are authorized to work
          </div>
        )}

        <div className="relative">
          <button
            id="work-authorization-countries"
            type="button"
            onClick={() => setShowAuthCountryDropdown(!showAuthCountryDropdown)}
            aria-haspopup="listbox"
            aria-expanded={showAuthCountryDropdown}
            aria-controls="work-authorization-listbox"
            className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-xl border border-border hover:border-muted-foreground/40 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.work_authorization_countries.length > 0
                ? `${data.work_authorization_countries.length} countries selected`
                : "Select countries..."}
            </span>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </button>
          {showAuthCountryDropdown && (
            <div
              id="work-authorization-listbox"
              role="listbox"
              aria-label="Work authorization countries"
              aria-multiselectable="true"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowAuthCountryDropdown(false)
                  document.getElementById("work-authorization-countries")?.focus()
                }
              }}
              className="absolute z-50 w-full mt-1 py-2 bg-popover rounded-xl border border-border shadow-lg max-h-60 overflow-auto"
            >
              {COUNTRIES.map((country) => (
                <button
                  key={country}
                  type="button"
                  role="option"
                  aria-selected={data.work_authorization_countries.includes(country)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-accent transition-colors",
                    data.work_authorization_countries.includes(country) && "bg-secondary"
                  )}
                  onClick={() => toggleWorkAuthCountry(country)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.work_authorization_countries.includes(country)
                      ? "bg-[var(--coral)] border-[var(--coral)]"
                      : "border-input"
                  )}>
                    {data.work_authorization_countries.includes(country) && (
                      <svg className="w-3 h-3 text-[var(--coral-ink)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className="bg-secondary text-foreground pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {country}
                <button
                  type="button"
                  aria-label={`Remove work authorization country ${country}`}
                  onClick={() => toggleWorkAuthCountry(country)}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Visa Sponsorship */}
      <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
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
          <Label htmlFor="screening-nationality" className="font-medium">Nationality</Label>
          <span className="text-xs text-muted-foreground">{data.nationalities.length}/3</span>
        </div>
        <div className="relative">
          <button
            id="screening-nationality"
            type="button"
            onClick={() => setShowNationalityDropdown(!showNationalityDropdown)}
            aria-haspopup="listbox"
            aria-expanded={showNationalityDropdown}
            aria-controls="nationality-listbox"
            className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-xl border border-border hover:border-muted-foreground/40 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              {data.nationalities.length > 0
                ? `${data.nationalities.length} selected`
                : "Select up to 3 nationalities..."}
            </span>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </button>
          {showNationalityDropdown && (
            <div
              id="nationality-listbox"
              role="listbox"
              aria-label="Nationalities"
              aria-multiselectable="true"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowNationalityDropdown(false)
                  document.getElementById("screening-nationality")?.focus()
                }
              }}
              className="absolute z-50 w-full mt-1 py-2 bg-popover rounded-xl border border-border shadow-lg max-h-60 overflow-auto"
            >
              {NATIONALITIES.map((nat) => (
                <button
                  key={nat}
                  type="button"
                  role="option"
                  aria-selected={data.nationalities.includes(nat)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-accent transition-colors",
                    data.nationalities.includes(nat) && "bg-secondary",
                    !data.nationalities.includes(nat) && data.nationalities.length >= 3 && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => toggleNationality(nat)}
                  disabled={!data.nationalities.includes(nat) && data.nationalities.length >= 3}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    data.nationalities.includes(nat)
                      ? "bg-[var(--coral)] border-[var(--coral)]"
                      : "border-input"
                  )}>
                    {data.nationalities.includes(nat) && (
                      <svg className="w-3 h-3 text-[var(--coral-ink)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className="bg-secondary text-foreground pl-3 pr-1.5 py-1.5 gap-1.5"
              >
                {nat}
                <button
                  type="button"
                  aria-label={`Remove nationality ${nat}`}
                  onClick={() => toggleNationality(nat)}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5"
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
          <Link2 className="w-4 h-4 text-muted-foreground" />
          <Label htmlFor="screening-linkedin" className="font-medium">LinkedIn Profile</Label>
        </div>
        <Input
          id="screening-linkedin"
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
          <Label htmlFor="screening-experience-summary" className="font-medium">Experience Summary</Label>
          <span id="screening-experience-count" className={cn(
            "text-xs",
            data.experience_summary.length > 450 ? "text-[var(--coral-lo)]" : "text-muted-foreground"
          )}>
            {data.experience_summary.length}/500
          </span>
        </div>
        <Textarea
          id="screening-experience-summary"
          aria-describedby="screening-experience-count"
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
