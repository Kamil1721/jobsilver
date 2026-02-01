"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  Loader2,
  FlaskConical,
  CheckCircle2,
  XCircle,
} from "lucide-react"

// Loading fallback for Suspense
function LoginLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-zinc-400 animate-spin" />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"login" | "signup">("login")
  const [inviteStatus, setInviteStatus] = React.useState<{
    checked: boolean
    valid: boolean
    code: string | null
    reason?: string
  }>({ checked: false, valid: false, code: null })
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()

  // Check for invite code in URL
  React.useEffect(() => {
    const inviteCode = searchParams.get("invite")
    if (inviteCode && !inviteStatus.checked) {
      validateInviteCode(inviteCode)
      // Default to signup tab when invite code is present
      setActiveTab("signup")
    }
  }, [searchParams])

  const validateInviteCode = async (code: string) => {
    try {
      const response = await fetch(`/api/auth/tester-signup?code=${encodeURIComponent(code)}`)
      const data = await response.json()

      setInviteStatus({
        checked: true,
        valid: data.valid === true,
        code: data.valid ? code : null,
        reason: data.reason,
      })
    } catch (error) {
      console.error("Failed to validate invite code:", error)
      setInviteStatus({ checked: true, valid: false, code: null, reason: "error" })
    }
  }

  const applyTesterInvite = async (inviteCode: string) => {
    try {
      const response = await fetch("/api/auth/tester-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteCode }),
      })
      const data = await response.json()

      if (data.success) {
        toast({
          title: "Welcome, Tester!",
          description: "You have full access to all features.",
        })
        return true
      } else {
        console.error("Failed to apply tester invite:", data.error)
        return false
      }
    } catch (error) {
      console.error("Failed to apply tester invite:", error)
      return false
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      })
      setIsLoading(false)
      return
    }

    // Check for valid invite code from URL (user logging in with invite link)
    if (inviteStatus.valid && inviteStatus.code) {
      const applied = await applyTesterInvite(inviteStatus.code)
      if (applied) {
        toast({
          title: "Welcome, Tester!",
          description: "Tester access has been applied to your account.",
        })
        router.push("/dashboard")
        router.refresh()
        return
      }
    }

    // Check for pending invite from localStorage (from email confirmation flow)
    const pendingInvite = localStorage.getItem("pending_tester_invite")
    if (pendingInvite) {
      localStorage.removeItem("pending_tester_invite")
      const applied = await applyTesterInvite(pendingInvite)
      if (applied) {
        toast({
          title: "Welcome, Tester!",
          description: "Your tester access has been activated.",
        })
        router.push("/dashboard")
        router.refresh()
        return
      }
    }

    toast({
      title: "Welcome back!",
      description: "You have successfully logged in.",
    })
    // Redirect to the next URL if provided, otherwise dashboard
    const nextUrl = searchParams.get("next") || "/dashboard"
    router.push(nextUrl)
    router.refresh()
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const fullName = formData.get("fullName") as string

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      })
      setIsLoading(false)
      return
    }

    // If we have a valid invite code, apply it after signup
    if (inviteStatus.valid && inviteStatus.code && data.user) {
      // For email signups, user needs to confirm email first
      // Store the invite code to apply after email confirmation
      if (data.session) {
        // User is immediately logged in (no email confirmation required)
        await applyTesterInvite(inviteStatus.code)
        toast({
          title: "Welcome, Tester!",
          description: "Account created with full feature access.",
        })
        router.push("/dashboard")
        router.refresh()
        return
      } else {
        // Email confirmation required - store invite code in localStorage
        localStorage.setItem("pending_tester_invite", inviteStatus.code)
        toast({
          title: "Account created!",
          description: "Check your email to verify, then your tester access will be activated.",
        })
      }
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      })
    }

    setActiveTab("login")
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] dark:bg-[#0a0a0b] text-white overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-zinc-800/30 via-zinc-900/20 to-transparent blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-zinc-700/20 via-transparent to-transparent blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-gradient-to-t from-zinc-800/20 via-transparent to-transparent blur-[80px]" />

        {/* Metallic grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="absolute inset-0 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.04]" />
        <div className="relative max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center group">
            <Image
              src="/logo-dark.svg"
              alt="JobSilver"
              width={160}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>

        </div>
      </nav>

      {/* Main Content */}
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              {activeTab === "login" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="text-zinc-500">
              {activeTab === "login"
                ? "Sign in to continue to your dashboard"
                : "Start your AI-powered job search journey"
              }
            </p>
          </motion.div>

          {/* Auth Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative rounded-2xl overflow-hidden"
          >
            {/* Card background */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/50 via-zinc-900/80 to-zinc-900" />
            <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-b from-white/[0.08] via-transparent to-transparent" />

            {/* Shine line */}
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative z-10 p-8">
              {/* Tester Invite Banner */}
              <AnimatePresence mode="wait">
                {inviteStatus.checked && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    {inviteStatus.valid ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                          <FlaskConical className="w-4 h-4 text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-violet-300">
                            Beta Tester Invite
                          </p>
                          <p className="text-xs text-violet-400/70">
                            {activeTab === "signup"
                              ? "Sign up to unlock full feature access"
                              : "Sign in to apply your tester access"}
                          </p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                          <XCircle className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-red-300">
                            Invalid Invite Code
                          </p>
                          <p className="text-xs text-red-400/70">
                            {inviteStatus.reason === "already_used"
                              ? "This invite has already been used"
                              : inviteStatus.reason === "expired"
                              ? "This invite has expired"
                              : inviteStatus.reason === "revoked"
                              ? "This invite has been revoked"
                              : "The invite code is not valid"}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated Tab Indicator */}
              <div className="inline-flex items-center p-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-6 w-full">
                {(["login", "signup"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200"
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="auth-tab-indicator"
                        className="absolute inset-0 bg-white/[0.08] rounded-lg border border-white/[0.08]"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.5,
                        }}
                      />
                    )}
                    <span
                      className={`relative z-10 ${
                        activeTab === tab ? "text-white" : "text-zinc-500"
                      }`}
                    >
                      {tab === "login" ? "Sign In" : "Sign Up"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Forms */}
              {activeTab === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-zinc-300">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        className="pl-10 bg-white/[0.02] border-white/[0.06] text-white placeholder:text-zinc-600 focus:border-white/[0.12] focus:ring-white/[0.08]"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-zinc-300">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        required
                        className="pl-10 bg-white/[0.02] border-white/[0.06] text-white placeholder:text-zinc-600 focus:border-white/[0.12] focus:ring-white/[0.08]"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full h-11 rounded-xl overflow-hidden group disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="relative z-10 text-zinc-900 font-medium flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-zinc-300">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-name"
                        name="fullName"
                        type="text"
                        placeholder="John Doe"
                        required
                        className="pl-10 bg-white/[0.02] border-white/[0.06] text-white placeholder:text-zinc-600 focus:border-white/[0.12] focus:ring-white/[0.08]"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-zinc-300">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        className="pl-10 bg-white/[0.02] border-white/[0.06] text-white placeholder:text-zinc-600 focus:border-white/[0.12] focus:ring-white/[0.08]"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-zinc-300">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="Create a password"
                        required
                        minLength={6}
                        className="pl-10 bg-white/[0.02] border-white/[0.06] text-white placeholder:text-zinc-600 focus:border-white/[0.12] focus:ring-white/[0.08]"
                        disabled={isLoading}
                      />
                    </div>
                    <p className="text-xs text-zinc-600">
                      Must be at least 6 characters
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full h-11 rounded-xl overflow-hidden group disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="relative z-10 text-zinc-900 font-medium flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Get Started
                        </>
                      )}
                    </span>
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-3 text-zinc-600 bg-zinc-900">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Google Login */}
              <button
                type="button"
                disabled={isLoading}
                onClick={async () => {
                  setIsLoading(true)
                  // Build redirect URL with next param and optional invite code
                  const nextUrl = searchParams.get("next") || "/dashboard"
                  const params = new URLSearchParams()
                  params.set("next", nextUrl)
                  if (inviteStatus.valid && inviteStatus.code) {
                    params.set("invite", inviteStatus.code)
                  }
                  const redirectUrl = `${window.location.origin}/auth/callback?${params.toString()}`
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: redirectUrl,
                    },
                  })
                  if (error) {
                    toast({
                      variant: "destructive",
                      title: "Login failed",
                      description: error.message,
                    })
                    setIsLoading(false)
                  }
                }}
                className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-sm text-zinc-300">Continue with Google</span>
              </button>

              {/* Terms */}
              <p className="text-center text-xs text-zinc-600 mt-6">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-zinc-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  )
}
