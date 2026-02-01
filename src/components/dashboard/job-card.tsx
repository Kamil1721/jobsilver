"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  MapPin,
  X,
  GripVertical,
  CheckCircle2,
  Clock,
} from "lucide-react"
import type { Job } from "@/lib/supabase/types"
import { PreferenceMatch } from "./PreferenceMatch"
import { useSubscription } from "@/contexts/SubscriptionContext"

interface JobCardProps {
  job: Job
  onDiscard?: (jobId: string) => void
  onFavoriteToggle?: (jobId: string, favorited: boolean) => void
  onReviewSubmit?: (jobId: string) => void
  onAIHelp?: (jobId: string) => void
  onCoverLetter?: (jobId: string) => void
  onMatchAnalysis?: (jobId: string) => void
  isDragging?: boolean
  isCompact?: boolean
  preferenceReasons?: string[]
  preferenceScore?: number
  // Selection props for bulk actions
  isSelectable?: boolean
  isSelected?: boolean
  onSelectionChange?: (jobId: string, selected: boolean) => void
}

// Compact single-line job item for Linear-style columns
export function JobCard({
  job,
  onDiscard,
  onFavoriteToggle,
  onReviewSubmit,
  onAIHelp,
  onCoverLetter,
  onMatchAnalysis,
  isDragging,
  isCompact = true,
  preferenceReasons,
  preferenceScore,
  isSelectable = false,
  isSelected = false,
  onSelectionChange,
}: JobCardProps) {
  const router = useRouter()
  const { plan } = useSubscription()
  const isPremium = plan === "pro" || plan === "ultra" || plan === "mega"
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: job.id,
    data: {
      type: "job",
      job,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Format job type (Full-time -> FT, Part-time -> PT, etc.)
  const formatJobType = (jobType: string | null) => {
    if (!jobType) return null
    const typeMap: Record<string, string> = {
      "full-time": "FT",
      "fulltime": "FT",
      "full time": "FT",
      "part-time": "PT",
      "parttime": "PT",
      "part time": "PT",
      "contract": "Contract",
      "freelance": "Freelance",
      "internship": "Intern",
      "temporary": "Temp",
    }
    const normalized = jobType.toLowerCase()
    return typeMap[normalized] || jobType
  }

  // Format work location (Remote, Hybrid, On-site)
  const formatWorkLocation = (location: string | null) => {
    if (!location) return null
    const loc = location.toLowerCase()
    if (loc.includes("remote")) return "Remote"
    if (loc.includes("hybrid")) return "Hybrid"
    if (loc.includes("on-site") || loc.includes("onsite")) return "On-site"
    // Return abbreviated location if it's a city
    if (location.length > 20) {
      return location.split(",")[0].trim()
    }
    return location
  }

  // Handle clicking on the job item
  const handleClick = () => {
    router.push(`/jobs/${job.id}`)
  }

  // Check if job was applied or has offer (hide action buttons for these)
  const isApplied = job.status === "applied"
  const isAppliedOrOffer = job.status === "applied" || job.status === "offer"

  // Format applied date
  const formatAppliedDate = (date: string | null) => {
    if (!date) return null
    const d = new Date(date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Compact single-line view - no avatar, all info on one line
  if (isCompact) {
    return (
      <motion.div
        ref={setNodeRef}
        style={style}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        layout
        className={cn(
          "group relative",
          isDragging && "opacity-60 z-50",
          isSelected && "ring-2 ring-cyan-500/50 rounded-lg"
        )}
      >
        <div
          onClick={handleClick}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer",
            "border border-transparent",
            "hover:border-zinc-300 dark:hover:border-white/[0.08] hover:bg-zinc-50 dark:hover:bg-white/[0.03]",
            isDragging && "bg-zinc-100 dark:bg-white/[0.05] border-zinc-300 dark:border-white/[0.10]",
            isSelected && "bg-cyan-50 dark:bg-cyan-500/5 border-cyan-200 dark:border-cyan-500/20"
          )}
        >
          {/* Checkbox for selection */}
          {isSelectable && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange?.(job.id, checked as boolean)}
                className="h-4 w-4"
              />
            </div>
          )}

          {/* Drag handle - appears on hover */}
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "transition-opacity duration-200 cursor-grab active:cursor-grabbing flex-shrink-0",
              isSelectable ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <GripVertical className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          </div>

          {/* Job info - three lines: company, title, details */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {/* Company name - prominent */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                {job.company || "Unknown"}
              </span>
              {/* Applied badge */}
              {isApplied && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Applied
                </span>
              )}
            </div>
            {/* Job title - truncated with ellipsis if too long */}
            <div
              className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 truncate max-w-[280px]"
              title={job.title || ''} // Show full title on hover
            >
              {job.title}
            </div>
            {/* Work location + job type + applied info */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
              {formatWorkLocation(job.location) && (
                <span className="flex-shrink-0">{formatWorkLocation(job.location)}</span>
              )}
              {formatWorkLocation(job.location) && formatJobType(job.job_type) && (
                <span className="text-zinc-400 dark:text-zinc-600 flex-shrink-0">·</span>
              )}
              {formatJobType(job.job_type) && (
                <span className="flex-shrink-0">{formatJobType(job.job_type)}</span>
              )}
              {/* Applied date */}
              {isApplied && job.applied_at && (
                <>
                  <span className="text-zinc-400 dark:text-zinc-600 flex-shrink-0">·</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Clock className="w-2.5 h-2.5" />
                    {formatAppliedDate(job.applied_at)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Preference match indicator for Pro/Ultra */}
          {isPremium && preferenceScore !== undefined && preferenceScore > 0 && (
            <PreferenceMatch
              reasons={preferenceReasons || []}
              score={preferenceScore}
              size="sm"
            />
          )}

          {/* Discard button - appears on hover */}
          {onDiscard && !isAppliedOrOffer && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onDiscard(job.id)
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

      </motion.div>
    )
  }

  // Full card view (for drag overlay)
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/[0.06] rounded-lg",
        isDragging && "shadow-lg scale-[1.02]"
      )}
    >
      <div className="font-medium text-sm text-zinc-900 dark:text-white truncate">{job.company || "Unknown"}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-[280px]" title={job.title || ''}>{job.title}</div>
    </motion.div>
  )
}

// Skeleton loader for job items
export function JobCardSkeleton() {
  return (
    <div className="px-3 py-2.5">
      <div className="h-4 w-28 bg-zinc-200 dark:bg-white/[0.05] rounded animate-pulse" />
      <div className="flex items-center gap-2 mt-1">
        <div className="h-3 w-40 bg-zinc-200 dark:bg-white/[0.05] rounded animate-pulse" />
        <div className="h-3 w-12 bg-zinc-200 dark:bg-white/[0.05] rounded animate-pulse" />
      </div>
    </div>
  )
}
