"use client"

import * as React from "react"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { JobCard, JobCardSkeleton } from "./job-card"
import type { Job, JobStatus } from "@/lib/supabase/types"

// 3-column system status types
type ColumnStatus = "discovered" | "applied" | "offer"

interface KanbanColumnProps {
  id: ColumnStatus
  title: string
  jobs: Job[]
  count: number
  isLoading?: boolean
  onDiscardJob?: (jobId: string) => void
  onFavoriteToggle?: (jobId: string, favorited: boolean) => void
  onReviewSubmit?: (jobId: string) => void
  // Selection props for bulk actions
  isSelectable?: boolean
  selectedJobIds?: Set<string>
  onSelectionChange?: (jobId: string, selected: boolean) => void
  onSelectAllInColumn?: (jobIds: string[], selected: boolean) => void
  // Job limit warning (only for Free users in New Matches column)
  jobLimitWarning?: {
    show: boolean
    currentCount: number
    maxCount: number
    atLimit: boolean
  }
}

// Status colors for the 3-column system - metallic theme with subtle dots
const statusColors: Record<ColumnStatus, { dot: string; accent: string }> = {
  discovered: {
    dot: "bg-zinc-500 dark:bg-zinc-400",
    accent: "group-hover:border-zinc-400/30 dark:group-hover:border-white/[0.08]",
  },
  applied: {
    dot: "bg-zinc-600 dark:bg-zinc-300",
    accent: "group-hover:border-zinc-400/30 dark:group-hover:border-white/[0.08]",
  },
  offer: {
    dot: "bg-emerald-500 dark:bg-emerald-400",
    accent: "group-hover:border-emerald-500/30 dark:group-hover:border-emerald-500/20",
  },
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

export function KanbanColumn({
  id,
  title,
  jobs,
  count,
  isLoading,
  onDiscardJob,
  onFavoriteToggle,
  onReviewSubmit,
  isSelectable = false,
  selectedJobIds,
  onSelectionChange,
  onSelectAllInColumn,
  jobLimitWarning,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: "column",
      status: id,
    },
  })

  const colors = statusColors[id] || statusColors.discovered

  // Calculate selection state for this column
  const columnJobIds = jobs.map(j => j.id)
  const selectedInColumn = columnJobIds.filter(id => selectedJobIds?.has(id))
  const allSelected = columnJobIds.length > 0 && selectedInColumn.length === columnJobIds.length
  const someSelected = selectedInColumn.length > 0 && selectedInColumn.length < columnJobIds.length

  const handleSelectAll = (checked: boolean) => {
    onSelectAllInColumn?.(columnJobIds, checked)
  }

  return (
    <div
      className={cn(
        "group flex flex-col flex-1 min-w-[300px] rounded-xl border transition-all duration-200",
        "bg-white/50 dark:bg-white/[0.02] border-zinc-200 dark:border-white/[0.04]",
        "hover:border-zinc-300 dark:hover:border-white/[0.08]",
        isOver && "border-zinc-400 dark:border-white/[0.12] bg-zinc-50 dark:bg-white/[0.04]"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/[0.04]">
        <div className="flex items-center gap-2">
          {/* Select All checkbox */}
          {isSelectable && jobs.length > 0 && (
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (el as HTMLButtonElement).dataset.state = someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"
                }
              }}
              onCheckedChange={handleSelectAll}
              className="h-4 w-4"
              aria-label={`Select all jobs in ${title}`}
            />
          )}
          <div className={cn("w-2 h-2 rounded-full", colors.dot)} />
          <h3 className="text-xs font-semibold tracking-wider text-zinc-600 dark:text-zinc-400 uppercase">{title}</h3>
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-500 px-1.5 py-0.5 bg-zinc-100 dark:bg-white/[0.05] rounded">
          {count}
        </span>
      </div>

      {/* Job limit warning - only shown for Free users in New Matches column */}
      {id === "discovered" && jobLimitWarning?.show && (
        <div className={cn(
          "mx-2 mt-2 px-3 py-2 rounded-lg text-xs",
          jobLimitWarning.atLimit
            ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
            : "bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400"
        )}>
          <div className="flex items-start gap-2">
            <span className="mt-0.5">
              {jobLimitWarning.atLimit ? "⚠️" : "ℹ️"}
            </span>
            <div className="flex-1">
              <p className="font-medium">
                {jobLimitWarning.atLimit
                  ? `Limit reached: ${jobLimitWarning.maxCount} jobs`
                  : `${jobLimitWarning.currentCount}/${jobLimitWarning.maxCount} jobs`}
              </p>
              <p className="mt-0.5 opacity-80">
                {jobLimitWarning.atLimit
                  ? "Discard or move jobs to Applied to discover new ones."
                  : "Consider discarding jobs you're not interested in."}
              </p>
              <a
                href="/pricing"
                className="inline-block mt-1.5 text-xs font-medium underline hover:no-underline"
              >
                Upgrade for more →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Jobs list */}
      <ScrollArea className="flex-1">
        <motion.div
          ref={setNodeRef}
          className="px-2 py-2 min-h-[400px]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <SortableContext
            items={jobs.map((job) => job.id)}
            strategy={verticalListSortingStrategy}
          >
            {isLoading ? (
              <>
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </>
            ) : jobs.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    variants={itemVariants}
                    layout
                    layoutId={job.id}
                  >
                    <JobCard
                      job={job}
                      onDiscard={onDiscardJob}
                      onFavoriteToggle={onFavoriteToggle}
                      onReviewSubmit={onReviewSubmit}
                      isSelectable={isSelectable}
                      isSelected={selectedJobIds?.has(job.id) || false}
                      onSelectionChange={onSelectionChange}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-32 text-center px-4"
              >
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  No jobs yet
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                  {id === "discovered"
                    ? "Search to find new matches"
                    : id === "applied"
                    ? "Drag jobs here when you apply"
                    : "Move jobs here when you get an offer"}
                </p>
              </motion.div>
            )}
          </SortableContext>
        </motion.div>
      </ScrollArea>
    </div>
  )
}
