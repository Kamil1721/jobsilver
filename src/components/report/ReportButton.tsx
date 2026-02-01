"use client"

import * as React from "react"
import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReportProblemDialog } from "./ReportProblemDialog"

interface ReportButtonProps {
  className?: string
}

export function ReportButton({ className }: ReportButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          // Position - fixed bottom-left (opposite of chat button)
          "fixed bottom-6 left-6 z-[74]",
          // Size and shape
          "flex h-10 w-10 items-center justify-center rounded-full",
          // Colors - subtle amber/yellow to indicate feedback
          "bg-gradient-to-br from-amber-500/90 to-orange-500/90 text-white",
          "hover:from-amber-500 hover:to-orange-500",
          // Shadow
          "shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30",
          // Focus ring
          "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-background",
          // Transition
          "transition-all duration-200 ease-out hover:scale-105",
          className
        )}
        aria-label="Report a problem or suggestion"
        title="Report a problem"
      >
        <Flag className="h-4 w-4" />
      </button>

      <ReportProblemDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  )
}
