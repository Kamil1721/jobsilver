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
import type { Job } from "@/lib/supabase/types"

// 3-column system status types
type ColumnStatus = "discovered" | "applied" | "offer"

interface KanbanColumnProps {
  id: ColumnStatus
  title: string
  jobs: Job[]
  count: number
  isLoading?: boolean
  onDiscardJob?: (jobId: string) => void
  // Selection props for bulk actions
  isSelectable?: boolean
  selectedJobIds?: Set<string>
  onSelectionChange?: (jobId: string, selected: boolean) => void
  onSelectAllInColumn?: (jobIds: string[], selected: boolean) => void
  // Job limit warning (only for Free users in New Matches column)
  jobLimitWarning?: {
    currentCount: number
    maxCount: number
    atLimit: boolean
  }
}

// Status dot colors for the 3-column system
const statusColors: Record<ColumnStatus, string> = {
  discovered: "bg-[hsl(var(--status-new))]",
  applied: "bg-[hsl(var(--status-applied))]",
  offer: "bg-[hsl(var(--status-offer))]",
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

  const dotColor = statusColors[id]

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
        "group flex min-w-[calc(100vw-2rem)] snap-start flex-col rounded-2xl border transition-all duration-200 sm:min-w-[320px] lg:min-w-0",
        "bg-card/60 dark:bg-white/[0.02] border-border dark:border-white/[0.04]",
        "hover:border-border dark:hover:border-white/[0.08]",
        id === "discovered"
          ? "lg:flex-[1.2] border-[var(--coral)]/30 bg-card shadow-[0_16px_40px_-32px_rgba(201,68,37,0.55)]"
          : "lg:flex-1",
        isOver && "border-[var(--coral)] dark:border-white/[0.12] bg-muted dark:bg-white/[0.04]"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-white/[0.04]">
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
          <div className={cn("w-2 h-2 rounded-full", dotColor)} />
          <h3 className={cn("text-sm font-semibold", id === "discovered" ? "text-foreground" : "text-muted-foreground dark:text-zinc-400")}>{title}</h3>
        </div>
        <span className="text-xs font-medium tabular-nums text-center min-w-[1.5rem] text-muted-foreground dark:text-zinc-500 px-1.5 py-0.5 bg-muted dark:bg-white/[0.05] rounded-md">
          {count}
        </span>
      </div>

      {/* Job limit warning - only shown for Free users in New Matches column */}
      {id === "discovered" && jobLimitWarning && (
        <div className={cn(
          "mx-2 mt-2 px-3 py-2 rounded-lg text-xs",
          jobLimitWarning.atLimit
            ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
            : "bg-[var(--coral-soft)] border border-[var(--coral)]/20 text-[var(--coral)]"
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
                      isSelectable={isSelectable}
                      isSelected={selectedJobIds?.has(job.id) || false}
                      onSelectionChange={onSelectionChange}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-40 text-center px-6"
              >
                <div
                  aria-hidden
                  className="w-9 h-9 rounded-full border border-dashed border-border dark:border-white/[0.10] mb-3"
                />
                <p className="text-sm font-medium text-foreground dark:text-zinc-400">
                  {id === "discovered"
                    ? "Nothing new yet"
                    : id === "applied"
                    ? "No applications yet"
                    : "No offers yet"}
                </p>
                <p className="text-xs text-muted-foreground dark:text-zinc-600 mt-1 max-w-[190px] leading-relaxed">
                  {id === "discovered"
                    ? "Run a search and fresh matches will land here."
                    : id === "applied"
                    ? "Drag a job across once you've applied."
                    : "Move a job here when an offer comes in."}
                </p>
              </motion.div>
            )}
          </SortableContext>
        </motion.div>
      </ScrollArea>
    </div>
  )
}
