"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  CheckCircle2,
} from "lucide-react"
import styles from "./dawn-generator.module.css"
import type { ScreeningAnswers, Job } from "@/lib/supabase/types"
import { mapParsedCVToScreeningAnswers, type ParsedCV } from "@/lib/cv/data-mapper"

interface WorkHistoryEntry {
  company: string
  position: string
  start_date: string
  end_date: string | null
  location: string
  highlights: string[]
}

interface EducationEntry {
  institution: string
  degree: string
  area: string
  graduation_year: string
  location: string
  highlights: string[]
}

interface CVGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job?: Job // Optional job context for tailored CV generation
  onCVGenerated?: (cvUrl: string, signedUrl?: string) => void
}

// Maximum limits to prevent memory exhaustion
const MAX_WORK_ENTRIES = 10
const MAX_EDUCATION_ENTRIES = 5

// Map country names to phone country codes
const COUNTRY_PHONE_CODES: Record<string, string> = {
  'united states': '+1',
  'usa': '+1',
  'us': '+1',
  'canada': '+1',
  'united kingdom': '+44',
  'uk': '+44',
  'australia': '+61',
  'germany': '+49',
  'france': '+33',
  'spain': '+34',
  'italy': '+39',
  'netherlands': '+31',
  'belgium': '+32',
  'switzerland': '+41',
  'austria': '+43',
  'sweden': '+46',
  'norway': '+47',
  'denmark': '+45',
  'finland': '+358',
  'ireland': '+353',
  'portugal': '+351',
  'poland': '+48',
  'india': '+91',
  'china': '+86',
  'japan': '+81',
  'south korea': '+82',
  'singapore': '+65',
  'hong kong': '+852',
  'taiwan': '+886',
  'brazil': '+55',
  'mexico': '+52',
  'argentina': '+54',
  'israel': '+972',
  'south africa': '+27',
  'new zealand': '+64',
  'uae': '+971',
  'united arab emirates': '+971',
}

function getPhoneCodeFromCountry(country: string | undefined): string {
  if (!country) return '+1'
  const normalized = country.toLowerCase().trim()
  return COUNTRY_PHONE_CODES[normalized] || '+1'
}

