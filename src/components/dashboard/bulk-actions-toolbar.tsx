"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Trash2, MoveRight, X, CheckSquare } from "lucide-react"
import type { JobStatus } from "@/lib/supabase/types"

interface BulkActionsToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkDelete: () => Promise<void>
  onBulkStatusChange: (newStatus: JobStatus) => Promise<void>
  isProcessing: boolean
}

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkStatusChange,
  isProcessing,
}: BulkActionsToolbarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [selectedStatus, setSelectedStatus] = React.useState<JobStatus | "">("")

  const handleStatusChange = async (value: string) => {
    if (value && value !== "") {
      setSelectedStatus(value as JobStatus)
      await onBulkStatusChange(value as JobStatus)
      setSelectedStatus("")
    }
  }

  const handleDeleteConfirm = async () => {
    await onBulkDelete()
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 bg-card dark:bg-zinc-900 border border-border dark:border-white/[0.08] rounded-xl shadow-lg">
              {/* Selection count */}
              <div className="flex items-center gap-2 pr-3 border-r border-border dark:border-white/[0.08]">
                <CheckSquare className="w-4 h-4 text-[var(--coral)]" />
                <span className="text-sm font-medium text-foreground dark:text-zinc-300">
                  {selectedCount} selected
                </span>
              </div>

              {/* Move to status */}
              <Select
                value={selectedStatus}
                onValueChange={handleStatusChange}
                disabled={isProcessing}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <div className="flex items-center gap-2">
                    <MoveRight className="w-3.5 h-3.5" />
                    <SelectValue placeholder="Move to..." />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovered">New Matches</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="offer">Offers</SelectItem>
                </SelectContent>
              </Select>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isProcessing}
                className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete
              </Button>

              {/* Clear selection */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                disabled={isProcessing}
                className="h-8 w-8 p-0"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {selectedCount} jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete these jobs from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isProcessing}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {isProcessing ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
