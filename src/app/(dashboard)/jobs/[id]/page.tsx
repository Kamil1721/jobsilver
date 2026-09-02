"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, Calendar, ExternalLink, ArrowLeft, Trash2, Flag, Check, MessageSquare, Briefcase, FileText, Loader2, CircleCheck, NotebookPen } from "lucide-react"
import type { Job, Profile } from "@/lib/supabase/types"
import { ReportProblemDialog } from "@/components/report"
import { dispatchSetJobContext } from "@/lib/events/chat-events"
import { FavoriteButton } from "@/components/dashboard/FavoriteButton"
import { useSubscription } from "@/contexts/SubscriptionContext"
import { JobAIChat } from "@/components/ai-assistant"
import { CVGeneratorDialog } from "@/components/cv"
import { FeatureGate } from "@/components/ui/feature-gate"
import { JobNotes } from "@/components/job-notes"

function sanitizeJobDescription(description: string | null): string {
  const sanitized = DOMPurify.sanitize(description || "No description available.", {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })

  return sanitized
    .replace(/<h[1-6]\b[^>]*>/gi, '<h3>')
    .replace(/<\/h[1-6]>/gi, '</h3>')
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [job, setJob] = React.useState<Job | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [showReportDialog, setShowReportDialog] = React.useState(false)
  const [showCvGenerator, setShowCvGenerator] = React.useState(false)
  const [isGeneratingCV, setIsGeneratingCV] = React.useState(false)
  const [isFavorited, setIsFavorited] = React.useState(false)
  const [preferenceReasons, setPreferenceReasons] = React.useState<string[]>([])
  const { plan, isTester } = useSubscription()
  const isPremium = plan === "pro" || plan === "ultra" || plan === "mega" || isTester

  const handleNotesChange = React.useCallback((notes: string) => {
    setJob(prev => prev ? { ...prev, notes } : null)
  }, [])

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push("/login"); return }

        const { data: jobData, error: jobError } = await supabase.from("jobs").select("*").eq("id", params.id).single()
        if (jobError) {
          toast({ variant: "destructive", title: "Error", description: "Could not load job details" })
          router.push("/dashboard")
          return
        }

        setJob(jobData)
        dispatchSetJobContext({ jobId: jobData.id, title: jobData.title, company: jobData.company || 'Unknown Company', description: jobData.description || undefined })

        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()
        if (profileData) setProfile(profileData)

        // Fetch favorite status and preference reasons for Pro/Ultra users and testers
        if (profileData?.subscription_plan === 'pro' || profileData?.subscription_plan === 'ultra' || profileData?.subscription_plan === 'mega' || profileData?.is_tester) {
          try {
            const favResponse = await fetch(`/api/jobs/${params.id}/favorite`)
            if (favResponse.ok) {
              const favData = await favResponse.json()
              // API returns { data: { is_favorited: boolean } }
              setIsFavorited(favData.data?.is_favorited || false)
            }

            // Fetch preference match reasons
            const prefResponse = await fetch(`/api/preferences/match?jobId=${params.id}`)
            if (prefResponse.ok) {
              const prefData = await prefResponse.json()
              setPreferenceReasons(prefData.reasons || [])
            }
          } catch {
            // Silently fail - not critical
          }
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error loading job details:', error)
        toast({ variant: "destructive", title: "Error", description: "Failed to load job details. Please try again." })
        setIsLoading(false)
      }
    }
    fetchData()
  }, [params.id, supabase, router, toast])

  const handleDiscard = async () => {
    if (!job) return
    const { error } = await supabase.from("jobs").update({ status: "discarded" }).eq("id", job.id)
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return }
    toast({ title: "Job discarded", description: "The job has been removed from your board." })
    router.push("/dashboard")
  }

  const handleMarkAsApplied = async () => {
    if (!job) return
    const { error } = await supabase.from("jobs").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", job.id)
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return }
    toast({ title: "Marked as Applied" })
    router.push("/dashboard")
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  // Quick generate CV handler - tries to generate directly, falls back to dialog if data missing
  const handleQuickGenerateCV = async () => {
    if (!job) return

    setIsGeneratingCV(true)
    try {
      const response = await fetch('/api/cv/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickGenerate: true,
          jobContext: {
            id: job.id,
            title: job.title,
            company: job.company || 'Unknown',
            description: job.description,
          },
        }),
      })

      const result = await response.json()

      if (result.needsDialog) {
        // Not enough data for quick generation, show dialog
        setShowCvGenerator(true)
        toast({
          title: "Additional information needed",
          description: result.message || "Please complete the form to generate your CV.",
        })
      } else if (result.success && result.signed_url) {
        // Success - open the generated CV
        window.open(result.signed_url, '_blank')
        toast({
          title: "CV Generated!",
          description: `Your CV tailored for ${job.company || 'this role'} is ready.`,
        })
      } else if (result.error) {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Quick generate error:', error)
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate CV. Please try again.",
      })
      // Fall back to showing dialog on error
      setShowCvGenerator(true)
    } finally {
      setIsGeneratingCV(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background p-3">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-muted flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Job Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            This job may have been removed or is no longer available.
          </p>
          <Button onClick={() => router.push("/dashboard")} variant="default">
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const hasApplied = job.status === "applied" || job.status === "interviewing" || job.status === "offer"
  const descriptionHtml = sanitizeJobDescription(job.description)

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--dawn-bg)] dark:bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-4 sm:items-center sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="mt-0.5 h-9 w-9 shrink-0 p-0 sm:mt-0"
            onClick={() => router.push("/dashboard")}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h1 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">{job.title}</h1>
              {isPremium && (
                <FavoriteButton
                  jobId={job.id}
                  initialFavorited={isFavorited}
                  onToggle={setIsFavorited}
                  size="sm"
                  showTooltip={false}
                />
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{job.company || "Unknown company"}</span>
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              )}
              {job.job_type && <Badge variant="outline" className="h-6 px-2 text-xs">{job.job_type}</Badge>}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-start lg:gap-10">
          <article className="min-w-0 lg:col-span-3">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--coral-lo)]">Role overview</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Job description</h2>
              </div>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Added {formatDate(job.created_at)}
              </span>
            </div>
            <div
              className="prose prose-zinc dark:prose-invert max-w-[72ch] text-[15px] leading-7 [&_a]:text-[color:var(--coral-lo)] [&_a]:decoration-[var(--coral)]/40 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:decoration-[var(--coral)] [&_h3]:mt-6 [&_h3]:text-lg [&_li]:my-1.5 [&_p]:my-4"
              dangerouslySetInnerHTML={{
                __html: descriptionHtml,
              }}
            />
          </article>

          <aside className="space-y-4 lg:col-span-2 lg:sticky lg:top-28">
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-[var(--coral-soft)]/55 px-5 py-5 dark:bg-[var(--coral-soft)]/10">
                <div className="flex items-center gap-2 text-[var(--coral-lo)]">
                  <Briefcase className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]">Application prep</p>
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Prepare a strong handoff</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Review your materials here, then finish and submit on the employer&apos;s site.
                </p>
              </div>

              <div className="space-y-5 p-5">
                {isPremium && preferenceReasons.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        Why this role fits
                      </h3>
                      {job.match_score != null && (
                        <Badge variant="outline" className="text-xs">{job.match_score}% match</Badge>
                      )}
                    </div>
                    <ul className="space-y-2.5">
                      {preferenceReasons.map((reason, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">Tailor your CV</h3>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">Create a version focused on this role before you continue.</p>
                      <FeatureGate
                        feature="cv_generator"
                        mode="button"
                        buttonLabel="Generate tailored CV"
                        buttonVariant="outline"
                        buttonSize="sm"
                        buttonClassName="mt-3 h-9"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 h-9 gap-2"
                          onClick={handleQuickGenerateCV}
                          disabled={isGeneratingCV}
                        >
                          {isGeneratingCV ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          {isGeneratingCV ? "Preparing CV" : "Generate tailored CV"}
                        </Button>
                      </FeatureGate>
                    </div>
                  </div>
                </div>

                {job.application_url ? (
                  <Button asChild className="h-11 w-full gap-2 bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)]">
                    <a href={job.application_url} target="_blank" rel="noopener noreferrer">
                      Open company application
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button className="h-11 w-full" disabled>
                    Company application unavailable
                  </Button>
                )}

                {hasApplied ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CircleCheck className="h-4 w-4" />
                    Tracked as applied
                  </div>
                ) : (
                  <Button variant="ghost" className="h-10 w-full gap-2" onClick={handleMarkAsApplied}>
                    <CircleCheck className="h-4 w-4" />
                    Mark as applied
                  </Button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--coral-lo)]" />
                <h2 className="text-base font-semibold">Prepare your answers</h2>
              </div>
              <p className="mb-4 text-sm leading-6 text-muted-foreground">Use the role context to draft talking points and application answers.</p>
              <JobAIChat job={job} profile={profile} />
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-1 flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-[var(--coral-lo)]" />
                <h2 className="text-base font-semibold">Your notes</h2>
              </div>
              <JobNotes
                jobId={job.id}
                initialNotes={job.notes}
                onNotesChange={handleNotesChange}
              />
            </section>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground" onClick={() => setShowReportDialog(true)}>
                <Flag className="h-4 w-4" />
                Report issue
              </Button>
              <Button variant="ghost" size="sm" className="h-9 gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950" onClick={handleDiscard}>
                <Trash2 className="h-4 w-4" />
                Discard
              </Button>
            </div>
          </aside>
        </div>
      </main>

      {/* Report dialog with job context */}
      {job && (
        <ReportProblemDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          jobContext={{
            id: job.id,
            title: job.title,
            company: job.company,
          }}
        />
      )}

      {/* CV Generator Dialog for this job */}
      {job && (
        <CVGeneratorDialog
          open={showCvGenerator}
          onOpenChange={setShowCvGenerator}
          job={job}
          onCVGenerated={(cvUrl, signedUrl) => {
            if (signedUrl) {
              window.open(signedUrl, '_blank')
            }
          }}
        />
      )}
    </div>
  )
}
