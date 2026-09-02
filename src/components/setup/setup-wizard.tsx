"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
  Briefcase,
  Filter,
  FileText,
  Settings,
  Globe,
  CircleAlert,
} from "lucide-react"

const STEPS = [
  { id: 1, title: "Job Preferences", icon: Briefcase, description: "Location & job types" },
  { id: 2, title: "Job Filters", icon: Filter, description: "Match criteria" },
  { id: 3, title: "Screening", icon: FileText, description: "Your profile" },
  { id: 4, title: "Your CV", icon: FileText, description: "CV upload or generate" },
  { id: 5, title: "Finalize", icon: Settings, description: "Review & save" },
]

export const DEFAULT_JOB_FILTERS: JobFilters = {
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
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = React.useState(0)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = React.useState(true)
  const [subscriptionPlan, setSubscriptionPlan] = React.useState<SubscriptionPlan>('free')
  const [hasFullFeatureAccess, setHasFullFeatureAccess] = React.useState(false)
  const [loggedInEmail, setLoggedInEmail] = React.useState<string | null>(null)
  const stepContentRef = React.useRef<HTMLElement>(null)
  const hasRenderedStepRef = React.useRef(false)
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
        if (isMounted) setLoadError(null)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isMounted) {
          if (isMounted) setIsLoading(false)
          return
        }

        // Store logged-in email for display (helps prevent saving to wrong account)
        if (isMounted) setLoggedInEmail(user.email || null)

        const { data, error } = await supabase
          .from("profiles")
          .select("job_filters, screening_answers, cv_url, phone, location, subscription_plan, is_tester, is_admin")
          .eq("id", user.id)
          .single()

        if (!isMounted) return

        if (error && error.code !== "PGRST116") {
          console.error("Error loading profile:", error)
          setLoadError("We couldn't load your saved setup. Retry before making changes so none of your information is overwritten.")
          return
        }

        if (data) {
          const savedScreening = data.screening_answers as ScreeningAnswers | null
          // Check if user already has job filters (not first-time setup)
          const isReturningUser = data.job_filters && Object.keys(data.job_filters).length > 0
          if (isReturningUser) {
            setIsFirstTimeSetup(false)
          }
          // Set subscription plan
          if (data.subscription_plan) {
            setSubscriptionPlan(data.subscription_plan as SubscriptionPlan)
          }
          setHasFullFeatureAccess(data.is_tester === true || data.is_admin === true)

          // Build screening answers, but clear cv_generation_mode for returning users
          // who already have a CV - they should see their existing CV, not be in generate mode
          const cvUrl = data.cv_url || savedScreening?.cv_url || null
          const screeningAnswers = savedScreening
            ? { ...DEFAULT_SCREENING_ANSWERS, ...savedScreening, cv_url: cvUrl }
            : {
                ...DEFAULT_SCREENING_ANSWERS,
                cv_url: cvUrl,
                phone_number: data.phone || "",
              }

          // Clear cv_generation_mode for returning users with existing CV
          // so they see the "existing CV" view instead of generate form
          if (isReturningUser && cvUrl) {
            screeningAnswers.cv_generation_mode = undefined
          }

          setWizardData({
            jobFilters: data.job_filters
              ? { ...DEFAULT_JOB_FILTERS, ...data.job_filters }
              : DEFAULT_JOB_FILTERS,
            screeningAnswers,
          })
        }
      } catch (err) {
        console.error("Error loading data:", err)
        if (isMounted) {
          setLoadError("We couldn't load your saved setup. Check your connection and try again.")
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadExistingData()

    return () => {
      isMounted = false
    }
  }, [loadAttempt, supabase])

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

  const resetJobFilters = React.useCallback(() => {
    setWizardData((prev) => ({
      ...prev,
      jobFilters: DEFAULT_JOB_FILTERS,
    }))
    toast({
      title: "Filters reset",
      description: "All job filters have been reset to defaults",
    })
  }, [toast])

  const focusCurrentStepField = React.useCallback((selector: string) => {
    window.requestAnimationFrame(() => {
      stepContentRef.current?.querySelector<HTMLElement>(selector)?.focus()
    })
  }, [])

  React.useEffect(() => {
    if (!hasRenderedStepRef.current) {
      hasRenderedStepRef.current = true
      return
    }

    const frame = window.requestAnimationFrame(() => stepContentRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [currentStep])

  const validateCvSelection = React.useCallback(() => {
    const hasUploadedCV = !!wizardData.screeningAnswers.cv_url
    const isGeneratingCV = wizardData.screeningAnswers.cv_generation_mode === "generate"

    if (isGeneratingCV) {
      const workHistory = wizardData.screeningAnswers.work_history || []
      const education = wizardData.screeningAnswers.education || []
      const hasValidWorkHistory = workHistory.some(
        (entry) => entry.company && entry.position && entry.start_date
      )
      const hasValidEducation = education.some(
        (entry) => entry.institution && entry.degree && entry.area && entry.graduation_year
      )

      if (!hasValidWorkHistory || !hasValidEducation) {
        const missing = []
        if (!hasValidWorkHistory) missing.push("work experience (company, position, start date)")
        if (!hasValidEducation) missing.push("education (institution, degree, area, graduation year)")

        toast({
          variant: "destructive",
          title: "Required fields missing",
          description: `Please complete at least one ${missing.join(" and one ")} to generate your CV.`,
        })
        focusCurrentStepField("input")
        return false
      }

      return true
    }

    if (!hasUploadedCV) {
      toast({
        variant: "destructive",
        title: "CV required",
        description: "Please upload your CV or choose to generate one from your information.",
      })
      focusCurrentStepField("#cv-upload-trigger, #cv-mode-upload")
      return false
    }

    return true
  }, [focusCurrentStepField, toast, wizardData.screeningAnswers])

  const validateCurrentStep = React.useCallback(() => {
    if (currentStep === 1) {
      const validation = validateMandatoryFilters(wizardData.jobFilters)
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Required fields missing",
          description: validation.errors.map(e => e.message).join(". "),
        })
        const firstErrorField = validation.errors[0]?.field
        const selectorByField: Record<string, string> = {
          industries: "#industry-trigger",
          job_titles: "#job-title-input",
          work_location: '[data-setup-field="work-arrangements"] button',
          job_types: '[data-setup-field="job-types"] button',
          location: "#job-location-input",
        }
        focusCurrentStepField(selectorByField[firstErrorField] || "button, input")
        return false
      }
    }

    if (currentStep === 3) {
      const screeningValidation = validateScreeningAnswers(wizardData.screeningAnswers)
      if (!screeningValidation.isValid) {
        toast({
          variant: "destructive",
          title: "Required profile fields missing",
          description: screeningValidation.errors.map(e => e.message).join(". "),
        })
        const firstErrorField = screeningValidation.errors[0]?.field
        const selectorByField: Record<string, string> = {
          first_name: "#first_name",
          last_name: "#last_name",
          country: "#screening-country",
          city: "#screening-city",
          work_authorization_countries: "#work-authorization-countries",
        }
        focusCurrentStepField(selectorByField[firstErrorField] || "input, button")
        return false
      }
    }

    const cvIsValid = currentStep !== 4 || validateCvSelection()
    if (!cvIsValid) {
      focusCurrentStepField("#cv-upload-trigger, #cv-mode-upload, input")
    }
    return cvIsValid
  }, [currentStep, focusCurrentStepField, toast, validateCvSelection, wizardData])

  const handleNext = () => {
    if (!validateCurrentStep()) return

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepSelect = (stepId: number) => {
    if (stepId < currentStep) {
      setCurrentStep(stepId)
      return
    }

    if (stepId > currentStep + 1) {
      toast({
        variant: "destructive",
        title: "Complete current step first",
        description: "Please complete each step before proceeding.",
      })
      return
    }

    if (stepId > currentStep && !validateCurrentStep()) return

    setCurrentStep(stepId)
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const screeningAnswers = { ...wizardData.screeningAnswers }

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

      // Fail closed if a user reaches the final step without a usable CV.
      if (!validateCvSelection()) {
        setIsSaving(false)
        setCurrentStep(4)
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
          screeningAnswers,
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
          screeningAnswers.cv_url = generateResult.cv_url
          screeningAnswers.cv_generation_mode = undefined
          updateScreeningAnswers({
            cv_url: generateResult.cv_url,
            cv_generation_mode: undefined,
          })
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

      // Security: Validate that cv_url belongs to this user (prevents cross-account contamination)
      if (screeningAnswers.cv_url && !screeningAnswers.cv_url.startsWith(user.id + '/')) {
        console.error('[Setup] CV URL does not belong to current user, clearing it', {
          cvUrl: screeningAnswers.cv_url,
          userId: user.id,
        })
        // Clear the invalid cv_url to prevent saving another user's CV reference
        screeningAnswers.cv_url = null
        toast({
          variant: "destructive",
          title: "CV reference cleared",
          description: "Please re-upload your CV. The previous reference was invalid.",
        })
        updateScreeningAnswers({ cv_url: null, cv_generation_mode: undefined })
        setCurrentStep(4)
        return
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
        try {
          const searchResponse = await fetch("/api/jobs/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ useProfileFilters: true }),
          })

          if (!searchResponse.ok) {
            throw new Error(`Initial search returned ${searchResponse.status}`)
          }
        } catch (searchError) {
          console.error("Job search error:", searchError)
          toast({
            variant: "destructive",
            title: "Setup saved. Search will retry.",
            description: "Your profile is ready, but we couldn't start the first search. You can retry from the dashboard.",
          })
        }
      } else {
        toast({
          title: "Configuration saved",
          description: "Your job preferences have been updated.",
        })
      }

      // Redirect to dashboard after successful save
      setTimeout(() => {
        router.push("/dashboard")
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
      <div className="mx-auto min-h-[25rem] max-w-2xl space-y-5 py-14" role="status" aria-label="Loading your setup">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--coral-soft)]" />
        <div className="h-12 w-3/4 animate-pulse rounded-xl bg-[var(--dawn-cream)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[var(--dawn-cream)]" />
        <div className="h-52 w-full animate-pulse rounded-2xl border border-[var(--dawn-line)] bg-[var(--dawn-surface)]" />
        <div className="sr-only">
          Loading your configuration...
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[25rem] max-w-2xl items-center py-14">
        <div className="w-full rounded-[20px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-8 text-center shadow-[0_18px_50px_-32px_rgba(31,27,24,0.24)]">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--coral-soft)] text-[var(--coral-lo)]">
            <CircleAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-[var(--dawn-ink)]">
            Your setup is temporarily unavailable
          </h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-sm leading-6 text-[var(--dawn-ink-2)]">
            {loadError}
          </p>
          <Button
            type="button"
            className="mt-6 rounded-full bg-[var(--coral)] px-6 text-[var(--coral-ink)] hover:bg-[var(--coral-hi)]"
            onClick={() => {
              setIsLoading(true)
              setLoadAttempt((attempt) => attempt + 1)
            }}
          >
            Retry loading
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <header className="max-w-2xl space-y-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
          Your search setup
        </p>
        <h1 className="text-balance text-[clamp(2.2rem,6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--dawn-ink)]">
          Tell us what is worth waking up for.
        </h1>
        <p className="max-w-[58ch] text-pretty leading-7 text-[var(--dawn-ink-2)]">
          Set your criteria once. JobSilver will build fresh matches around the roles, locations, and work preferences you choose.
        </p>
        {/* Show logged-in account to prevent accidental saves to wrong account */}
        {loggedInEmail && (
          <p className="text-xs text-[var(--dawn-ink-3)]">
            Saving to <span className="font-medium text-[var(--dawn-ink)]">{loggedInEmail}</span>
          </p>
        )}
      </header>

      {/* How It Works Info Box */}
      <aside className="rounded-2xl border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-4 sm:p-5" aria-label="How job matching works">
        <div className="flex gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--coral-soft)] text-[var(--coral-lo)]">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--dawn-ink)]">What happens after setup</h2>
            <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--dawn-ink-2)] sm:grid-cols-3 sm:gap-4">
              <li className="border-l border-[var(--dawn-line-2)] pl-3">
                Your first job matches arrive <strong>instantly</strong> after saving your preferences
              </li>
              <li className="border-l border-[var(--dawn-line-2)] pl-3">
                New matches are delivered <strong>every 24 hours</strong> based on your plan
              </li>
              <li className="border-l border-[var(--dawn-line-2)] pl-3">
                <strong>Tip:</strong> Broader filters = more matches. Narrow filters may limit your daily quota.
              </li>
            </ul>
          </div>
        </div>
      </aside>

      {/* Progress rail - z-index lower than dropdowns in content area */}
      <nav className="relative z-10" aria-label="Setup progress">
        {/* Progress Line */}
        <div className="absolute left-4 right-4 top-4 h-px bg-[var(--dawn-line-2)] sm:left-5 sm:right-5 sm:top-5" />
        <div
          className="absolute left-4 right-4 top-4 h-px origin-left bg-[var(--coral)] transition-transform duration-300 sm:left-5 sm:right-5 sm:top-5"
          style={{ transform: `scaleX(${(currentStep - 1) / (STEPS.length - 1)})` }}
        />

        {/* Step Indicators */}
        <ol className="relative flex justify-between">
          {STEPS.map((step) => {
            const isCompleted = currentStep > step.id
            const isCurrent = currentStep === step.id
            const Icon = step.icon

            return (
              <li key={step.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${isCompleted ? "Completed " : ""}Step ${step.id}: ${step.title}. ${step.description}`}
                  onClick={() => handleStepSelect(step.id)}
                  className="group flex w-full flex-col items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2"
                >
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--dawn-bg)] text-xs font-semibold tabular-nums transition-colors sm:h-10 sm:w-10",
                      isCompleted && "border-[var(--coral)] bg-[var(--coral)] text-white",
                      isCurrent && "border-[var(--coral)] text-[var(--coral-lo)] ring-4 ring-[var(--coral-soft)]",
                      !isCompleted && !isCurrent && "border-[var(--dawn-line-2)] text-[var(--dawn-ink-3)] group-hover:border-[var(--coral)]/50"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="sm:hidden" aria-hidden="true">{step.id}</span>}
                    {!isCompleted && <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />}
                  </span>
                  <div className="hidden max-w-[9rem] text-center sm:block">
                  <p
                    className={cn(
                      "text-sm font-medium leading-5 transition-colors",
                      isCurrent || isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--dawn-ink-3)]">{step.description}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step Counter for Mobile */}
      <div className="text-center sm:hidden">
        <p className="text-sm font-medium text-[var(--dawn-ink)]">
          Step {currentStep} of {STEPS.length} · {STEPS[currentStep - 1].title}
        </p>
        <p className="mt-0.5 text-xs text-[var(--dawn-ink-3)]">{STEPS[currentStep - 1].description}</p>
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
      </div>

      {/* Step Content */}
      <section
        ref={stepContentRef}
        tabIndex={-1}
        aria-label={`Step ${currentStep}: ${STEPS[currentStep - 1].title}`}
        className="overflow-hidden rounded-[1.35rem] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] shadow-[0_28px_70px_-56px_rgba(31,27,24,0.55)] focus:outline-none"
      >
        <div className="p-5 sm:p-8">
          {currentStep === 1 && (
            <StepJobPreferences
              data={wizardData.jobFilters}
              onUpdate={updateJobFilters}
              onReset={resetJobFilters}
            />
          )}
          {currentStep === 2 && (
            <StepJobFilters
              data={wizardData.jobFilters}
              onUpdate={updateJobFilters}
              onReset={resetJobFilters}
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
              isFirstTimeSetup={isFirstTimeSetup}
              subscriptionPlan={subscriptionPlan}
              hasFullFeatureAccess={hasFullFeatureAccess}
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
        <div className="flex items-center justify-between border-t border-[var(--dawn-line)] bg-[var(--dawn-cream)] px-4 py-4 sm:px-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={cn(
              "gap-2 text-[var(--dawn-ink-2)] transition-opacity hover:bg-[var(--dawn-surface)] hover:text-[var(--dawn-ink)]",
              currentStep === 1 && "opacity-0 pointer-events-none"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <span className="text-sm text-muted-foreground hidden sm:block">
            Step {currentStep} of {STEPS.length}
          </span>

          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              className="gap-2 bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)] active:bg-[var(--coral-active)]"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[10rem] gap-2 bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)] active:bg-[var(--coral-active)]"
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
      </section>
    </div>
  )
}