export function CVGeneratorDialog({
  open,
  onOpenChange,
  job,
  onCVGenerated,
}: CVGeneratorDialogProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [isLoading, setIsLoading] = React.useState(true)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null)
  const [isLoadingAISkills, setIsLoadingAISkills] = React.useState(false)
  const [aiSkillSuggestions, setAiSkillSuggestions] = React.useState<string[]>([])
  // Achievement suggestions state - track per work entry index
  const [loadingAchievements, setLoadingAchievements] = React.useState<number | null>(null)
  const [achievementSuggestions, setAchievementSuggestions] = React.useState<{ index: number; suggestions: string[] } | null>(null)

  // Form state - phone_country_code will be set based on user's country when data loads
  const [screeningAnswers, setScreeningAnswers] = React.useState<Partial<ScreeningAnswers>>({
    first_name: "",
    last_name: "",
    experience_summary: "",
    linkedin_url: "",
    city: "",
    country: "",
    phone_country_code: "",
    phone_number: "",
    work_history: [createEmptyWorkEntry()],
    education: [createEmptyEducationEntry()],
    skills: [],
  })
  const [skillInput, setSkillInput] = React.useState("")

  function createEmptyWorkEntry(): WorkHistoryEntry {
    return {
      company: "",
      position: "",
      start_date: "",
      end_date: null,
      location: "",
      highlights: [""],
    }
  }

  function createEmptyEducationEntry(): EducationEntry {
    return {
      institution: "",
      degree: "",
      area: "",
      graduation_year: "",
      location: "",
      highlights: [],
    }
  }

  // Load existing screening answers when dialog opens
  React.useEffect(() => {
    if (!open) return

    const loadData = async () => {
      setIsLoading(true)
      setGeneratedUrl(null)
      // Reset AI suggestion state on dialog reopen
      setAiSkillSuggestions([])
      setAchievementSuggestions(null)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from("profiles")
          .select("screening_answers, cv_parsed_data, full_name, location, phone")
          .eq("id", user.id)
          .single()

        let baseData: Partial<ScreeningAnswers> = {
          first_name: "",
          last_name: "",
          experience_summary: "",
          linkedin_url: "",
          city: "",
          country: "",
          phone_country_code: "", // Will be set from user's country
          phone_number: "",
          work_history: [],
          education: [],
          skills: [],
        }

        // Start with screening_answers if available
        if (profile?.screening_answers) {
          const saved = profile.screening_answers as ScreeningAnswers
          console.log('Loaded screening_answers:', {
            hasWorkHistory: saved.work_history?.length,
            hasEducation: saved.education?.length,
            hasSkills: saved.skills?.length,
          })
          baseData = { ...baseData, ...saved }
        } else {
          console.log('No screening_answers found in profile')
        }

        // If work_history or education are empty, try to fill from cv_parsed_data
        const hasWorkHistory = baseData.work_history && baseData.work_history.length > 0 &&
          baseData.work_history.some(w => w.company && w.position)
        const hasEducation = baseData.education && baseData.education.length > 0 &&
          baseData.education.some(e => e.institution && e.degree)

        // If work_history or education are empty, try to fill from cv_parsed_data
        if (profile?.cv_parsed_data && (!hasWorkHistory || !hasEducation)) {
          const parsedCV = profile.cv_parsed_data as unknown as ParsedCV
          const { screeningAnswers: mapped } = mapParsedCVToScreeningAnswers(parsedCV)

          // Check if parsed CV actually has the data we need
          const parsedHasWork = mapped.work_history && mapped.work_history.length > 0 &&
            mapped.work_history.some(w => w.company && w.position)
          const parsedHasEdu = mapped.education && mapped.education.length > 0 &&
            mapped.education.some(e => e.institution && e.degree)

          // Fill in missing work history from parsed CV
          if (!hasWorkHistory && parsedHasWork) {
            baseData.work_history = mapped.work_history
          }

          // Fill in missing education from parsed CV
          if (!hasEducation && parsedHasEdu) {
            baseData.education = mapped.education
          }

          // Fill in missing skills from parsed CV
          if ((!baseData.skills || baseData.skills.length === 0) && mapped.skills && mapped.skills.length > 0) {
            baseData.skills = mapped.skills
          }

          // Fill in missing personal info from parsed CV
          if (!baseData.first_name && mapped.first_name) baseData.first_name = mapped.first_name
          if (!baseData.last_name && mapped.last_name) baseData.last_name = mapped.last_name
          if (!baseData.city && mapped.city) baseData.city = mapped.city
          if (!baseData.country && mapped.country) baseData.country = mapped.country
          if (!baseData.experience_summary && mapped.experience_summary) {
            baseData.experience_summary = mapped.experience_summary
          }

          // Show toast if we loaded new data from parsed CV
          if (parsedHasWork || parsedHasEdu) {
            toast({
              title: "Data loaded from your CV",
              description: "We've added work experience and education from your uploaded CV.",
            })
          }
        }

        // Fallback to profile name if still empty
        if (!baseData.first_name && !baseData.last_name && profile?.full_name) {
          const nameParts = profile.full_name.split(" ")
          baseData.first_name = nameParts[0] || ""
          baseData.last_name = nameParts.slice(1).join(" ") || ""
        }

        // Set phone country code based on user's country
        // Update if: empty, or if it's the old default "+1" but country is not US/Canada
        const expectedCode = getPhoneCodeFromCountry(baseData.country)
        const isOldDefault = baseData.phone_country_code === '+1'
        const countryIsNotUS = expectedCode !== '+1'

        if (!baseData.phone_country_code || (isOldDefault && countryIsNotUS)) {
          baseData.phone_country_code = expectedCode
        }

        // Ensure at least one empty entry for work/education forms
        setScreeningAnswers({
          ...baseData,
          work_history: baseData.work_history?.length ? baseData.work_history : [createEmptyWorkEntry()],
          education: baseData.education?.length ? baseData.education : [createEmptyEducationEntry()],
          skills: baseData.skills || [],
        })
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [open, supabase, toast])

  const updateWorkHistory = (index: number, updates: Partial<WorkHistoryEntry>) => {
    setScreeningAnswers(prev => {
      const workHistory = [...(prev.work_history || [])]
      workHistory[index] = { ...workHistory[index], ...updates }
      return { ...prev, work_history: workHistory }
    })
  }

  const addWorkEntry = () => {
    const currentCount = screeningAnswers.work_history?.length || 0
    if (currentCount >= MAX_WORK_ENTRIES) {
      toast({
        variant: "destructive",
        title: "Maximum reached",
        description: `You can add up to ${MAX_WORK_ENTRIES} work entries.`,
      })
      return
    }
    setScreeningAnswers(prev => ({
      ...prev,
      work_history: [...(prev.work_history || []), createEmptyWorkEntry()],
    }))
  }

  const removeWorkEntry = (index: number) => {
    setScreeningAnswers(prev => ({
      ...prev,
      work_history: (prev.work_history || []).filter((_, i) => i !== index),
    }))
  }

  const updateEducation = (index: number, updates: Partial<EducationEntry>) => {
    setScreeningAnswers(prev => {
      const education = [...(prev.education || [])]
      education[index] = { ...education[index], ...updates }
      return { ...prev, education: education }
    })
  }

  const addEducationEntry = () => {
    const currentCount = screeningAnswers.education?.length || 0
    if (currentCount >= MAX_EDUCATION_ENTRIES) {
      toast({
        variant: "destructive",
        title: "Maximum reached",
        description: `You can add up to ${MAX_EDUCATION_ENTRIES} education entries.`,
      })
      return
    }
    setScreeningAnswers(prev => ({
      ...prev,
      education: [...(prev.education || []), createEmptyEducationEntry()],
    }))
  }

  const removeEducationEntry = (index: number) => {
    setScreeningAnswers(prev => ({
      ...prev,
      education: (prev.education || []).filter((_, i) => i !== index),
    }))
  }

  const addSkill = () => {
    const skill = skillInput.trim()
    if (skill && !(screeningAnswers.skills || []).includes(skill)) {
      setScreeningAnswers(prev => ({
        ...prev,
        skills: [...(prev.skills || []), skill],
      }))
      setSkillInput("")
    }
  }

  const removeSkill = (skill: string) => {
    setScreeningAnswers(prev => ({
      ...prev,
      skills: (prev.skills || []).filter(s => s !== skill),
    }))
  }

  const handleAISuggestSkills = async () => {
    setIsLoadingAISkills(true)
    setAiSkillSuggestions([])
    try {
      const response = await fetch('/api/ai/suggest-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workHistory: screeningAnswers.work_history,
          education: screeningAnswers.education,
          jobTitles: job ? [job.title] : [],
          existingSkills: screeningAnswers.skills,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to get suggestions')
      }

      setAiSkillSuggestions(result.skills || [])
      toast({
        title: "AI suggestions ready!",
        description: `Found ${result.skills?.length || 0} skills for your CV`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't get AI suggestions",
        description: error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setIsLoadingAISkills(false)
    }
  }

  const handleAISuggestAchievements = async (workIndex: number) => {
    const work = screeningAnswers.work_history?.[workIndex]
    if (!work?.company || !work?.position) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter company and position first",
      })
      return
    }

    setLoadingAchievements(workIndex)
    setAchievementSuggestions(null)
    try {
      const response = await fetch('/api/ai/suggest-achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: work.company,
          position: work.position,
          jobTitle: job?.title,
          jobDescription: job?.description,
          skills: screeningAnswers.skills,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to get suggestions')
      }

      setAchievementSuggestions({
        index: workIndex,
        suggestions: result.achievements || [],
      })
      toast({
        title: "AI suggestions ready!",
        description: `Found ${result.achievements?.length || 0} achievement ideas`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't get AI suggestions",
        description: error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setLoadingAchievements(null)
    }
  }

  const handleGenerate = async () => {
    // Validate
    const workHistory = screeningAnswers.work_history || []
    const education = screeningAnswers.education || []

    const hasValidWork = workHistory.some(w => w.company && w.position && w.start_date)
    const hasValidEducation = education.some(e => e.institution && e.degree && e.area && e.graduation_year)

    if (!hasValidWork) {
      toast({
        variant: "destructive",
        title: "Work experience required",
        description: "Please add at least one work experience with company, position, and start date.",
      })
      return
    }

    if (!hasValidEducation) {
      toast({
        variant: "destructive",
        title: "Education required",
        description: "Please add at least one education entry with institution, degree, area, and graduation year.",
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch("/api/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screeningAnswers,
          jobContext: job ? {
            id: job.id,
            title: job.title,
            company: job.company || "Unknown",
            description: job.description,
          } : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "CV generation failed")
      }

      setGeneratedUrl(result.signed_url)
      onCVGenerated?.(result.cv_url, result.signed_url)

      toast({
        title: "CV generated",
        description: job
          ? `Your CV tailored for ${job.company || "this role"} is ready.`
          : "Your professional CV is ready to download.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate CV",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${styles.dialog} max-h-[90dvh] max-w-2xl overflow-y-auto rounded-[1.35rem]`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--coral-lo)]" aria-hidden="true" />
            {job ? `Generate CV for ${job.company || "Job"}` : "Generate Professional CV"}
          </DialogTitle>
          <DialogDescription>
            {job
              ? "Create a CV tailored for this specific position"
              : "Fill in your information to generate a professional PDF CV"
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : generatedUrl ? (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--coral-soft)]">
                <CheckCircle2 className="h-8 w-8 text-[var(--coral-lo)]" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">CV generated successfully</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your professional CV is ready to download
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => window.open(generatedUrl, "_blank")}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open CV
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedUrl(null)
                }}
              >
                Generate Another
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Info banner */}
            <div className="rounded-xl border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-4">
              <p className="text-sm leading-6 text-[var(--dawn-ink-2)]">
                <strong>First time?</strong> Fill out your work experience and education below. Your information will be saved and pre-filled for future CV generations.
              </p>
            </div>

            {/* Personal Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={screeningAnswers.first_name || ""}
                    onChange={(e) => setScreeningAnswers(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Maya"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={screeningAnswers.last_name || ""}
                    onChange={(e) => setScreeningAnswers(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Nowak"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={screeningAnswers.city || ""}
                    onChange={(e) => setScreeningAnswers(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="New York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={screeningAnswers.country || ""}
                    onChange={(e) => {
                      const newCountry = e.target.value
                      setScreeningAnswers(prev => ({
                        ...prev,
                        country: newCountry,
                        // Auto-update phone code when country changes (only if user hasn't manually edited it)
                        phone_country_code: prev.phone_country_code === getPhoneCodeFromCountry(prev.country)
                          ? getPhoneCodeFromCountry(newCountry)
                          : prev.phone_country_code,
                      }))
                    }}
                    placeholder="United States"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone_country_code"
                      value={screeningAnswers.phone_country_code || getPhoneCodeFromCountry(screeningAnswers.country)}
                      onChange={(e) => setScreeningAnswers(prev => ({ ...prev, phone_country_code: e.target.value }))}
                      placeholder="+1"
                      className="w-20"
                    />
                    <Input
                      id="phone_number"
                      value={screeningAnswers.phone_number || ""}
                      onChange={(e) => setScreeningAnswers(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="555-123-4567"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input
                    id="linkedin_url"
                    value={screeningAnswers.linkedin_url || ""}
                    onChange={(e) => setScreeningAnswers(prev => ({ ...prev, linkedin_url: e.target.value }))}
                    placeholder="https://linkedin.com/in/maya-nowak"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience_summary">Professional Summary</Label>
                <Textarea
                  id="experience_summary"
                  value={screeningAnswers.experience_summary || ""}
                  onChange={(e) => setScreeningAnswers(prev => ({ ...prev, experience_summary: e.target.value }))}
                  placeholder="Brief overview of your professional background and career objectives..."
                  rows={3}
                />
              </div>
            </div>

            {/* Work History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Work Experience *</h3>
                <Button type="button" variant="outline" size="sm" onClick={addWorkEntry}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              {(screeningAnswers.work_history || []).map((work, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                  {(screeningAnswers.work_history || []).length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => removeWorkEntry(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Company *</Label>
                      <Input
                        value={work.company}
                        onChange={(e) => updateWorkHistory(index, { company: e.target.value })}
                        placeholder="Company Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Position *</Label>
                      <Input
                        value={work.position}
                        onChange={(e) => updateWorkHistory(index, { position: e.target.value })}
                        placeholder="Job Title"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date *</Label>
                      <Input
                        type="month"
                        value={work.start_date}
                        onChange={(e) => updateWorkHistory(index, { start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input
                        type="month"
                        value={work.end_date || ""}
                        onChange={(e) => updateWorkHistory(index, { end_date: e.target.value || null })}
                        placeholder="Present"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Location</Label>
                      <Input
                        value={work.location || ""}
                        onChange={(e) => updateWorkHistory(index, { location: e.target.value })}
                        placeholder="City, Country or Remote"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Key Achievements</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAISuggestAchievements(index)}
                        disabled={loadingAchievements === index || !work.company || !work.position}
                        className="h-6 gap-1 px-2 text-xs text-[var(--coral-lo)] hover:bg-[var(--coral-soft)] hover:text-[var(--coral-hi)]"
                      >
                        {loadingAchievements === index ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Thinking...
                          </>
                        ) : (
                          "Suggest achievements"
                        )}
                      </Button>
                    </div>
                    {/* Multiple achievements list */}
                    <div className="space-y-2">
                      {work.highlights.map((highlight, hIdx) => (
                        <div key={hIdx} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">•</span>
                          <Input
                            value={highlight}
                            onChange={(e) => {
                              const newHighlights = [...work.highlights]
                              newHighlights[hIdx] = e.target.value
                              updateWorkHistory(index, { highlights: newHighlights })
                            }}
                            placeholder="e.g., Increased sales by 25%"
                            className="flex-1"
                          />
                          {work.highlights.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                              onClick={() => {
                                const newHighlights = work.highlights.filter((_, i) => i !== hIdx)
                                updateWorkHistory(index, { highlights: newHighlights })
                              }}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          updateWorkHistory(index, { highlights: [...work.highlights, ""] })
                        }}
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="w-3 h-3" />
                        Add Achievement
                      </Button>
                    </div>
                    {/* AI Achievement Suggestions */}
                    {achievementSuggestions?.index === index && achievementSuggestions.suggestions.length > 0 && (
                      <div className="mt-2 space-y-2 rounded-xl border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-3">
                        <p className="text-xs font-medium text-[var(--coral-lo)]">
                          AI-suggested achievements (click to add):
                        </p>
                        <div className="space-y-1.5">
                          {achievementSuggestions.suggestions.map((achievement, achIdx) => (
                            <button
                              key={achIdx}
                              type="button"
                              onClick={() => {
                                // Add to existing highlights instead of replacing
                                const currentHighlights = work.highlights.filter(h => h.trim() !== "")
                                updateWorkHistory(index, { highlights: [...currentHighlights, achievement] })
                                // Remove the used suggestion
                                setAchievementSuggestions(prev => prev ? {
                                  ...prev,
                                  suggestions: prev.suggestions.filter((_, i) => i !== achIdx)
                                } : null)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg border border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] px-2.5 py-1.5 text-left text-xs text-[var(--dawn-ink-2)] transition-colors hover:border-[var(--coral)]/40 hover:bg-[var(--coral-soft)]"
                            >
                              <Plus className="w-3 h-3 flex-shrink-0" />
                              <span>{achievement}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Education */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Education *</h3>
                <Button type="button" variant="outline" size="sm" onClick={addEducationEntry}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              {(screeningAnswers.education || []).map((edu, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                  {(screeningAnswers.education || []).length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => removeEducationEntry(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Institution *</Label>
                      <Input
                        value={edu.institution}
                        onChange={(e) => updateEducation(index, { institution: e.target.value })}
                        placeholder="University Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Degree *</Label>
                      <Input
                        value={edu.degree}
                        onChange={(e) => updateEducation(index, { degree: e.target.value })}
                        placeholder="Bachelor's, Master's, etc."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Field of Study *</Label>
                      <Input
                        value={edu.area}
                        onChange={(e) => updateEducation(index, { area: e.target.value })}
                        placeholder="Computer Science"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Graduation Year *</Label>
                      <Input
                        value={edu.graduation_year}
                        onChange={(e) => updateEducation(index, { graduation_year: e.target.value })}
                        placeholder="2020"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Location</Label>
                      <Input
                        value={edu.location || ""}
                        onChange={(e) => updateEducation(index, { location: e.target.value })}
                        placeholder="City, Country"
                      />
                    </div>
                  </div>
                  {/* Education Highlights/Achievements */}
                  <div className="space-y-2">
                    <Label className="text-xs">Achievements (optional)</Label>
                    <div className="space-y-2">
                      {(edu.highlights || []).map((highlight, hIdx) => (
                        <div key={hIdx} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">•</span>
                          <Input
                            value={highlight}
                            onChange={(e) => {
                              const newHighlights = [...(edu.highlights || [])]
                              newHighlights[hIdx] = e.target.value
                              updateEducation(index, { highlights: newHighlights })
                            }}
                            placeholder="e.g., Dean's List, GPA 3.8"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => {
                              const newHighlights = (edu.highlights || []).filter((_, i) => i !== hIdx)
                              updateEducation(index, { highlights: newHighlights })
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          updateEducation(index, { highlights: [...(edu.highlights || []), ""] })
                        }}
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="w-3 h-3" />
                        Add Achievement
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Skills</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAISuggestSkills}
                  disabled={isLoadingAISkills}
                  className="gap-1.5 h-7 text-xs"
                >
                  {isLoadingAISkills ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    "Suggest skills"
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                  placeholder="Add a skill and press Enter"
                />
                <Button type="button" variant="outline" onClick={addSkill}>
                  Add
                </Button>
              </div>
              {/* AI Suggestions */}
              {aiSkillSuggestions.length > 0 && (
                <div className="space-y-2 rounded-xl border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-3">
                  <p className="text-xs font-medium text-[var(--coral-lo)]">
                    AI-suggested skills (click to add):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiSkillSuggestions.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          // Check for duplicates before adding
                          const currentSkills = screeningAnswers.skills || []
                          if (currentSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
                            return // Skip duplicate
                          }
                          setScreeningAnswers(prev => ({
                            ...prev,
                            skills: [...(prev.skills || []), skill],
                          }))
                          setAiSkillSuggestions(prev => prev.filter(s => s !== skill))
                        }}
                        className="rounded-lg border border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] px-2.5 py-1 text-xs text-[var(--dawn-ink-2)] transition-colors hover:border-[var(--coral)]/40 hover:bg-[var(--coral-soft)]"
                      >
                        + {skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(screeningAnswers.skills || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(screeningAnswers.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="pt-4">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full gap-2 bg-[var(--coral)] text-[var(--coral-ink)] transition-colors hover:bg-[var(--coral-hi)] active:bg-[var(--coral-lo)]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating CV...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generate CV
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
