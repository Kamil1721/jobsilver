"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StepJobPreferences } from "./step-job-preferences"
import { StepJobFilters } from "./step-job-filters"
import { StepScreening } from "./step-screening"
import { StepCV } from "./step-cv"
import { StepFinal } from "./step-final"
import type { JobFilters, ScreeningAnswers, SubscriptionPlan } from "@/lib/supabase/types"
import { validateMandatoryFilters, validateScreeningAnswers } from "@/lib/filter-validation"
import { normalizeCity, normalizeCountry } from "@/lib/utils/location-normalizer"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Briefcase,
  Filter,
  FileText,
  Settings,
  Globe,
} from "lucide-react"

const STEPS = [
  { id: 1, title: "Job Preferences", icon: Briefcase, description: "Location & job types" },
  { id: 2, title: "Job Filters", icon: Filter, description: "Match criteria" },
  { id: 3, title: "Screening", icon: FileText, description: "Your profile" },
  { id: 4, title: "Your CV", icon: FileText, description: "CV upload or generate" },
  { id: 5, title: "Finalize", icon: Settings, description: "Review & save" },
]

const DEFAULT_JOB_FILTERS: JobFilters = {
  remote_jobs: true,
  remote_countries: [],
  onsite_hybrid: false,
  onsite_locations: [],
  job_types: ["fulltime"],
  job_titles: [],
  match_threshold: "high",
  seniority_levels: [],
  time_zones: [],
  include_flexible_timezone: true,
  include_worldwide_remote: true,
  industries: [],
  job_languages: ["English"],
  include_keywords: [],
  exclude_keywords: [],
  exclude_companies: [],
  salary_min: null,
  salary_max: null,
  salary_currency: "USD",
  company_size: [],
}

const DEFAULT_SCREENING_ANSWERS: ScreeningAnswers = {
  first_name: "",
  last_name: "",
  cv_url: null,
  cover_letter_mode: "auto_generate",
  cover_letter_url: null,
  phone_country_code: "+1",
  phone_number: "",
  country: "",
  city: "",
  state_region: "",
  postcode: "",
  current_job_title: "",
  experience_summary: "",
  linkedin_url: null,
  no_linkedin: false,
  availability: "2_weeks",
  work_authorization_countries: [],
  requires_visa_sponsorship: false,
  nationalities: [],
  salary_currency: "USD",
  current_salary: null,
  expected_salary: null,
  remote_preference: "hybrid",
  open_to_travel: false,
  open_to_relocation: false,
  spoken_languages: [],
  date_of_birth: null,
  gpa: null,
  is_over_18: true,
  gender: null,
  disability_status: null,
  military_service: null,
  ethnicity: null,
  driving_license: null,
  security_clearance: null,
  apply_mode: "auto_save_review",
}

export interface WizardData {
  jobFilters: JobFilters
  screeningAnswers: ScreeningAnswers
}

