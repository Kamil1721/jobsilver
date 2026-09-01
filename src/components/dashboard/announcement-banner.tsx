"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActiveAnnouncement, AnnouncementType, SubscriptionPlan } from "@/lib/supabase/types"

interface AnnouncementBannerProps {
  plan: SubscriptionPlan
}

const DISMISSED_KEY = 'dismissed_announcements_v2'

// Stored format: { [id]: dismissed_at_timestamp }
type DismissedRecord = Record<string, string>

// Get type-based styles
function getTypeStyles(type: AnnouncementType): string {
  switch (type) {
    case 'info':
      return 'bg-muted text-foreground border-border'
    case 'warning':
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
    case 'promo':
      return 'bg-[var(--coral-soft)] text-[var(--coral)] border-[var(--coral)]/20'
    case 'maintenance':
      return 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
    default:
      return 'bg-muted text-foreground border-border'
  }
}

export function AnnouncementBanner({ plan }: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = React.useState<ActiveAnnouncement[]>([])
  const [dismissedRecord, setDismissedRecord] = React.useState<DismissedRecord>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(DISMISSED_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return {}
  })
  const [isLoading, setIsLoading] = React.useState(true)

  // Fetch active announcements
  React.useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(`/api/announcements/active?plan=${plan}`)
        if (res.ok) {
          const data = await res.json()
          setAnnouncements(data.announcements || [])
        }
      } catch (error) {
        console.error('Failed to fetch announcements:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnnouncements()
  }, [plan])

  // Dismiss an announcement - stores the announcement's updated_at timestamp
  const dismissAnnouncement = (announcement: ActiveAnnouncement) => {
    const newRecord = {
      ...dismissedRecord,
      [announcement.id]: announcement.updated_at,
    }
    setDismissedRecord(newRecord)

    // Persist to localStorage
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(newRecord))
    } catch {
      // Ignore localStorage errors
    }
  }

  // Check if an announcement is dismissed
  // It's only considered dismissed if it hasn't been updated since dismissal
  const isDismissed = (announcement: ActiveAnnouncement): boolean => {
    const dismissedAt = dismissedRecord[announcement.id]
    if (!dismissedAt) return false

    // If the announcement was updated after it was dismissed, show it again
    return new Date(announcement.updated_at) <= new Date(dismissedAt)
  }

  // Filter out dismissed announcements and get the highest priority one
  const visibleAnnouncements = announcements.filter(a => !isDismissed(a))
  const currentAnnouncement = visibleAnnouncements[0] // Already sorted by priority from API

  // Don't render anything while loading or if no announcements
  if (isLoading || !currentAnnouncement) {
    return null
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-3xl items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-medium sm:px-4 sm:text-base",
        getTypeStyles(currentAnnouncement.type)
      )}
    >
      {/* Scrolling area - takes available space */}
      <div className="flex-1 overflow-hidden">
        <span className="inline-block whitespace-nowrap animate-marquee motion-reduce:block motion-reduce:whitespace-normal motion-reduce:animate-none">
          {currentAnnouncement.message}
        </span>
      </div>

      {/* Dismiss button - always visible on the right */}
      <button
        type="button"
        onClick={() => dismissAnnouncement(currentAnnouncement)}
        className="shrink-0 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
