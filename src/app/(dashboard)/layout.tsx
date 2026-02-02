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
  Settings,
  LogOut,
  Shield,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import type { Profile } from "@/lib/supabase/types"
import { ChatProvider } from "@/components/chat"
import { ReportButton } from "@/components/report"
import { SubscriptionProvider } from "@/contexts/SubscriptionContext"
import { UpgradeModal } from "@/components/upgrade-modal"
import { TesterBadge } from "@/components/dashboard/TesterBadge"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
  },
]

const adminNavigation = {
  name: "Admin",
  href: "/admin",
  icon: Shield,
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
        // On sign out, redirect and refresh to clear state
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
  }, [supabase, currentUserId])

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
          {/* Left side - Logo and Navigation */}
          <div className="flex items-center gap-6">
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

            {/* Navigation - hidden during onboarding flow */}
            {!isInOnboarding && (
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                      isActive
                        ? "text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/[0.08]"
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                )
              })}
              {/* Admin link - only show for admin users */}
              {isAdmin && (
                <Link
                  href={adminNavigation.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                    (pathname === adminNavigation.href || pathname.startsWith(adminNavigation.href + "/"))
                      ? "text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/[0.08]"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                  )}
                >
                  <adminNavigation.icon className="w-4 h-4" />
                  {adminNavigation.name}
                </Link>
              )}
            </nav>
            )}
          </div>

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
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/profile" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/admin" className="flex items-center">
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

        {/* Mobile Navigation - hidden during onboarding flow */}
        {!isInOnboarding && (
          <nav className="flex md:hidden items-center gap-1 px-4 pb-3 border-t border-zinc-200 dark:border-white/[0.04] pt-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center gap-2 flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/[0.08]"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href={adminNavigation.href}
                className={cn(
                  "flex items-center justify-center gap-2 flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                  (pathname === adminNavigation.href || pathname.startsWith(adminNavigation.href + "/"))
                    ? "text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/[0.08]"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                )}
              >
                <adminNavigation.icon className="w-4 h-4" />
                {adminNavigation.name}
              </Link>
            )}
          </nav>
        )}
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
    </div>
  )
}