export function SetupWizard() {
  const [currentStep, setCurrentStep] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = React.useState(true)
  const [subscriptionPlan, setSubscriptionPlan] = React.useState<SubscriptionPlan>('free')
  const { toast } = useToast()
  const supabase = createClient()

  const [wizardData, setWizardData] = React.useState<WizardData>({
    jobFilters: DEFAULT_JOB_FILTERS,
    screeningAnswers: DEFAULT_SCREENING_ANSWERS,
  })

  // Load existing data on mount
  React.useEffect(() => {
    let isMounted = true

    const loadExistingData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isMounted) {
          if (isMounted) setIsLoading(false)
          return
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("job_filters, screening_answers, cv_url, phone, location, subscription_plan")
          .eq("id", user.id)
          .single()

        if (!isMounted) return

        if (error && error.code !== "PGRST116") {
          console.error("Error loading profile:", error)
        }

        if (data) {
          const savedScreening = data.screening_answers as ScreeningAnswers | null
          // Check if user already has job filters (not first-time setup)
          if (data.job_filters && Object.keys(data.job_filters).length > 0) {
            setIsFirstTimeSetup(false)
          }
          // Set subscription plan
          if (data.subscription_plan) {
            setSubscriptionPlan(data.subscription_plan as SubscriptionPlan)
          }
          setWizardData({
            jobFilters: data.job_filters
              ? { ...DEFAULT_JOB_FILTERS, ...data.job_filters }
              : DEFAULT_JOB_FILTERS,
            screeningAnswers: savedScreening
              ? { ...DEFAULT_SCREENING_ANSWERS, ...savedScreening, cv_url: data.cv_url || savedScreening.cv_url }
              : {
                  ...DEFAULT_SCREENING_ANSWERS,
                  cv_url: data.cv_url || null,
                  phone_number: data.phone || "",
                },
          })
        }
      } catch (err) {
        console.error("Error loading data:", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadExistingData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const updateJobFilters = React.useCallback((updates: Partial<JobFilters>) => {
    setWizardData((prev) => ({
      ...prev,
      jobFilters: { ...prev.jobFilters, ...updates },
    }))
  }, [])

  const updateScreeningAnswers = React.useCallback((updates: Partial<ScreeningAnswers>) => {
    setWizardData((prev) => ({
      ...prev,
      screeningAnswers: { ...prev.screeningAnswers, ...updates },
    }))
  }, [])

  const handleNext = () => {
    // Validate mandatory filters before leaving Step 1
    if (currentStep === 1) {
      const validation = validateMandatoryFilters(wizardData.jobFilters)
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Required fields missing",
          description: validation.errors.map(e => e.message).join(". "),
        })
        return
      }
    }

    // Validate mandatory screening fields before leaving Step 3
    if (currentStep === 3) {
      const screeningValidation = validateScreeningAnswers(wizardData.screeningAnswers)
      if (!screeningValidation.isValid) {
        toast({
          variant: "destructive",
          title: "Required profile fields missing",
          description: screeningValidation.errors.map(e => e.message).join(". "),
        })
        return
      }
    }

    // Validate CV before leaving Step 4
    if (currentStep === 4) {
      const hasUploadedCV = !!wizardData.screeningAnswers.cv_url
      const isGeneratingCV = wizardData.screeningAnswers.cv_generation_mode === "generate"

      // If generating CV, check that work history has at least one valid entry
      if (isGeneratingCV) {
        const workHistory = wizardData.screeningAnswers.work_history || []
        const hasValidWorkHistory = workHistory.some(
          (entry) => entry.company && entry.position
        )
        if (!hasValidWorkHistory) {
          toast({
            variant: "destructive",
            title: "Work history required",
            description: "Please add at least one work experience entry with company and position to generate your CV.",
          })
          return
        }
      } else if (!hasUploadedCV) {
        // No CV uploaded and not generating
        toast({
          variant: "destructive",
          title: "CV required",
          description: "Please upload your CV or choose to generate one from your information.",
        })
        return
      }
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Validate mandatory filters before saving
      const filterValidation = validateMandatoryFilters(wizardData.jobFilters)
      if (!filterValidation.isValid) {
        toast({
          variant: "destructive",
          title: "Required job filter fields missing",
          description: filterValidation.errors.map(e => e.message).join(". "),
        })
        setIsSaving(false)
        return
      }

      // Validate mandatory screening fields before saving
      const screeningValidation = validateScreeningAnswers(wizardData.screeningAnswers)
      if (!screeningValidation.isValid) {
        toast({
          variant: "destructive",
          title: "Required profile fields missing",
          description: screeningValidation.errors.map(e => e.message).join(". "),
        })
        setIsSaving(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "You must be logged in to save configuration",
        })
        return
      }

      // If CV generation mode is selected, generate the CV first
      if (wizardData.screeningAnswers.cv_generation_mode === 'generate') {
        toast({
          title: "Generating CV...",
          description: "Creating your professional CV",
        })

        try {
          const generateResponse = await fetch('/api/cv/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              screeningAnswers: wizardData.screeningAnswers,
            }),
          })

          const generateResult = await generateResponse.json()

          if (!generateResponse.ok || !generateResult.success) {
            toast({
              variant: "destructive",
              title: "CV generation failed",
              description: generateResult.error || "Failed to generate CV. Please try again or upload a CV instead.",
            })
            setIsSaving(false)
            return
          }

          // Update screening answers with the generated CV URL
          wizardData.screeningAnswers.cv_url = generateResult.cv_url
        } catch (genError) {
          console.error('CV generation error:', genError)
          toast({
            variant: "destructive",
            title: "CV generation failed",
            description: "Unable to generate CV. Please try again or upload a CV instead.",
          })
          setIsSaving(false)
          return
        }
      }

      // Sync screening data to profile and job filters
      const screeningAnswers = wizardData.screeningAnswers
      const jobFilters = { ...wizardData.jobFilters }

      // Normalize city and country names for consistent matching
      const normalizedCity = normalizeCity(screeningAnswers.city || '')
      const normalizedCountry = normalizeCountry(screeningAnswers.country || '')

      // Update screening answers with normalized values
      if (normalizedCity) screeningAnswers.city = normalizedCity
      if (normalizedCountry) screeningAnswers.country = normalizedCountry

      // Build full_name from screening answers
      const fullName = [screeningAnswers.first_name, screeningAnswers.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || null

      // Build location string from normalized values
      const locationParts = [normalizedCity, normalizedCountry].filter(Boolean)
      const location = locationParts.length > 0 ? locationParts.join(", ") : null

      // Auto-populate job filter locations from user's city and country
      const userCountry = normalizedCountry
      const userCity = normalizedCity

      if (userCountry) {
        // Build location string: "City, Country" or just "Country" if no city
        const userLocation = userCity
          ? `${userCity}, ${userCountry}`
          : userCountry

        // If user selected on-site or hybrid work, add their location to onsite_locations
        const hasOnsiteWork = jobFilters.onsite_hybrid ||
          (jobFilters.work_arrangements &&
           (jobFilters.work_arrangements.includes("on_site") ||
            jobFilters.work_arrangements.includes("hybrid")))

        if (hasOnsiteWork && (!jobFilters.onsite_locations || jobFilters.onsite_locations.length === 0)) {
          // Include both city-specific and country-level for broader matching
          jobFilters.onsite_locations = userCity
            ? [userLocation, userCountry]
            : [userCountry]
        }

        // If user selected remote work, add their country to remote_countries as default
        // (Remote jobs typically filter by country, not city)
        const hasRemoteWork = jobFilters.remote_jobs ||
          (jobFilters.work_arrangements &&
           (jobFilters.work_arrangements.includes("remote_only") ||
            jobFilters.work_arrangements.includes("remote_ok")))

        if (hasRemoteWork && (!jobFilters.remote_countries || jobFilters.remote_countries.length === 0)) {
          jobFilters.remote_countries = [userCountry]
        }
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: fullName,
          location: location,
          job_filters: jobFilters,
          screening_answers: screeningAnswers,
          production_mode: true, // Auto-enable production mode after setup
          updated_at: new Date().toISOString(),
        })

      if (error) {
        throw error
      }

      // Only trigger instant job search on first-time setup
      if (isFirstTimeSetup) {
        toast({
          title: "Configuration saved",
          description: "Finding your first job matches...",
        })

        // Trigger instant job search in the background
        // Uses /api/jobs/search which respects free plan quota (3 jobs/day)
        // Note: /api/jobs/curate is for paid users only (daily curation)
        fetch("/api/jobs/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useProfileFilters: true }),
        }).catch(err => console.error("Job search error:", err))
      } else {
        toast({
          title: "Configuration saved",
          description: "Your job preferences have been updated.",
        })
      }

      // Redirect to dashboard after successful save
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 1500)
    } catch (error: unknown) {
      // Safe error message extraction
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : "An error occurred while saving"
      toast({
        variant: "destructive",
        title: "Error saving configuration",
        description: errorMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>
        <p className="text-muted-foreground">Loading your configuration...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 text-sm font-medium border border-zinc-200 dark:border-white/[0.06]">
          <Sparkles className="w-4 h-4" />
          Job Configuration
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Set Up Your <span className="text-gradient">Job Preferences</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Configure your job search criteria to help us find the perfect opportunities for you.
        </p>
      </div>

      {/* How It Works Info Box */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium text-blue-900 dark:text-blue-100">How Job Matching Works</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Your first job matches arrive <strong>instantly</strong> after saving your preferences
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                New matches are delivered <strong>every 24 hours</strong> based on your plan
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <strong>Tip:</strong> Broader filters = more matches. Narrow filters may limit your daily quota.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />
        <div
          className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-400 transition-all duration-500 hidden sm:block"
          style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
        />

        {/* Step Indicators */}
        <div className="relative flex justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = currentStep > step.id
            const isCurrent = currentStep === step.id
            const Icon = step.icon

            return (
              <button
                key={step.id}
                onClick={() => {
                  // Only allow navigating to completed steps or the next step
                  // Prevent jumping ahead to uncompleted steps
                  if (step.id > currentStep) {
                    // Going forward - must validate all steps up to target
                    // Step 1 validation (mandatory filters)
                    if (currentStep <= 1 && step.id > 1) {
                      const validation = validateMandatoryFilters(wizardData.jobFilters)
                      if (!validation.isValid) {
                        toast({
                          variant: "destructive",
                          title: "Required fields missing",
                          description: validation.errors.map(e => e.message).join(". "),
                        })
                        return
                      }
                    }
                    // Only allow advancing one step at a time via step buttons
                    // This prevents skipping steps entirely
                    if (step.id > currentStep + 1) {
                      toast({
                        variant: "destructive",
                        title: "Complete current step first",
                        description: "Please complete each step before proceeding.",
                      })
                      return
                    }
                  }
                  setCurrentStep(step.id)
                }}
                className={cn(
                  "flex flex-col items-center gap-2 group transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 rounded-lg p-2 -m-2"
                )}
              >
                <div
                  className={cn(
                    "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                    "border-2",
                    isCompleted
                      ? "bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600 border-transparent text-white shadow-lg shadow-zinc-500/25"
                      : isCurrent
                      ? "bg-white dark:bg-zinc-800 border-zinc-400 text-zinc-600 dark:text-zinc-300 shadow-lg"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 group-hover:border-zinc-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                  {isCurrent && (
                    <span className="absolute -inset-1 rounded-xl border-2 border-zinc-400/30 animate-pulse" />
                  )}
                </div>
                <div className="hidden sm:block text-center">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isCurrent || isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step Counter for Mobile */}
      <div className="sm:hidden text-center">
        <p className="text-sm font-medium">
          Step {currentStep} of 5: <span className="text-zinc-500 dark:text-zinc-300">{STEPS[currentStep - 1].title}</span>
        </p>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.06] shadow-xl shadow-zinc-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 sm:p-8">
          {currentStep === 1 && (
            <StepJobPreferences
              data={wizardData.jobFilters}
              onUpdate={updateJobFilters}
            />
          )}
          {currentStep === 2 && (
            <StepJobFilters
              data={wizardData.jobFilters}
              onUpdate={updateJobFilters}
            />
          )}
          {currentStep === 3 && (
            <StepScreening
              data={wizardData.screeningAnswers}
              onUpdate={updateScreeningAnswers}
            />
          )}
          {currentStep === 4 && (
            <StepCV
              data={wizardData.screeningAnswers}
              onUpdate={updateScreeningAnswers}
              jobFilters={wizardData.jobFilters}
            />
          )}
          {currentStep === 5 && (
            <StepFinal
              data={wizardData.screeningAnswers}
              onUpdate={updateScreeningAnswers}
              isFirstTimeSetup={isFirstTimeSetup}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 sm:px-8 py-4 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={cn(
              "gap-2 transition-opacity",
              currentStep === 1 && "opacity-0 pointer-events-none"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <span className="text-sm text-muted-foreground hidden sm:block">
            Step {currentStep} of 5
          </span>

          {currentStep < 5 ? (
            <Button
              onClick={handleNext}
              variant="metallic"
              className="gap-2"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="metallic"
              className="gap-2 min-w-[160px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Configuration
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
