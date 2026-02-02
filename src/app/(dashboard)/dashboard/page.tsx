"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SearchBar } from "@/components/dashboard/search-bar"
import { KanbanColumn } from "@/components/dashboard/kanban-column"
import { JobCard } from "@/components/dashboard/job-card"
import {
  Briefcase,
  Sparkles,
  Search,
  Zap,
  Heart,
  FileText,
  X,
  Settings2,
  CheckSquare,
  Square,
  Crown,
} from "lucide-react"
import { useSubscription } from "@/contexts/SubscriptionContext"
import { QuotaDisplay } from "@/components/dashboard/quota-display"
import { BulkActionsToolbar } from "@/components/dashboard/bulk-actions-toolbar"
import type { Job, JobStatus, QuotaStatus } from "@/lib/supabase/types"

interface UpgradeTeaser {
  hidden_jobs_count: number
  message: string
  total_found: number
  shown: number
}

interface SearchFilters {
  keywords: string
  location: string
  remote: boolean
  jobType: string
}

// 3-column system
type ColumnId = "discovered" | "applied" | "offer"

const columns: { id: ColumnId; title: string }[] = [
  { id: "discovered", title: "NEW MATCHES" },
  { id: "applied", title: "APPLIED" },
  { id: "offer", title: "OFFERS" },
]

// Loading fallback for Suspense
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-zinc-400 animate-spin" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPageContent />
    </Suspense>
  )
}

