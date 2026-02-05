"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, Calendar, ExternalLink, ArrowLeft, Trash2, Flag, Sparkles, Check, MessageSquare, Briefcase, FileText, Loader2 } from "lucide-react"
import type { Job, Profile } from "@/lib/supabase/types"
import { ReportProblemDialog } from "@/components/report"
import { dispatchSetJobContext } from "@/lib/events/chat-events"
import { FavoriteButton } from "@/components/dashboard/FavoriteButton"
import { useSubscription } from "@/contexts/SubscriptionContext"
import { JobAIChat } from "@/components/ai-assistant"
import { CVGeneratorDialog } from "@/components/cv"
import { FeatureGate } from "@/components/ui/feature-gate"
import { JobNotes } from "@/components/job-notes"

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
  const isPremium = plan === "pro" || plan === "mega" || isTester

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

        // Fetch favorite status and preference reasons for Pro users and testers
        if (profileData?.subscription_plan === 'pro' || profileData?.subscription_plan === 'mega' || profileData?.is_tester) {
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
          } catch (e) {
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
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-zinc-400" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
            Job Not Found
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            This job may have been removed or is no longer available.
          </p>
          <Button onClick={() => router.push("/dashboard")} variant="default">
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Compact Sticky Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold truncate">{job.title}</h1>
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
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>{job.company || "Unknown Company"}</span>
                {job.location && <><span>•</span><MapPin className="w-2.5 h-2.5" /><span>{job.location}</span></>}
                {job.job_type && <Badge variant="outline" className="text-[9px] h-3.5 px-1">{job.job_type}</Badge>}
              </div>
            </div>
            <FeatureGate
              feature="cv_generator"
              mode="button"
              buttonLabel="Generate CV"
              buttonVariant="outline"
              buttonSize="sm"
              buttonClassName="h-6 text-[10px] px-2"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setShowCvGenerator(true)}
              >
                <FileText className="w-3 h-3 mr-0.5" />Generate CV
              </Button>
            </FeatureGate>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
              onClick={() => setShowReportDialog(true)}
            >
              <Flag className="w-3 h-3 mr-0.5" />Report Issue
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" onClick={handleDiscard}>
              <Trash2 className="w-3 h-3 mr-0.5" />Discard
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Both columns scroll together */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Job Description - Left side */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold">Job Description</h2>
              <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                <Calendar className="w-2.5 h-2.5" />{formatDate(job.created_at)}
              </span>
            </div>
            <div
              className="prose prose-xs dark:prose-invert max-w-none text-[11px] leading-relaxed [&_p]:my-1 [&_li]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:text-sm [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_strong]:text-[11px]"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(job.description || "No description available.", {
                  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'a'],
                  ALLOWED_ATTR: ['href', 'target', 'rel']
                }),
              }}
            />
            {/* Why I might like this - for Pro/Ultra users with preference data */}
            {isPremium && preferenceReasons.length > 0 && (
              <div className="mt-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 rounded-md bg-emerald-500/10">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Why you might like this
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {preferenceReasons.map((reason, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-[11px] text-emerald-800 dark:text-emerald-300"
                    >
                      <Check className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-500" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.application_url && (
              <div className="mt-3 pt-2 border-t">
                <Button variant="outline" size="sm" asChild className="gap-1.5 h-6 text-[10px]">
                  <a href={job.application_url || '#'} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" />View Original
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* AI Application Assistant - Right side */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                <h2 className="text-xs font-semibold">AI Application Assistant</h2>
              </div>
              {job.application_url && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => window.open(job.application_url!, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Apply Now
                </Button>
              )}
            </div>
            <JobAIChat job={job} profile={profile} />

            {/* Notes Section */}
            <JobNotes
              jobId={job.id}
              initialNotes={job.notes}
              onNotesChange={handleNotesChange}
            />
          </div>
        </div>
      </div>

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
