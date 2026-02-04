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
  Sparkles,
  FileText,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
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
  const [isReparsing, setIsReparsing] = React.useState(false)
  const [showReparseOption, setShowReparseOption] = React.useState(false)
  // Achievement suggestions state - track per work entry index
  const [loadingAchievements, setLoadingAchievements] = React.useState<number | null>(null)
  const [achievementSuggestions, setAchievementSuggestions] = React.useState<{ index: number; suggestions: string[] } | null>(null)

  // Form state
  const [screeningAnswers, setScreeningAnswers] = React.useState<Partial<ScreeningAnswers>>({
    first_name: "",
    last_name: "",
    experience_summary: "",
    linkedin_url: "",
    city: "",
    country: "",
    phone_country_code: "+1",
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
      setShowReparseOption(false) // Reset on each load
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
          phone_country_code: "+1",
          phone_number: "",
          work_history: [],
          education: [],
          skills: [],
        }

        // Start with screening_answers if available
        if (profile?.screening_answers) {
          const saved = profile.screening_answers as ScreeningAnswers
          baseData = { ...baseData, ...saved }
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

        // Re-check final state after all loading attempts
        const finalHasWork = baseData.work_history && baseData.work_history.length > 0 &&
          baseData.work_history.some(w => w.company && w.position)
        const finalHasEdu = baseData.education && baseData.education.length > 0 &&
          baseData.education.some(e => e.institution && e.degree)

        // Only show reparse option if data is STILL missing and there's a CV file
        if (!finalHasWork || !finalHasEdu) {
          const { data: cvCheck } = await supabase
            .from("profiles")
            .select("cv_url")
            .eq("id", user.id)
            .single()

          if (cvCheck?.cv_url) {
            setShowReparseOption(true)
          }
        }

        // Fallback to profile name if still empty
        if (!baseData.first_name && !baseData.last_name && profile?.full_name) {
          const nameParts = profile.full_name.split(" ")
          baseData.first_name = nameParts[0] || ""
          baseData.last_name = nameParts.slice(1).join(" ") || ""
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

  const handleReparse = async () => {
    setIsReparsing(true)
    try {
      const response = await fetch('/api/cv/reparse', {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Re-parse failed')
      }

      // Successfully re-parsed - reload the form with new data
      const parsedData = result.parsed_data as ParsedCV
      const { screeningAnswers: mapped } = mapParsedCVToScreeningAnswers(parsedData)

      // Update form with the newly parsed data
      setScreeningAnswers(prev => {
        const updated = { ...prev }

        // Update work history if we got new data
        if (mapped.work_history && mapped.work_history.length > 0 &&
            mapped.work_history.some(w => w.company && w.position)) {
          updated.work_history = mapped.work_history
        }

        // Update education if we got new data
        if (mapped.education && mapped.education.length > 0 &&
            mapped.education.some(e => e.institution && e.degree)) {
          updated.education = mapped.education
        }

        // Update skills if we got new data
        if (mapped.skills && mapped.skills.length > 0) {
          updated.skills = mapped.skills
        }

        // Fill other fields if empty
        if (!updated.first_name && mapped.first_name) updated.first_name = mapped.first_name
        if (!updated.last_name && mapped.last_name) updated.last_name = mapped.last_name
        if (!updated.city && mapped.city) updated.city = mapped.city
        if (!updated.country && mapped.country) updated.country = mapped.country
        if (!updated.experience_summary && mapped.experience_summary) {
          updated.experience_summary = mapped.experience_summary
        }

        return updated
      })

      setShowReparseOption(false)

      toast({
        title: "CV re-parsed successfully",
        description: result.message || `Found ${result.extracted?.experience || 0} work experiences and ${result.extracted?.education || 0} education entries.`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Re-parse failed",
        description: error instanceof Error ? error.message : "Failed to re-parse CV. Please try again.",
      })
    } finally {
      setIsReparsing(false)
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
        title: "CV generated!",
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            {job ? `Generate CV for ${job.company || "Job"}` : "Generate Professional CV"}
          </DialogTitle>
          <DialogDescription>
            {job
              ? "Create a CV tailored for this specific position"
              : "Fill in your information to generate a professional PDF CV"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Re-parse CV Banner */}
        {showReparseOption && !isLoading && !generatedUrl && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Your uploaded CV didn&apos;t include work history or education details.
                Try re-parsing it, or fill in the information manually below.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReparse}
                disabled={isReparsing}
                className="gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              >
                {isReparsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Re-parsing CV...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-parse My CV
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : generatedUrl ? (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">CV Generated Successfully!</h3>
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
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={screeningAnswers.last_name || ""}
                    onChange={(e) => setScreeningAnswers(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
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
                    onChange={(e) => setScreeningAnswers(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="United States"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input
                    id="linkedin_url"
                    value={screeningAnswers.linkedin_url || ""}
                    onChange={(e) => setScreeningAnswers(prev => ({ ...prev, linkedin_url: e.target.value }))}
                    placeholder="https://linkedin.com/in/johndoe"
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
                        className="h-6 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                      >
                        {loadingAchievements === index ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Thinking...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            AI Suggest
                          </>
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
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500"
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
                        className="h-7 px-2 text-xs gap-1 text-zinc-500 hover:text-zinc-700"
                      >
                        <Plus className="w-3 h-3" />
                        Add Achievement
                      </Button>
                    </div>
                    {/* AI Achievement Suggestions */}
                    {achievementSuggestions?.index === index && achievementSuggestions.suggestions.length > 0 && (
                      <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 space-y-2">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
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
                              className="w-full text-left px-2.5 py-1.5 rounded text-xs border border-blue-300 dark:border-blue-700 bg-white dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors flex items-center gap-2"
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
                    <>
                      <Sparkles className="w-3 h-3" />
                      AI Suggest
                    </>
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
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 space-y-2">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    AI-suggested skills (click to add):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiSkillSuggestions.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          setScreeningAnswers(prev => ({
                            ...prev,
                            skills: [...(prev.skills || []), skill],
                          }))
                          setAiSkillSuggestions(prev => prev.filter(s => s !== skill))
                        }}
                        className="px-2.5 py-1 rounded-full text-xs border border-blue-300 dark:border-blue-700 bg-white dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
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
                      className="inline-flex items-center gap-1 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="text-zinc-400 hover:text-zinc-600"
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
                className="w-full gap-2"
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