function DashboardPageContent() {
  const [jobs, setJobs] = React.useState<Job[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSearching, setIsSearching] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<Job | null>(null)
  const [jobToDiscard, setJobToDiscard] = React.useState<string | null>(null)
  const [quota, setQuota] = React.useState<QuotaStatus | null>(null)
  const [productionMode, setProductionMode] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false)
  const [isTester, setIsTester] = React.useState<boolean>(false)
  const [showModeSettings, setShowModeSettings] = React.useState(false)
  const [searchFilter, setSearchFilter] = React.useState<SearchFilters>({
    keywords: "",
    location: "",
    remote: false,
    jobType: "all",
  })
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false)
  const [filtersInitialized, setFiltersInitialized] = React.useState(false)
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set())
  const [cvIsGenerated, setCvIsGenerated] = React.useState(false)
  const [showCvBanner, setShowCvBanner] = React.useState(true)
  // Selection state for bulk actions
  const [isSelectionMode, setIsSelectionMode] = React.useState(false)
  const [selectedJobIds, setSelectedJobIds] = React.useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = React.useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
  const [upgradeTeaser, setUpgradeTeaser] = React.useState<UpgradeTeaser | null>(null)
  // Track pending drag updates to prevent race conditions
  const pendingDragUpdates = React.useRef<Set<string>>(new Set())
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { plan, isTester: subscriptionIsTester } = useSubscription()
  // Check for premium plans (current 'pro' + legacy plans for backwards compatibility) or tester status
  const isPremium = plan === "pro" || (plan as string) === "mega" || subscriptionIsTester || isTester

  // Check for tester activation from OAuth callback
  React.useEffect(() => {
    const testerParam = searchParams.get("tester")
    if (testerParam === "activated") {
      toast({
        title: "Welcome, Tester!",
        description: "You have full access to all features.",
      })
      // Clean up the URL
      router.replace("/dashboard", { scroll: false })
    }
  }, [searchParams, toast, router])

  // Initialize filter state from URL params on mount
  React.useEffect(() => {
    if (filtersInitialized) return

    const keywords = searchParams.get("keywords") || ""
    const location = searchParams.get("location") || ""
    const remote = searchParams.get("remote") === "true"
    const jobType = searchParams.get("jobType") || "all"
    const favorites = searchParams.get("favorites") === "true"

    // Only update if there are URL params
    if (keywords || location || remote || jobType !== "all" || favorites) {
      setSearchFilter({ keywords, location, remote, jobType })
      setShowFavoritesOnly(favorites)
    }
    setFiltersInitialized(true)
  }, [searchParams, filtersInitialized])

  // Sync filter state to URL params (only after initialization)
  React.useEffect(() => {
    if (!filtersInitialized) return

    const params = new URLSearchParams()

    // Only add non-default values to URL
    if (searchFilter.keywords) params.set("keywords", searchFilter.keywords)
    if (searchFilter.location) params.set("location", searchFilter.location)
    if (searchFilter.remote) params.set("remote", "true")
    if (searchFilter.jobType !== "all") params.set("jobType", searchFilter.jobType)
    if (showFavoritesOnly) params.set("favorites", "true")

    const queryString = params.toString()
    const newUrl = queryString ? `/dashboard?${queryString}` : "/dashboard"

    // Only update if URL actually changed (avoid unnecessary history entries)
    const currentParams = new URLSearchParams(window.location.search)
    if (params.toString() !== currentParams.toString()) {
      router.replace(newUrl, { scroll: false })
    }
  }, [searchFilter, showFavoritesOnly, router, filtersInitialized])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch user's jobs on mount
  React.useEffect(() => {
    const fetchJobs = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch profile data including upgrade teaser
      const { data: profile } = await supabase
        .from("profiles")
        .select("production_mode, is_admin, is_tester, cv_is_generated, upgrade_teaser, subscription_plan")
        .eq("id", user.id)
        .single()

      if (profile) {
        setProductionMode(profile.production_mode || false)
        setIsAdmin(profile.is_admin === true)
        setIsTester((profile as any).is_tester === true)
        setCvIsGenerated(profile.cv_is_generated === true)

        // Set upgrade teaser from profile (for free users)
        if ((profile as any).upgrade_teaser && profile.subscription_plan === 'free') {
          setUpgradeTeaser((profile as any).upgrade_teaser as UpgradeTeaser)
        }
      }

      // Fetch all jobs except discarded
      const { data: allJobs, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "discarded")
        .order("created_at", { ascending: false })

      if (error) {
        toast({
          variant: "destructive",
          title: "Error fetching jobs",
          description: error.message,
        })
        return
      }

      // Map old statuses to new 3-column system
      const mappedJobs = (allJobs || []).map(job => {
        let newStatus = job.status
        // Map old statuses: saved -> discovered, interviewing -> applied
        if (job.status === "saved") newStatus = "discovered"
        if (job.status === "interviewing") newStatus = "applied"
        return { ...job, status: newStatus }
      })

      // All jobs are shown - auto-apply status filtering removed since we pivoted to AI assistance model
      setJobs(mappedJobs)

      // Fetch favorite IDs for premium users and testers
      const userPlan = (profile as any)?.subscription_plan
      const userIsTester = (profile as any)?.is_tester
      if (userPlan === 'pro' || userPlan === 'mega' || userIsTester) {
        try {
          const favResponse = await fetch('/api/jobs/favorites')
          if (favResponse.ok) {
            const favData = await favResponse.json()
            setFavoriteIds(new Set(favData.favoriteIds || []))
          }
        } catch (e) {
          // Silently fail - not critical
        }
      }

      setIsLoading(false)
    }

    fetchJobs()
  }, [supabase, toast])

  // Search for new jobs
  const handleSearch = async (filters: SearchFilters) => {
    setIsSearching(true)

    try {
      const hasManualQuery = filters.keywords || filters.location

      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          hasManualQuery
            ? {
                useProfileFilters: false,
                manualQuery: [filters.keywords, filters.location].filter(Boolean).join(" in "),
              }
            : {
                useProfileFilters: true,
              }
        ),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429 && data.quota) {
          setQuota(data.quota)
          toast({
            variant: "destructive",
            title: "Daily quota exceeded",
            description: `You've used all ${data.quota.limit} jobs for today. Quota resets at midnight UTC.`,
          })
          return
        }
        if (data.redirect_to_setup) {
          toast({
            variant: "destructive",
            title: "Setup Required",
            description: data.validation_errors?.map((e: { message: string }) => e.message).join(". ") || "Please complete your job preferences setup.",
          })
          setTimeout(() => {
            window.location.href = "/setup"
          }, 2000)
          return
        }
        throw new Error(data.error || "Search failed")
      }

      if (data.quota) {
        setQuota(data.quota)
      }

      // Store upgrade teaser for free users
      if (data.upgrade_teaser) {
        setUpgradeTeaser(data.upgrade_teaser)
      } else {
        setUpgradeTeaser(null)
      }

      // Add new discovered jobs to the list
      const newJobs = (data.jobs || []).map((job: Job) => ({
        ...job,
        status: "discovered" as JobStatus
      }))

      setJobs(prev => {
        // Filter out any duplicates by ID
        const existingIds = new Set(prev.map(j => j.id))
        const uniqueNewJobs = newJobs.filter((j: Job) => !existingIds.has(j.id))
        return [...uniqueNewJobs, ...prev]
      })

      toast({
        title: "Search complete",
        description: `Found ${data.jobs?.length || 0} matching jobs`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Search failed",
        description: "Could not search for jobs. Please try again.",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Prompt to discard a job
  const promptDiscardJob = (jobId: string) => {
    setJobToDiscard(jobId)
  }

  // Confirm discard
  const confirmDiscardJob = async () => {
    if (!jobToDiscard) return

    // Use .select() to verify the update actually happened
    const { data, error } = await supabase
      .from("jobs")
      .update({ status: "discarded" })
      .eq("id", jobToDiscard)
      .select("id")
      .single()

    if (error) {
      console.error("Discard error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
      setJobToDiscard(null)
      return
    }

    if (!data) {
      console.error("Discard failed: No row was updated for job ID:", jobToDiscard)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not discard the job. Please try again.",
      })
      setJobToDiscard(null)
      return
    }

    console.log("Job discarded successfully:", data.id)
    setJobs(prev => prev.filter(j => j.id !== jobToDiscard))

    toast({
      title: "Job discarded",
      description: "The job has been removed from your board.",
    })
    setJobToDiscard(null)
  }

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const job = jobs.find(j => j.id === active.id)
    if (job) {
      setActiveJob(job)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveJob(null)

    if (!over) return

    const draggedJob = jobs.find(j => j.id === active.id)
    if (!draggedJob) return

    // RACE CONDITION FIX: Prevent concurrent updates to the same job
    if (pendingDragUpdates.current.has(draggedJob.id)) {
      return // Ignore drag if this job is already being updated
    }

    // Get target column
    const overData = over.data.current as { type: string; status?: ColumnId }
    let newStatus: ColumnId | undefined

    if (overData?.type === "column") {
      newStatus = overData.status
    } else {
      const overJob = jobs.find(j => j.id === over.id)
      if (overJob) {
        newStatus = overJob.status as ColumnId
      }
    }

    if (!newStatus || newStatus === draggedJob.status) return

    // Map the column ID to the actual database status
    const dbStatus: JobStatus = newStatus
    const previousStatus = draggedJob.status

    // Mark this job as having a pending update
    pendingDragUpdates.current.add(draggedJob.id)

    // OPTIMISTIC UPDATE: Update local state immediately for better UX
    setJobs(prev =>
      prev.map(j =>
        j.id === draggedJob.id ? { ...j, status: newStatus! } : j
      )
    )

    try {
      // Update in database
      const { error } = await supabase
        .from("jobs")
        .update({ status: dbStatus })
        .eq("id", draggedJob.id)

      if (error) {
        // ROLLBACK: Revert to previous status on error
        setJobs(prev =>
          prev.map(j =>
            j.id === draggedJob.id ? { ...j, status: previousStatus } : j
          )
        )
        toast({
          variant: "destructive",
          title: "Error updating job",
          description: error.message,
        })
      }
    } finally {
      // Always clear the pending state
      pendingDragUpdates.current.delete(draggedJob.id)
    }
  }

  // Handle favorite toggle
  const handleFavoriteToggle = (jobId: string, favorited: boolean) => {
    setFavoriteIds(prev => {
      const newSet = new Set(prev)
      if (favorited) {
        newSet.add(jobId)
      } else {
        newSet.delete(jobId)
      }
      return newSet
    })
  }

  // Handle Review & Submit for assisted mode
  const handleReviewSubmit = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return

    // Navigate to job detail page
    router.push(`/jobs/${jobId}`)
  }

  // Selection handlers for bulk actions
  const handleSelectionChange = (jobId: string, selected: boolean) => {
    setSelectedJobIds(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(jobId)
      } else {
        newSet.delete(jobId)
      }
      return newSet
    })
  }

  const handleSelectAllInColumn = (jobIds: string[], selected: boolean) => {
    setSelectedJobIds(prev => {
      const newSet = new Set(prev)
      if (selected) {
        jobIds.forEach(id => newSet.add(id))
      } else {
        jobIds.forEach(id => newSet.delete(id))
      }
      return newSet
    })
  }

  const handleClearSelection = () => {
    setSelectedJobIds(new Set())
    setIsSelectionMode(false)
  }

  // Prompt to confirm bulk delete
  const handleBulkDelete = async () => {
    if (selectedJobIds.size === 0) return
    setShowBulkDeleteConfirm(true)
  }

  // Actually perform the bulk delete after confirmation
  const confirmBulkDelete = async () => {
    setShowBulkDeleteConfirm(false)
    if (selectedJobIds.size === 0) return

    const idsToDelete = Array.from(selectedJobIds)
    const initialCount = idsToDelete.length

    setIsBulkProcessing(true)
    try {
      // Use .select() to verify which jobs were actually deleted
      const { data: deletedJobs, error } = await supabase
        .from("jobs")
        .delete()
        .in("id", idsToDelete)
        .select("id")

      if (error) {
        toast({
          variant: "destructive",
          title: "Error deleting jobs",
          description: error.message,
        })
        return
      }

      const deletedIds = new Set(deletedJobs?.map(j => j.id) || [])
      const deletedCount = deletedIds.size

      // Only remove jobs that were actually deleted
      setJobs(prev => prev.filter(j => !deletedIds.has(j.id)))

      if (deletedCount === initialCount) {
        toast({
          title: "Jobs deleted",
          description: `${deletedCount} jobs have been permanently deleted.`,
        })
      } else if (deletedCount > 0) {
        toast({
          variant: "destructive",
          title: "Partial deletion",
          description: `Only ${deletedCount} of ${initialCount} jobs were deleted. Some may have already been removed.`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "No jobs deleted",
          description: "The selected jobs may have already been removed.",
        })
      }
      handleClearSelection()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete jobs",
      })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleBulkStatusChange = async (newStatus: JobStatus) => {
    if (selectedJobIds.size === 0) return

    setIsBulkProcessing(true)
    try {
      // Use .select() to verify which rows were actually updated
      const { data: updatedJobs, error } = await supabase
        .from("jobs")
        .update({ status: newStatus })
        .in("id", Array.from(selectedJobIds))
        .select("id")

      if (error) {
        toast({
          variant: "destructive",
          title: "Error updating jobs",
          description: "Failed to update jobs. Please try again.",
        })
        return
      }

      // Only update local state for jobs that were actually updated
      const updatedIds = new Set(updatedJobs?.map(j => j.id) || [])
      setJobs(prev =>
        prev.map(j =>
          updatedIds.has(j.id) ? { ...j, status: newStatus } : j
        )
      )

      const updateCount = updatedIds.size
      toast({
        title: "Jobs updated",
        description: `${updateCount} job${updateCount === 1 ? '' : 's'} ${updateCount === 1 ? 'has' : 'have'} been moved.`,
      })
      handleClearSelection()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update jobs",
      })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  // Filter jobs based on search criteria
  const filterJobs = React.useCallback((jobList: Job[]) => {
    return jobList.filter(job => {
      // Favorites filter
      if (showFavoritesOnly && !favoriteIds.has(job.id)) {
        return false
      }

      // Keywords filter - search in title, company, description
      if (searchFilter.keywords) {
        const keywords = searchFilter.keywords.toLowerCase()
        const matchesKeywords =
          job.title?.toLowerCase().includes(keywords) ||
          job.company?.toLowerCase().includes(keywords) ||
          job.description?.toLowerCase().includes(keywords)
        if (!matchesKeywords) return false
      }

      // Location filter
      if (searchFilter.location) {
        const location = searchFilter.location.toLowerCase()
        const matchesLocation = job.location?.toLowerCase().includes(location)
        if (!matchesLocation) return false
      }

      // Remote filter
      if (searchFilter.remote) {
        const isRemote = job.location?.toLowerCase().includes("remote")
        if (!isRemote) return false
      }

      // Job type filter
      if (searchFilter.jobType !== "all") {
        const jobType = job.job_type?.toLowerCase().replace(/[- ]/g, "")
        const filterType = searchFilter.jobType.toLowerCase().replace(/[- ]/g, "")
        if (!jobType?.includes(filterType)) return false
      }

      return true
    })
  }, [searchFilter, showFavoritesOnly, favoriteIds])

  // Get jobs for each column
  const getColumnJobs = (columnId: ColumnId) => {
    const columnJobs = jobs.filter(job => {
      if (columnId === "discovered") {
        return job.status === "discovered" || job.status === "saved"
      }
      if (columnId === "applied") {
        return job.status === "applied" || job.status === "interviewing"
      }
      return job.status === columnId
    })
    return filterJobs(columnJobs)
  }

  // Calculate stats
  const stats = {
    newMatches: getColumnJobs("discovered").length,
    applied: getColumnJobs("applied").length,
    offers: getColumnJobs("offer").length,
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedJobIds.size}
        onClearSelection={handleClearSelection}
        onBulkDelete={handleBulkDelete}
        onBulkStatusChange={handleBulkStatusChange}
        isProcessing={isBulkProcessing}
      />

      {/* Page header */}
      <div className="border-b border-zinc-200 dark:border-white/[0.04] bg-white/50 dark:bg-[#0a0a0b]/50">
        <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto">
          <div className="flex flex-col gap-5">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Dashboard</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Track your applications and discover opportunities
                </p>
              </div>

              {/* Quick stats - metallic badges with dots instead of colored backgrounds */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{stats.newMatches} New</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-zinc-600 dark:bg-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{stats.applied} Applied</span>
                </div>
                {stats.offers > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{stats.offers} Offers</span>
                  </div>
                )}
                {quota && <QuotaDisplay quota={quota} />}
              </div>
            </div>

            {/* Search bar - visible for admins and testers */}
            <SearchBar
              onSearch={handleSearch}
              onFilterChange={setSearchFilter}
              isLoading={isSearching}
              isAdmin={isAdmin || isTester}
            />

            {/* Favorites filter for Pro/Ultra users and Selection mode toggle */}
            <div className="flex items-center gap-3">
              {/* Selection mode toggle */}
              <button
                onClick={() => {
                  if (isSelectionMode) {
                    handleClearSelection()
                  } else {
                    setIsSelectionMode(true)
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 ${
                  isSelectionMode
                    ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-400"
                    : "bg-white dark:bg-white/[0.02] border-zinc-200 dark:border-white/[0.06] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {isSelectionMode ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    Select Mode
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    Select
                  </>
                )}
              </button>

              {/* Favorites filter for Pro/Ultra users */}
              {isPremium && (
                <div className="flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
                  <button
                    onClick={() => setShowFavoritesOnly(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      !showFavoritesOnly
                        ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    All Jobs
                  </button>
                  <button
                    onClick={() => setShowFavoritesOnly(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      showFavoritesOnly
                        ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-rose-500 text-rose-500" : ""}`} />
                    Favorites
                    {favoriteIds.size > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        showFavoritesOnly
                          ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                          : "bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-400"
                      }`}>
                        {favoriteIds.size}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Generated CV Reminder Banner - REMOVED: Users don't need this reminder */}

      {/* 3-Column Kanban Board */}
      <div className="p-4 sm:p-6">
        {/* Upgrade Teaser - compact notification above columns */}
        {upgradeTeaser && upgradeTeaser.hidden_jobs_count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-4 max-w-[1600px] mx-auto"
          >
            <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-500/20 dark:to-blue-500/20 border border-cyan-300 dark:border-cyan-500/40 rounded-full shadow-sm">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-sm font-medium text-cyan-800 dark:text-cyan-300">
                  +{upgradeTeaser.hidden_jobs_count} more job{upgradeTeaser.hidden_jobs_count === 1 ? '' : 's'} found
                </span>
              </div>
              <button
                className="h-7 px-3 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-black dark:text-white rounded-full transition-all"
                onClick={() => router.push('/choose-plan')}
              >
                Upgrade to view
              </button>
              <button
                onClick={() => setUpgradeTeaser(null)}
                className="p-1 rounded-full hover:bg-cyan-200 dark:hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <motion.div
            className="flex gap-4 max-w-[1600px] mx-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                jobs={getColumnJobs(column.id)}
                count={getColumnJobs(column.id).length}
                isLoading={isLoading}
                onDiscardJob={promptDiscardJob}
                onFavoriteToggle={handleFavoriteToggle}
                onReviewSubmit={handleReviewSubmit}
                isSelectable={isSelectionMode}
                selectedJobIds={selectedJobIds}
                onSelectionChange={handleSelectionChange}
                onSelectAllInColumn={handleSelectAllInColumn}
              />
            ))}
          </motion.div>

          <DragOverlay>
            {activeJob ? (
              <div className="drag-overlay">
                <JobCard job={activeJob} isDragging isCompact={false} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Empty state */}
      {!isLoading && jobs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col items-center justify-center py-16 px-4"
        >
          {/* Metallic icon container */}
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-600 dark:from-zinc-600 dark:via-zinc-700 dark:to-zinc-800" />
            <div className="absolute inset-[1px] rounded-[14px] bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-400 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900" />
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <Briefcase className="w-8 h-8 text-zinc-600 dark:text-zinc-300" />
            </div>
          </div>
          {productionMode ? (
            <>
              <h2 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white">
                Finding your matches
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-6 text-sm">
                Your personalized job matches are being prepared. Check back soon!
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white">Start your job search</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-6 text-sm">
                Use the search bar to find jobs that match your skills.
                AI-powered matching helps you find the best opportunities.
              </p>
              <Button
                variant="metallic"
                className="gap-2"
                onClick={() => {
                  const searchInput = document.querySelector('input[placeholder*="Job title"]') as HTMLInputElement
                  searchInput?.focus()
                }}
              >
                <Search className="w-4 h-4" />
                Search Jobs
              </Button>
            </>
          )}
        </motion.div>
      )}

      {/* Discard confirmation dialog */}
      <AlertDialog open={!!jobToDiscard} onOpenChange={(open) => !open && setJobToDiscard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the job from your board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscardJob}
              className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedJobIds.size} jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedJobIds.size} selected job{selectedJobIds.size !== 1 ? 's' : ''} from your board. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20"
            >
              Delete {selectedJobIds.size} job{selectedJobIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
