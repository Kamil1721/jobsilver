"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Trash2,
  ExternalLink,
} from "lucide-react"
import type { ScreeningAnswers, JobFilters, SubscriptionPlan } from "@/lib/supabase/types"
import { WorkHistorySection, EducationSection, SkillsSection } from "./cv-sections"
import { Lock } from "lucide-react"

interface StepCVProps {
  data: ScreeningAnswers
  onUpdate: (updates: Partial<ScreeningAnswers>) => void
  jobFilters?: JobFilters
  isFirstTimeSetup?: boolean
  subscriptionPlan?: SubscriptionPlan
}

export function StepCV({ data, onUpdate, jobFilters, isFirstTimeSetup = true, subscriptionPlan = 'free' }: StepCVProps) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [cvViewUrl, setCvViewUrl] = React.useState<string | null>(null)
  const [isLoadingCv, setIsLoadingCv] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const mode = data.cv_generation_mode
  const hasExistingCV = !!data.cv_url

  // Free users can only generate CV once (first-time setup)
  // After that, they need Pro/Ultra to generate new CVs
  const canGenerateNewCV = isFirstTimeSetup || subscriptionPlan === 'pro' || subscriptionPlan === 'ultra'

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
      fetchCvUrl()
    }
  }, [data.cv_url, cvViewUrl, fetchCvUrl])

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]
    const validExtensions = [".pdf", ".doc", ".docx", ".txt"]
    const fileExt = "." + (file.name.split(".").pop()?.toLowerCase() || "")

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, DOCX, or TXT file",
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

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const responseData = await response.json()
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
    } catch (error) {
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
          <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
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
            onClick={() => onUpdate({ cv_generation_mode: "upload" })}
            className={cn(
              "group relative p-6 rounded-2xl border-2 transition-all text-left",
              "border-zinc-200 dark:border-zinc-700",
              "hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-none"
            )}
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center group-hover:bg-zinc-200 dark:group-hover:bg-white/[0.08] transition-colors">
                <Upload className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Upload CV</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  I have a CV ready to upload (PDF, DOC, DOCX)
                </p>
              </div>
            </div>
            <div className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-white/[0.05] text-muted-foreground">
              Recommended
            </div>
          </button>

          {/* Generate Option */}
          <button
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
              "border-zinc-200 dark:border-zinc-700",
              canGenerateNewCV
                ? "hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-none"
                : "opacity-75"
            )}
          >
            <div className="space-y-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                canGenerateNewCV
                  ? "bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600"
                  : "bg-zinc-200 dark:bg-zinc-700"
              )}>
                {canGenerateNewCV ? (
                  <Sparkles className="w-6 h-6 text-white" />
                ) : (
                  <Lock className="w-6 h-6 text-zinc-500" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  Generate CV
                  {!canGenerateNewCV && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
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
          <div className="border-2 border-dashed rounded-xl p-8 border-zinc-300 dark:border-white/[0.08]">
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center justify-between w-full gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate" title={data.cv_url?.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}>
                      {data.cv_url?.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Ready for job matching
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                      <Sparkles className="w-4 h-4 mr-2" />
                    ) : (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    Generate New
                    {!canGenerateNewCV && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Pro</span>
                    )}
                  </Button>
                </div>
              </div>

              {/* CV Preview - only for PDF files */}
              {data.cv_url?.toLowerCase().endsWith('.pdf') ? (
                isLoadingCv ? (
                  <div className="w-full h-[350px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                  </div>
                ) : cvViewUrl ? (
                  <div className="w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <iframe
                      src={`${cvViewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      className="w-full h-[350px] bg-white"
                      title="CV Preview"
                    />
                  </div>
                ) : null
              ) : (
                <div className="w-full py-8 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <FileText className="w-12 h-12 text-zinc-400 mb-3" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Preview not available for this file type
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
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
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileUpload(e.target.files[0])
              }
            }}
          />

          {data.cv_url ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center justify-between w-full gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate" title={data.cv_url.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}>
                      {data.cv_url.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Ready for job matching
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                </div>
              </div>

              {/* CV Preview - only for PDF files */}
              {data.cv_url?.toLowerCase().endsWith('.pdf') ? (
                isLoadingCv ? (
                  <div className="w-full h-[350px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                  </div>
                ) : cvViewUrl ? (
                  <div className="w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <iframe
                      src={`${cvViewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      className="w-full h-[350px] bg-white"
                      title="CV Preview"
                    />
                  </div>
                ) : null
              ) : (
                <div className="w-full py-8 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <FileText className="w-12 h-12 text-zinc-400 mb-3" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Preview not available for this file type
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Click &quot;Open&quot; to view the document
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-zinc-400 bg-zinc-50 dark:bg-white/[0.05]"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400",
                isUploading && "pointer-events-none opacity-60"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-zinc-600 dark:text-zinc-400 animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center">
                    <Upload className="w-7 h-7 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Drop your CV here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, DOC, DOCX, or TXT (max 10MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Back button */}
          {!data.cv_url && (
            <button
              onClick={() => onUpdate({ cv_generation_mode: undefined })}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
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
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  AI-Generated CV
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
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
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Complete Required Sections
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
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
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Choose different option
          </button>
        </div>
      )}
    </div>
  )
}
