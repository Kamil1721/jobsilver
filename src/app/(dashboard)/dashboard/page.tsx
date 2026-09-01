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
import { motion, MotionConfig } from "framer-motion"
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
import { SearchBar, type SearchFilters } from "@/components/dashboard/search-bar"
import { KanbanColumn } from "@/components/dashboard/kanban-column"
import { JobCard } from "@/components/dashboard/job-card"
import {
  Briefcase,
  Search,
  Heart,
  X,
  CheckSquare,
  Square,
  Crown,
  CircleAlert,
  LoaderCircle,
  RefreshCcw,
} from "lucide-react"
import { useSubscription } from "@/contexts/SubscriptionContext"
import { QuotaDisplay } from "@/components/dashboard/quota-display"
import { BulkActionsToolbar } from "@/components/dashboard/bulk-actions-toolbar"
import type { Job, JobStatus, QuotaStatus } from "@/lib/supabase/types"
import { getPlanLimits } from "@/lib/stripe/plans"

interface UpgradeTeaser {
  hidden_jobs_count: number
  message: string
  total_found: number
  shown: number
}

function isUpgradeTeaser(value: unknown): value is UpgradeTeaser {
  if (!value || typeof value !== "object") return false

  const teaser = value as Record<string, unknown>
  return (
    typeof teaser.hidden_jobs_count === "number" &&
    typeof teaser.message === "string" &&
    typeof teaser.total_found === "number" &&
    typeof teaser.shown === "number"
  )
}

function getResponseErrorMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const message = value.trim()
    return message || null
  }

  if (value && typeof value === "object") {
    const message = (value as Record<string, unknown>).message
    if (typeof message === "string" && message.trim()) {
      return message.trim()
    }
  }

  return null
}

class JobSearchResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JobSearchResponseError"
  }
}

// 3-column system
type ColumnId = "discovered" | "applied" | "offer"

const EMPTY_SEARCH_FILTERS: SearchFilters = {
  keywords: "",
  location: "",
  remote: false,
  jobType: "all",
}

const SUPPORTED_JOB_TYPE_FILTERS = new Set([
  "all",
  "full-time",
  "part-time",
  "contract",
  "internship",
])

const columns: { id: ColumnId; title: string }[] = [
  { id: "discovered", title: "New matches" },
  { id: "applied", title: "Applied" },
  { id: "offer", title: "Offers" },
]

