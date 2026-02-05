"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { useTheme } from "@/lib/contexts/theme-context"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  LayoutDashboard,
  User,
  LogOut,
  Shield,
  AlertTriangle,
  X,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import type { Profile, AllSubscriptionPlans } from "@/lib/supabase/types"
import { ChatProvider } from "@/components/chat"
import { clearChatState } from "@/hooks/use-chat"
import { clearToastState } from "@/hooks/use-toast"
import { ReportButton } from "@/components/report"
import { SubscriptionProvider } from "@/contexts/SubscriptionContext"
import { UpgradeModal } from "@/components/upgrade-modal"
import { TesterBadge } from "@/components/dashboard/TesterBadge"
import { AnnouncementBanner } from "@/components/dashboard/announcement-banner"
import { getPlanLimits } from "@/lib/stripe/plans"
import { PublicFooter } from "@/components/public-footer"

// System message types
interface SystemMessage {
  id: string
  type: 'warning' | 'info' | 'error'
  message: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  dismissible?: boolean
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [userEmail, setUserEmail] = React.useState<string>("")
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false)
  const [isTester, setIsTester] = React.useState<boolean>(false)
  const [activeJobsCount, setActiveJobsCount] = React.useState<number>(0)
  const [systemMessages, setSystemMessages] = React.useState<SystemMessage[]>([])
  const [dismissedMessages, setDismissedMessages] = React.useState<Set<string>>(new Set())
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Track current user ID to detect account switches
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)

  // Fetch active jobs count and check against limit
  const checkJobLimitAndUpdateMessages = React.useCallback(async (userProfile: Profile | null) => {
    if (!userProfile) return

    try {
      // Count active jobs (only discovered = NEW MATCHES column)
      // Jobs in APPLIED or OFFERS don't count toward the limit
      const { count, error } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)
        .eq('status', 'discovered')

      if (error) {
        console.error('Error fetching active jobs count:', error)
        return
      }

      const activeCount = count || 0
      setActiveJobsCount(activeCount)

      // Get plan limits
      const plan = (userProfile.subscription_plan || 'free') as AllSubscriptionPlans
      const limits = getPlanLimits(plan)
      const maxActiveJobs = limits.savedJobs

      // Job limit warnings are now shown ONLY for Free users and INSIDE the New Matches column
      // (handled by dashboard/page.tsx), not in the top banner
      // The banner is reserved for announcements only
      const newMessages: SystemMessage[] = []

      setSystemMessages(newMessages)
    } catch (err) {
      console.error('Error checking job limit:', err)
    }
  }, [supabase])

  React.useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        setUserEmail(user.email || "")
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
        if (data) {
          setProfile(data)
          // Admin status is determined by the is_admin flag in the database
          // The database flag is set based on ADMIN_EMAILS environment variable
          // via migration or admin API
          setIsAdmin(data.is_admin === true)
          // Tester status - testers get premium features but NOT admin access
          setIsTester(data.is_tester === true)
          // Check job limits
          checkJobLimitAndUpdateMessages(data)
        }
      }
    }
    fetchProfile()

    // Listen for auth state changes to detect account switches
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // If user ID changed, force a full page refresh to clear all cached state
        if (currentUserId && currentUserId !== session.user.id) {
          console.log('[Auth] User changed, refreshing page to clear state')
          window.location.reload()
        }
      } else if (event === 'SIGNED_OUT') {
        // On sign out, clear all user-specific state to prevent data leakage
        clearChatState() // Clear chat messages, job context, pending questions
        clearToastState() // Clear any pending toast notifications
        setCurrentUserId(null)
        setProfile(null)
        setUserEmail("")
        setIsAdmin(false)
        setIsTester(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, currentUserId, checkJobLimitAndUpdateMessages])

  // Re-check job limit when returning to dashboard or when jobs might have changed
  React.useEffect(() => {
    if (profile && pathname === '/dashboard') {
      checkJobLimitAndUpdateMessages(profile)
    }
  }, [pathname, profile, checkJobLimitAndUpdateMessages])

  // Subscribe to job changes to update count in real-time
  React.useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel('job-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          // Re-check job limit when jobs change
          checkJobLimitAndUpdateMessages(profile)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile, checkJobLimitAndUpdateMessages])

  const dismissMessage = (messageId: string) => {
    setDismissedMessages(prev => {
      const newSet = new Set(prev)
      newSet.add(messageId)
      return newSet
    })
  }

  const visibleMessages = systemMessages.filter(
    msg => !dismissedMessages.has(msg.id)
  )

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Check if user is in onboarding flow (setup or choose-plan)
  // Only apply after mount to avoid hydration mismatch
  const isInOnboarding = mounted && (pathname.startsWith('/setup') || pathname.startsWith('/choose-plan'))

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Slim, fixed header with blur backdrop - Metallic style */}
      <header className="fixed top-0 z-50 w-full bg-white/80 dark:bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/[0.04]">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Left side - Logo */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Logo - doesn't navigate during onboarding */}
            <Link
              href={isInOnboarding ? pathname : "/dashboard"}
              className="flex items-center group"
              onClick={isInOnboarding ? (e) => e.preventDefault() : undefined}
            >
              <Image
                src={mounted && resolvedTheme === 'light' ? '/logo-light.svg' : '/logo-dark.svg'}
                alt="JobSilver"
                width={160}
                height={32}
                className="h-8 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Center - System Messages Banner or Announcement Banner */}
          {!isInOnboarding && (
            <div className="flex-1 flex items-center justify-center px-4 max-w-2xl mx-auto">
              {visibleMessages.length > 0 ? (
                // System messages take priority
                visibleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm w-full",
                      msg.type === 'warning' && "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
                      msg.type === 'info' && "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
                      msg.type === 'error' && "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20"
                    )}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{msg.message}</span>
                    {msg.action && (
                      <Link
                        href={msg.action.href || '#'}
                        onClick={msg.action.onClick}
                        className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
                      >
                        {msg.action.label}
                      </Link>
                    )}
                    {msg.dismissible && (
                      <button
                        onClick={() => dismissMessage(msg.id)}
                        className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                // Show announcement banner when no system messages
                <AnnouncementBanner plan={(profile?.subscription_plan || 'free') as 'free' | 'pro' | 'ultra'} />
              )}
            </div>
          )}

          {/* Right side - Theme toggle and User menu */}
          <div className="flex items-center gap-2">
            {/* Tester badge - show for tester users */}
            {isTester && !isAdmin && <TesterBadge variant="default" />}

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 px-2 hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                >
                  <Avatar className="h-7 w-7 border border-zinc-200 dark:border-white/[0.08]">
                    <AvatarImage src="" alt={profile?.full_name || "User"} />
                    <AvatarFallback className="bg-zinc-100 text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-300 text-xs font-medium">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{profile?.full_name || "User"}</p>
                    {isTester && !isAdmin && <TesterBadge variant="compact" showTooltip={false} />}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {userEmail}
                  </p>
                </div>
                {/* Navigation links - hidden during onboarding */}
                {!isInOnboarding && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/dashboard" className="flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/profile" className="flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/control-k7x9m2p4" className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      </header>

      {/* Main content with top padding for fixed header */}
      <main className="pt-14">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <SubscriptionProvider>
            <ChatProvider>
              {children}
            </ChatProvider>
            <UpgradeModal />
          </SubscriptionProvider>
        </motion.div>
      </main>

      {/* Global report button - bottom-left, opposite of chat */}
      <ReportButton />

      {/* Footer */}
      <PublicFooter onboarding={isInOnboarding} />
    </div>
  )
}
