"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  FileText,
  Upload,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Trash2,
  ExternalLink,
  Lock,
} from "lucide-react"
import type { ScreeningAnswers, JobFilters, SubscriptionPlan } from "@/lib/supabase/types"
import { canAccessFeature } from "@/lib/features/config"
import { WorkHistorySection, EducationSection, SkillsSection } from "./cv-sections"

interface StepCVProps {
  data: ScreeningAnswers
  onUpdate: (updates: Partial<ScreeningAnswers>) => void
  jobFilters?: JobFilters
  isFirstTimeSetup?: boolean
  subscriptionPlan?: SubscriptionPlan
  hasFullFeatureAccess?: boolean
}

export function StepCV({ data, onUpdate, jobFilters, isFirstTimeSetup = true, subscriptionPlan = 'free', hasFullFeatureAccess = false }: StepCVProps) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [cvViewUrl, setCvViewUrl] = React.useState<string | null>(null)
  const [isLoadingCv, setIsLoadingCv] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const mode = data.cv_generation_mode
  const hasExistingCV = !!data.cv_url

  // Free users can only generate CV once during first-time setup. Returning
  // users need plan access, while testers and admins receive full access.
  const canGenerateNewCV = isFirstTimeSetup || canAccessFeature(subscriptionPlan, 'cv_generator', hasFullFeatureAccess)

  // Show upgrade modal for CV generation
  const showUpgradeModalForCV = () => {
    window.dispatchEvent(
      new CustomEvent('show-upgrade-modal', {
        detail: {
          feature: 'cv_generation',
          requiredPlan: 'pro',
          featureName: 'CV Generation',
          featureDescription: "You've already generated your free CV. Upgrade to Pro to generate additional professional CVs tailored for different jobs.",
        },
      })
    )
  }

  // Fetch CV signed URL for viewing
  const fetchCvUrl = React.useCallback(async () => {
    if (!data.cv_url) return

    setIsLoadingCv(true)
    try {
      const response = await fetch("/api/cv/view")
      if (response.ok) {
        const urlData = await response.json()
        setCvViewUrl(urlData.url)
      }
    } catch (error) {
      console.error("Failed to fetch CV URL:", error)
    } finally {
      setIsLoadingCv(false)
    }
  }, [data.cv_url])

  // Fetch CV URL when component loads with a CV
  React.useEffect(() => {
    if (data.cv_url && !cvViewUrl) {
      const timeoutId = window.setTimeout(() => {
        void fetchCvUrl()
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [data.cv_url, cvViewUrl, fetchCvUrl])

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]
    const validExtensions = [".pdf", ".docx", ".txt"]
    const fileExt = "." + (file.name.split(".").pop()?.toLowerCase() || "")

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, or TXT file",
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum file size is 10MB",
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/cv/upload", {
        method: "POST",
        body: formData,
      })

      let responseData: { error?: string; cv_url?: string }
      try {
        responseData = await response.json() as { error?: string; cv_url?: string }
      } catch {
        throw new Error(
          response.ok
            ? "The upload completed, but the server response was invalid. Please retry."
            : `Upload failed (${response.status}). Please try again.`
        )
      }

      if (!response.ok) {
        throw new Error(responseData.error || `Upload failed (${response.status})`)
      }

      if (!responseData.cv_url) {
        throw new Error("The upload completed without a CV reference. Please retry.")
      }

      onUpdate({
        cv_url: responseData.cv_url,
        cv_generation_mode: "upload",
      })

      // Refresh the preview URL for the new file
      setCvViewUrl(null)
      setTimeout(() => fetchCvUrl(), 500)

      toast({
        title: "CV uploaded successfully",
        description: "Your CV has been saved",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload CV",
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Handle file deletion
  const handleDeleteCV = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/cv/upload", {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Delete failed")
      }

      onUpdate({
        cv_url: null,
        cv_generation_mode: undefined,
      })

      toast({
        title: "CV removed",
        description: "Your CV has been deleted",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to remove CV",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  // Check if generate mode has valid data
  const hasValidGenerateData = () => {
    const workHistory = data.work_history || []
    const education = data.education || []

    const hasValidWork = workHistory.some(
      (w) => w.company && w.position && w.start_date
    )
    const hasValidEducation = education.some(
      (e) => e.institution && e.degree && e.area && e.graduation_year
    )

    return hasValidWork && hasValidEducation
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          Your CV
        </h2>
        <p className="text-muted-foreground text-sm">
          Upload your CV or generate a professional one from your information
        </p>
      </div>

      {/* Mode Selection - shown when no mode is selected */}
      {!mode && !hasExistingCV && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upload Option */}
          <button
            id="cv-mode-upload"
            type="button"
            onClick={() => onUpdate({ cv_generation_mode: "upload" })}
            className={cn(
              "group relative p-6 rounded-2xl border-2 transition-all text-left",
              "border-border",
              "hover:border-muted-foreground/40 hover:shadow-lg hover:shadow-black/5"
            )}
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-accent transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Upload CV</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  I have a CV ready to upload (PDF, DOCX, TXT)
                </p>
              </div>
            </div>
            <div className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
              Recommended
            </div>
          </button>

          {/* Generate Option */}
          <button
            id="cv-mode-generate"
            type="button"
            onClick={() => {
              if (!canGenerateNewCV) {
                showUpgradeModalForCV()
                return
              }
              onUpdate({
                cv_generation_mode: "generate",
                work_history: data.work_history || [
                  {
                    company: "",
                    position: "",
                    start_date: "",
                    end_date: null,
                    location: "",
                    highlights: [""],
                  },
                ],
                education: data.education || [
                  {
                    institution: "",
                    degree: "",
                    area: "",
                    graduation_year: "",
                    location: "",
                    highlights: [],
                  },
                ],
                skills: data.skills || [],
              })
            }}
            className={cn(
              "group p-6 rounded-2xl border-2 transition-all text-left relative",
              "border-border",
              canGenerateNewCV
                ? "hover:border-muted-foreground/40 hover:shadow-lg hover:shadow-black/5"
                : "opacity-75"
            )}
          >
            <div className="space-y-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                canGenerateNewCV
                  ? "bg-[var(--coral)]"
                  : "bg-secondary"
              )}>
                {canGenerateNewCV ? (
                  <FileText className="w-6 h-6 text-[var(--coral-ink)]" aria-hidden="true" />
                ) : (
                  <Lock className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  Generate CV
                  {!canGenerateNewCV && (
                    <span className="rounded-md bg-[var(--coral-soft)] px-2 py-0.5 text-xs font-medium text-[var(--coral-lo)]">
                      Pro
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {canGenerateNewCV
                    ? "Create a professional CV from your information"
                    : "Upgrade to Pro to generate additional CVs"
                  }
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* If user has existing CV, show it with option to change */}
      {hasExistingCV && !mode && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--dawn-line-2)] bg-[var(--dawn-cream)] p-5 sm:p-7">
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-[var(--coral-lo)]" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate" title={data.cv_url?.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}>
                      {data.cv_url?.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ready for job matching
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {cvViewUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(cvViewUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdate({ cv_generation_mode: "upload" })}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteCV}
                    disabled={isDeleting}
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!canGenerateNewCV) {
                        showUpgradeModalForCV()
                        return
                      }
                      onUpdate({
                        cv_generation_mode: "generate",
                        work_history: data.work_history || [
                          {
                            company: "",
                            position: "",
                            start_date: "",
                            end_date: null,
                            location: "",
                            highlights: [""],
                          },
                        ],
                        education: data.education || [
                          {
                            institution: "",
                            degree: "",
                            area: "",
                            graduation_year: "",
                            location: "",
                            highlights: [],
                          },
                        ],
                        skills: data.skills || [],
                      })
                    }}
                  >
                    {canGenerateNewCV ? (
                      <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                    ) : (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    Generate New
                    {!canGenerateNewCV && (
                      <span className="ml-1 rounded bg-[var(--coral-soft)] px-1.5 py-0.5 text-[10px] text-[var(--coral-lo)]">Pro</span>
                    )}
                  </Button>
                </div>
              </div>

              {/* CV Preview - only for PDF files */}
              {data.cv_url?.toLowerCase().endsWith('.pdf') ? (
                isLoadingCv ? (
                  <div className="w-full h-[350px] flex items-center justify-center bg-muted rounded-lg border border-border">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : cvViewUrl ? (
                  <div className="w-full rounded-lg overflow-hidden border border-border">
                    <iframe
                      src={`${cvViewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      className="w-full h-[350px] bg-card"
                      title="CV Preview"
                    />
                  </div>
                ) : null
              ) : (
                <div className="w-full py-8 flex flex-col items-center justify-center bg-muted rounded-lg border border-border">
                  <FileText className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click &quot;Open&quot; to view the document
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Mode */}
      {mode === "upload" && (
        <div className="space-y-4">
          <input
            id="setup-cv-file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            aria-label="CV file"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileUpload(e.target.files[0])
              }
            }}
          />

          {data.cv_url ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex w-full flex-col gap-4 rounded-2xl border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-[var(--coral-lo)]" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate" title={data.cv_url.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}>
                      {data.cv_url.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ready for job matching
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {cvViewUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(cvViewUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteCV}
                    disabled={isDeleting}
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {/* CV Preview - only for PDF files */}
              {data.cv_url?.toLowerCase().endsWith('.pdf') ? (
                isLoadingCv ? (
                  <div className="w-full h-[350px] flex items-center justify-center bg-muted rounded-lg border border-border">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : cvViewUrl ? (
                  <div className="w-full rounded-lg overflow-hidden border border-border">
                    <iframe
                      src={`${cvViewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      className="w-full h-[350px] bg-card"
                      title="CV Preview"
                    />
                  </div>
                ) : null
              ) : (
                <div className="w-full py-8 flex flex-col items-center justify-center bg-muted rounded-lg border border-border">
                  <FileText className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click &quot;Open&quot; to view the document
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button
              id="cv-upload-trigger"
              type="button"
              disabled={isUploading}
              className={cn(
                "w-full cursor-pointer rounded-2xl border border-dashed p-6 text-center transition-colors sm:p-8",
                isDragging
                  ? "border-[var(--coral)] bg-[var(--coral-soft)]"
                  : "border-[var(--dawn-line-2)] bg-[var(--dawn-cream)] hover:border-[var(--coral)]/50",
                isUploading && "pointer-events-none opacity-60"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              aria-describedby="setup-cv-upload-help"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
                    <Upload className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Drop your CV here or click to browse
                    </p>
                    <p id="setup-cv-upload-help" className="text-sm text-muted-foreground mt-1">
                      PDF, DOCX, or TXT (max 10MB)
                    </p>
                  </div>
                </div>
              )}
            </button>
          )}

          {/* Back button */}
          {!data.cv_url && (
            <button
              onClick={() => onUpdate({ cv_generation_mode: undefined })}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Choose different option
            </button>
          )}
        </div>
      )}

      {/* Generate Mode */}
      {mode === "generate" && (
        <div className="space-y-8">
          {/* Info Banner */}
            <div className="rounded-xl border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-4">
            <div className="flex gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--coral-lo)]" aria-hidden="true" />
              <div>
                <p className="font-medium text-[var(--dawn-ink)]">
                  AI-Generated CV
                </p>
                <p className="mt-1 text-sm text-[var(--dawn-ink-2)]">
                  Fill in the sections below. We&apos;ll generate a professional
                  PDF CV for you when you save.
                </p>
              </div>
            </div>
          </div>

          {/* Work History Section */}
          <WorkHistorySection data={data} onUpdate={onUpdate} />

          {/* Education Section */}
          <EducationSection data={data} onUpdate={onUpdate} />

          {/* Skills Section */}
          <SkillsSection
            data={data}
            onUpdate={onUpdate}
            jobTitles={jobFilters?.job_titles || []}
          />

          {/* Validation Status */}
          {!hasValidGenerateData() && (
            <div className="rounded-xl border border-[var(--coral)]/25 bg-[var(--coral-soft)] p-4">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--coral-lo)]" />
                <div>
                  <p className="font-medium text-[var(--dawn-ink)]">
                    Complete Required Sections
                  </p>
                  <p className="mt-1 text-sm text-[var(--dawn-ink-2)]">
                    Add at least one work experience and one education entry to
                    generate your CV.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Back button */}
          <button
            onClick={() =>
              onUpdate({
                cv_generation_mode: undefined,
              })
            }
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Choose different option
          </button>
        </div>
      )}
    </div>
  )
}