// Loading fallback for Suspense
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-border" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-muted-foreground animate-spin" />
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
  const [jobsLoadError, setJobsLoadError] = React.useState<string | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [activeJob, setActiveJob] = React.useState<Job | null>(null)
  const [jobToDiscard, setJobToDiscard] = React.useState<string | null>(null)
  const [quota, setQuota] = React.useState<QuotaStatus | null>(null)
  const [productionMode, setProductionMode] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false)
  const [isTester, setIsTester] = React.useState<boolean>(false)
  const [searchFilter, setSearchFilter] = React.useState<SearchFilters>(EMPTY_SEARCH_FILTERS)
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false)
  const [filtersInitialized, setFiltersInitialized] = React.useState(false)
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set())
  // Selection state for bulk actions
  const [isSelectionMode, setIsSelectionMode] = React.useState(false)
  const [selectedJobIds, setSelectedJobIds] = React.useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = React.useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
  const [upgradeTeaser, setUpgradeTeaser] = React.useState<UpgradeTeaser | null>(null)
  // Job limit warning for Free users (shown in New Matches column)
  // Track pending drag updates to prevent race conditions
  const pendingDragUpdates = React.useRef<Set<string>>(new Set())
  const syncingFiltersFromUrl = React.useRef(false)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = React.useMemo(() => createClient(), [])
  const { plan, isTester: subscriptionIsTester } = useSubscription()
  // Check for premium plans (current 'pro'/'ultra' + legacy 'mega' for backwards compatibility) or tester status
  const isPremium = plan === "pro" || plan === "ultra" || (plan as string) === "mega" || subscriptionIsTester || isTester
  const readCurrentFilters = React.useEffectEvent(() => ({
    searchFilter,
    showFavoritesOnly,
  }))

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

  // Keep visible filter controls and the filtered board in sync with URL changes.
  React.useEffect(() => {
    let cancelled = false
    const keywords = searchParams.get("keywords") || ""
    const location = searchParams.get("location") || ""
    const remote = searchParams.get("remote") === "true"
    const requestedJobType = searchParams.get("jobType") || "all"
    const jobType = SUPPORTED_JOB_TYPE_FILTERS.has(requestedJobType)
      ? requestedJobType
      : "all"
    const favorites = searchParams.get("favorites") === "true"

    const canonicalParams = new URLSearchParams(searchParams.toString())
    if (keywords) canonicalParams.set("keywords", keywords)
    else canonicalParams.delete("keywords")
    if (location) canonicalParams.set("location", location)
    else canonicalParams.delete("location")
    if (remote) canonicalParams.set("remote", "true")
    else canonicalParams.delete("remote")
    if (jobType !== "all") canonicalParams.set("jobType", jobType)
    else canonicalParams.delete("jobType")
    if (favorites) canonicalParams.set("favorites", "true")
    else canonicalParams.delete("favorites")

    if (canonicalParams.toString() !== searchParams.toString()) {
      const canonicalQuery = canonicalParams.toString()
      router.replace(canonicalQuery ? `/dashboard?${canonicalQuery}` : "/dashboard", {
        scroll: false,
      })
    }

    const {
      searchFilter: currentFilters,
      showFavoritesOnly: currentShowFavoritesOnly,
    } = readCurrentFilters()
    const filtersChanged =
      currentFilters.keywords !== keywords ||
      currentFilters.location !== location ||
      currentFilters.remote !== remote ||
      currentFilters.jobType !== jobType
    const favoritesChanged = currentShowFavoritesOnly !== favorites

    queueMicrotask(() => {
      if (cancelled) return

      if (filtersChanged || favoritesChanged) {
        syncingFiltersFromUrl.current = true
      }

      setSearchFilter((current) =>
        current.keywords === keywords &&
        current.location === location &&
        current.remote === remote &&
        current.jobType === jobType
          ? current
          : { keywords, location, remote, jobType }
      )
      setShowFavoritesOnly((current) => (current === favorites ? current : favorites))
      setFiltersInitialized(true)
    })

    return () => {
      cancelled = true
    }
  }, [searchParams, router])

  // Sync filter state to URL params (only after initialization)
  React.useEffect(() => {
    if (!filtersInitialized) return

    if (syncingFiltersFromUrl.current) {
      syncingFiltersFromUrl.current = false
      return
    }

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

  const loadJobs = React.useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setJobsLoadError(null)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("Your session could not be verified.")
      }

      // Fetch profile data including upgrade teaser
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("production_mode, is_admin, is_tester, upgrade_teaser, subscription_plan")
        .eq("id", user.id)
        .maybeSingle()

      // Profile flags control privileged UI, so fail closed if this optional
      // companion read is unavailable while still allowing the jobs board to load.
      if (profileError) {
        setProductionMode(false)
        setIsAdmin(false)
        setIsTester(false)
        setUpgradeTeaser(null)
      }

      if (profile) {
        setProductionMode(profile.production_mode || false)
        setIsAdmin(profile.is_admin === true)
        setIsTester(profile.is_tester === true)

        // Set upgrade teaser from profile (for free users)
        if (isUpgradeTeaser(profile.upgrade_teaser) && profile.subscription_plan === 'free') {
          setUpgradeTeaser(profile.upgrade_teaser)
        } else {
          setUpgradeTeaser(null)
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
        throw new Error(error.message)
      }

      // Map old statuses to new 3-column system
      const mappedJobs = (allJobs || []).map(job => {
        let newStatus = job.status
        // Map old statuses: saved -> discovered, interviewing -> applied
        if (job.status === "saved") newStatus = "discovered"
        if (job.status === "interviewing") newStatus = "applied"
        return { ...job, status: newStatus }
      })

      setJobs(mappedJobs)

      // Fetch favorite IDs for premium users and testers
      const userPlan = profile?.subscription_plan || 'free'
      const userIsTester = profile?.is_tester
      // Note: Job limit warning is calculated in useEffect when jobs/plan change
      if (userPlan === 'pro' || userPlan === 'ultra' || userPlan === 'mega' || userIsTester) {
        try {
          const favResponse = await fetch('/api/jobs/favorites')
          if (favResponse.ok) {
            const favData = await favResponse.json()
            setFavoriteIds(new Set(favData.favoriteIds || []))
          }
        } catch {
          // Silently fail - not critical
        }
      }

    } catch (error) {
      const message = "We couldn't load your job board. Check your connection and try again."
      setJobsLoadError(message)
      toast({
        variant: "destructive",
        title: "Job board unavailable",
        description: message,
      })
      console.error("Job board load error:", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast])

  // Fetch user's jobs on mount.
  React.useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) void loadJobs()
    })

    return () => {
      cancelled = true
    }
  }, [loadJobs])

  // Recalculate job limit warning when jobs change (for Free users only)
  const jobLimitWarning = React.useMemo(() => {
    if (plan !== 'free' || isTester || subscriptionIsTester) {
      return null
    }

    const discoveredCount = jobs.filter(j => j.status === 'discovered').length
    const limits = getPlanLimits('free')
    const maxJobs = limits.savedJobs // 50 for free

    if (discoveredCount >= maxJobs * 0.9) {
      return {
        currentCount: discoveredCount,
        maxCount: maxJobs,
        atLimit: discoveredCount >= maxJobs,
      }
    }

    return null
  }, [jobs, plan, isTester, subscriptionIsTester])

  // Search for new jobs
  const handleSearch = async (filters: SearchFilters) => {
    setIsSearching(true)
    setSearchError(null)

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
          setSearchError("You've reached today's search limit. Your quota resets at midnight UTC.")
          toast({
            variant: "destructive",
            title: "Daily quota exceeded",
            description: `You've used all ${data.quota.limit} jobs for today. Quota resets at midnight UTC.`,
          })
          return
        }
        if (data.redirect_to_setup) {
          setSearchError("Your search preferences need attention before we can find matches.")
          toast({
            variant: "destructive",
            title: "Setup Required",
            description: data.validation_errors?.map((e: { message: string }) => e.message).join(". ") || "Please complete your job preferences setup.",
          })
          setTimeout(() => {
            router.push("/setup?edit=true")
          }, 2000)
          return
        }
        throw new JobSearchResponseError(
          getResponseErrorMessage(data.error) || "Search failed"
        )
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
      await loadJobs(false)
    } catch (error) {
      const message = error instanceof JobSearchResponseError
        ? error.message
        : "We couldn't search for matches. Check your connection and try again."
      setSearchError(message)
      toast({
        variant: "destructive",
        title: "Search failed",
        description: message,
      })
      console.error("Job search error:", error instanceof Error ? error.message : "Unknown error")
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
    } catch {
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
    } catch {
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

  // Count only favorites that exist in current job list (some may have been discarded)
  const actualFavoritesCount = React.useMemo(() => {
    const jobIds = new Set(jobs.map(j => j.id))
    return Array.from(favoriteIds).filter(id => jobIds.has(id)).length
  }, [jobs, favoriteIds])

  // Calculate stats
  const stats = {
    newMatches: getColumnJobs("discovered").length,
    applied: getColumnJobs("applied").length,
    offers: getColumnJobs("offer").length,
  }
  const hasActiveSearchFilters = Boolean(
    searchFilter.keywords ||
    searchFilter.location ||
    searchFilter.remote ||
    searchFilter.jobType !== "all" ||
    showFavoritesOnly
  )
  const showUrlFilterNotice =
    (!(isAdmin || isTester) && hasActiveSearchFilters) ||
    (showFavoritesOnly && !isPremium)

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-[calc(100vh-3.5rem)] bg-background dark:bg-[#0a0a0b]">
      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedJobIds.size}
        onClearSelection={handleClearSelection}
        onBulkDelete={handleBulkDelete}
        onBulkStatusChange={handleBulkStatusChange}
        isProcessing={isBulkProcessing}
      />

      <div className="border-b border-border bg-[var(--dawn-bg)] dark:border-white/[0.04] dark:bg-[#0a0a0b]/50">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-6">
            {/* Header row */}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--coral-lo)]">Today&apos;s search</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground dark:text-white sm:text-3xl">Your morning shortlist</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-zinc-400 sm:text-base">
                  Start with your newest matches, prepare the strongest applications, and keep every outcome in view.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--coral)]" />
                  <span className="text-sm font-semibold text-foreground">{stats.newMatches} new matches</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 dark:bg-white/[0.03] dark:border-white/[0.06]">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground dark:bg-zinc-400" />
                  <span className="text-sm font-medium text-foreground dark:text-zinc-300">{stats.applied} applied</span>
                </div>
                {stats.offers > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{stats.offers} offers</span>
                  </div>
                )}
                {quota && <QuotaDisplay quota={quota} />}
              </div>
            </div>

            {/* Search bar - only visible for admins and testers (regular users get daily curated jobs) */}
            {(isAdmin || isTester) && (
              <SearchBar
                filters={searchFilter}
                onSearch={handleSearch}
                onFilterChange={setSearchFilter}
                isLoading={isSearching}
                isAdmin={isAdmin || isTester}
              />
            )}

            {showUrlFilterNotice && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dawn-line-2)] bg-[var(--dawn-cream)] px-4 py-3 text-sm text-[var(--dawn-ink-2)]"
              >
                <span>Filters from this URL are active.</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter(EMPTY_SEARCH_FILTERS)
                    setShowFavoritesOnly(false)
                  }}
                  className="rounded-md font-semibold text-[var(--coral-lo)] underline decoration-[var(--coral)]/40 underline-offset-4 hover:decoration-[var(--coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Favorites filter for Pro/Ultra users and Selection mode toggle */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Selection mode toggle */}
              <button
                type="button"
                onClick={() => {
                  if (isSelectionMode) {
                    handleClearSelection()
                  } else {
                    setIsSelectionMode(true)
                  }
                }}
                aria-pressed={isSelectionMode}
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-all duration-200 ${
                  isSelectionMode
                    ? "bg-[var(--coral-soft)] border-[var(--coral-soft)] text-[var(--coral-lo)]"
                    : "bg-card dark:bg-white/[0.02] border-border dark:border-white/[0.06] text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {isSelectionMode ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    Finish selecting
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
                <div role="group" aria-label="Job list filter" className="flex h-9 items-center overflow-hidden rounded-lg border border-border bg-card dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly(false)}
                    aria-pressed={!showFavoritesOnly}
                    className={`flex h-full items-center gap-1.5 px-3 text-sm font-medium transition-all duration-200 ${
                      !showFavoritesOnly
                        ? "bg-accent dark:bg-white/[0.08] text-foreground dark:text-white"
                        : "text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    All jobs
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly(true)}
                    aria-pressed={showFavoritesOnly}
                    className={`flex h-full items-center gap-1.5 px-3 text-sm font-medium transition-all duration-200 ${
                      showFavoritesOnly
                        ? "bg-[var(--coral-soft)] text-[var(--coral-lo)]"
                        : "text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-[var(--coral)] text-[var(--coral)]" : ""}`} />
                    Favorites
                    {actualFavoritesCount > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                        showFavoritesOnly
                          ? "bg-[var(--coral)] text-[var(--coral-ink)]"
                          : "bg-accent dark:bg-white/[0.08] text-muted-foreground dark:text-zinc-400"
                      }`}>
                        {actualFavoritesCount}
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

      {jobsLoadError ? (
        <div className="mx-auto flex min-h-[28rem] max-w-[1600px] items-center px-4 py-12 sm:px-6">
          <div
            role="alert"
            className="mx-auto w-full max-w-xl rounded-[20px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-8 text-center shadow-[0_18px_50px_-32px_rgba(31,27,24,0.24)]"
          >
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--coral-soft)] text-[var(--coral-lo)]">
              <CircleAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-[var(--dawn-ink)]">
              Your job board is temporarily unavailable
            </h2>
            <p className="mx-auto mt-3 max-w-[48ch] text-sm leading-6 text-[var(--dawn-ink-2)]">
              {jobsLoadError}
            </p>
            <Button
              type="button"
              className="mt-6 rounded-full bg-[var(--coral)] px-6 text-[var(--coral-ink)] hover:bg-[var(--coral-hi)] motion-reduce:transition-none"
              onClick={() => void loadJobs()}
            >
              <RefreshCcw aria-hidden="true" />
              Retry loading
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 3-Column Kanban Board */}
          <div className="px-4 py-5 sm:px-6 sm:py-6">
        {/* Upgrade Teaser - only show to Free users (Pro/Ultra don't see "more jobs" teaser) */}
        {upgradeTeaser && upgradeTeaser.hidden_jobs_count > 0 && plan === "free" && !isPremium && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-4 max-w-[1600px] mx-auto"
          >
            <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-[var(--coral-soft)] border border-[var(--coral-soft)] rounded-full shadow-sm">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[var(--coral-lo)]" />
                <span className="text-sm font-medium text-[var(--coral-lo)]">
                  +{upgradeTeaser.hidden_jobs_count} more job{upgradeTeaser.hidden_jobs_count === 1 ? '' : 's'} found
                </span>
              </div>
              <button
                className="h-7 px-3 text-xs font-semibold bg-[var(--coral)] hover:bg-[var(--coral-hi)] text-[var(--coral-ink)] rounded-full transition-all"
                onClick={() => router.push('/choose-plan')}
              >
                Upgrade to view
              </button>
              <button
                onClick={() => setUpgradeTeaser(null)}
                className="p-1 rounded-full hover:bg-[var(--coral-soft)] text-[var(--coral-lo)] transition-colors"
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
            className="mx-auto flex max-w-[1600px] snap-x snap-mandatory gap-4 overflow-x-auto pb-3 lg:overflow-visible"
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
                isSelectable={isSelectionMode}
                selectedJobIds={selectedJobIds}
                onSelectionChange={handleSelectionChange}
                onSelectAllInColumn={handleSelectAllInColumn}
                jobLimitWarning={column.id === "discovered" ? jobLimitWarning ?? undefined : undefined}
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
              className="mx-auto flex max-w-[1600px] flex-col items-center justify-center px-4 py-16 text-center sm:py-20"
            >
              <div className="w-full max-w-xl rounded-[24px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] px-6 py-10 shadow-[0_18px_50px_-32px_rgba(31,27,24,0.24)] sm:px-10 sm:py-12">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--coral-soft)] text-[var(--coral-lo)]">
                  <Briefcase className="h-6 w-6" aria-hidden="true" />
                </div>
                {!(isAdmin || isTester) ? (
            <>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--coral-lo)]">
                Your first shortlist
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--dawn-ink)]">
                {productionMode ? "Your matches are still on their way" : "Let’s find your first matches"}
              </h2>
              <p className="mx-auto mt-3 max-w-[48ch] text-sm leading-6 text-[var(--dawn-ink-2)]">
                We’ll search with the preferences you saved during setup and add any new matches directly to this board.
              </p>
              {searchError && (
                <p role="alert" className="mx-auto mt-4 max-w-[48ch] rounded-xl bg-[var(--coral-soft)] px-4 py-3 text-sm text-[var(--coral-lo)]">
                  {searchError}
                </p>
              )}
              <Button
                type="button"
                disabled={isSearching}
                className="mt-6 min-h-11 rounded-full bg-[var(--coral)] px-6 text-[var(--coral-ink)] hover:bg-[var(--coral-hi)] motion-reduce:transition-none"
                onClick={() => void handleSearch(EMPTY_SEARCH_FILTERS)}
              >
                {isSearching ? (
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Search aria-hidden="true" />
                )}
                {isSearching ? "Finding matches…" : "Find my matches"}
              </Button>
              <span className="sr-only" aria-live="polite">
                {isSearching ? "Searching for matches" : ""}
              </span>
            </>
                ) : (
            <>
              <h2 className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-[var(--dawn-ink)]">Start your job search</h2>
              <p className="mx-auto mt-3 max-w-[48ch] text-sm leading-6 text-[var(--dawn-ink-2)]">
                Use the search tools above to find and test matching roles.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-6 rounded-full border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] px-6 text-[var(--dawn-ink)] hover:border-[var(--coral)] hover:bg-[var(--coral-soft)] motion-reduce:transition-none"
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
              </div>
            </motion.div>
          )}
        </>
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
    </MotionConfig>
  )
}
