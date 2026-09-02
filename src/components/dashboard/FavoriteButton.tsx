"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Heart, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSubscription } from "@/contexts/SubscriptionContext"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FavoriteButtonProps {
  jobId: string
  initialFavorited?: boolean
  onToggle?: (favorited: boolean) => void
  size?: "sm" | "md" | "lg"
  showTooltip?: boolean
  className?: string
}

const sizeConfig = {
  sm: {
    button: "h-6 w-6",
    icon: "w-3 h-3",
  },
  md: {
    button: "h-8 w-8",
    icon: "w-4 h-4",
  },
  lg: {
    button: "h-10 w-10",
    icon: "w-5 h-5",
  },
}

export function FavoriteButton({
  jobId,
  initialFavorited = false,
  onToggle,
  size = "md",
  showTooltip = true,
  className,
}: FavoriteButtonProps) {
  const { plan, isTester } = useSubscription()
  const { toast } = useToast()
  const [isFavorited, setIsFavorited] = React.useState(initialFavorited)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const isPremium = plan === "pro" || plan === "ultra" || plan === "mega" || isTester
  const config = sizeConfig[size]
  const lastClickRef = React.useRef<number>(0)
  const DEBOUNCE_MS = 500

  // Sync with initial state
  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setIsFavorited(initialFavorited)
    })
    return () => {
      cancelled = true
    }
  }, [initialFavorited])

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Debounce rapid clicks
    const now = Date.now()
    if (now - lastClickRef.current < DEBOUNCE_MS) return
    lastClickRef.current = now

    if (!isPremium || isLoading) return

    // Optimistic update
    const newState = !isFavorited
    setIsFavorited(newState)
    setIsAnimating(true)

    setIsLoading(true)

    try {
      const method = newState ? "POST" : "DELETE"
      const response = await fetch(`/api/jobs/${jobId}/favorite`, {
        method,
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        // Revert on error
        setIsFavorited(!newState)
        console.error("Failed to update favorite status")
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update favorite. Please try again.",
        })
      } else {
        onToggle?.(newState)
      }
    } catch (error) {
      // Revert on error
      setIsFavorited(!newState)
      console.error("Error toggling favorite:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Network error. Please check your connection.",
      })
    } finally {
      setIsLoading(false)
      setTimeout(() => setIsAnimating(false), 300)
    }
  }

  const ariaLabel = !isPremium
    ? "Upgrade to Pro to save favorites"
    : isFavorited
    ? "Remove from favorites"
    : "Add to favorites"

  const buttonContent = (
    <motion.button
      onClick={handleToggle}
      disabled={!isPremium || isLoading}
      aria-label={ariaLabel}
      title=""
      className={cn(
        "relative flex items-center justify-center rounded-lg transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        config.button,
        isPremium
          ? "hover:bg-accent dark:hover:bg-white/[0.05] cursor-pointer"
          : "cursor-not-allowed opacity-60",
        className
      )}
      whileTap={isPremium ? { scale: 0.9 } : undefined}
    >
      {/* Background glow effect when favorited */}
      <AnimatePresence>
        {isFavorited && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 rounded-lg bg-[var(--coral-soft)]"
          />
        )}
      </AnimatePresence>

      {/* Heart icon */}
      <motion.div
        animate={isAnimating ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative z-10"
      >
        {isPremium ? (
          <Heart
            aria-hidden="true"
            className={cn(
              config.icon,
              "transition-all duration-200",
              isFavorited
                ? "fill-[var(--coral)] text-[var(--coral)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          />
        ) : (
          <Lock aria-hidden="true" className={cn(config.icon, "text-muted-foreground")} />
        )}
      </motion.div>

      {/* Loading indicator */}
      {isLoading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}
    </motion.button>
  )

  if (!showTooltip) {
    return buttonContent
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span className="flex items-center gap-1.5">
            {!isPremium && <Lock className="w-3 h-3" />}
            {ariaLabel}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default FavoriteButton
