"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, MotionConfig } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useGoogleAuthEnabled } from "@/hooks/use-google-auth-enabled"
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  KeyRound,
} from "lucide-react"
import { Nav } from "@/components/landing/nav"
import { Footer } from "@/components/landing/dawn-footer"
import { AssistantIdentity } from "@/components/ai-assistant/assistant-identity"

export default function TesterLoginPage() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"login" | "signup">("signup")
  const [inviteCode, setInviteCode] = React.useState("")
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const googleAuthEnabled = useGoogleAuthEnabled()

  // Check for invite code in URL on mount
  React.useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    if (code) {
      // Store for OAuth callback
      localStorage.setItem("tester_invite_code", code)
      queueMicrotask(() => {
        if (!cancelled) setInviteCode(code)
      })
    }

    return () => {
      cancelled = true
    }
  }, [])

  // Apply tester status to current user
  const applyTesterStatus = async (code?: string) => {
    const codeToUse = code || inviteCode || localStorage.getItem("tester_invite_code")
    if (!codeToUse) {
      toast({
        variant: "destructive",
        title: "Invite code required",
        description: "Please enter a valid tester invite code.",
      })
      return false
    }

    try {
      const response = await fetch("/api/auth/tester-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: codeToUse }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Invalid invite code",
          description: data.error || "The invite code is invalid or has already been used.",
        })
        return false
      }

      // Clear stored code after successful use
      localStorage.removeItem("tester_invite_code")
      return data.success === true
    } catch (error) {
      console.error("Failed to apply tester status:", error)
      return false
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!inviteCode) {
      toast({
        variant: "destructive",
        title: "Invite code required",
        description: "Please enter a valid tester invite code.",
      })
      return
    }

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

    // Apply tester status with invite code
    const applied = await applyTesterStatus()

    if (!applied) {
      setIsLoading(false)
      return
    }

    toast({
      title: "Welcome, tester",
      description: "You now have full access to all features.",
    })

    router.push("/dashboard")
    router.refresh()
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!inviteCode) {
      toast({
        variant: "destructive",
        title: "Invite code required",
        description: "Please enter a valid tester invite code.",
      })
      return
    }

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
          is_tester_signup: true,
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

    // If user is immediately logged in (no email confirmation)
    if (data.session) {
      const applied = await applyTesterStatus()
      if (!applied) {
        setIsLoading(false)
        return
      }
      toast({
        title: "Welcome, tester",
        description: "Account created with full feature access.",
      })
      router.push("/dashboard")
      router.refresh()
      return
    }

    // Email confirmation required - store invite code for later
    localStorage.setItem("pending_tester_auto", "true")
    localStorage.setItem("tester_invite_code", inviteCode)
    toast({
      title: "Account created",
      description: "Check your email to verify, then you'll have full tester access.",
    })

    setActiveTab("login")
    setIsLoading(false)
  }

  const handleGoogleAuth = async () => {
    if (!googleAuthEnabled) return

    if (!inviteCode) {
      toast({
        variant: "destructive",
        title: "Invite code required",
        description: "Please enter a valid tester invite code first.",
      })
      return
    }

    // Store invite code for use after OAuth callback
    localStorage.setItem("tester_invite_code", inviteCode)

    setIsLoading(true)
    const redirectUrl = `${window.location.origin}/auth/callback?tester=true`

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
  }

  // Shared Dawn field styling for the shadcn Input primitive.
  const fieldClass =
    "h-11 min-h-[44px] pl-10 rounded-[12px] bg-[var(--dawn-surface)] border-[var(--dawn-line-2)] text-[var(--dawn-ink)] placeholder:text-[var(--dawn-ink-3)] focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]"
  const labelClass = "text-[13px] font-medium text-[var(--dawn-ink)]"

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "var(--dawn-bg)", color: "var(--dawn-ink)" }}
    >
      <Nav />

      <MotionConfig reducedMotion="user">
        <main className="relative flex min-h-screen flex-col items-center justify-center px-[var(--dawn-gutter)] pt-24 pb-20">
          {/* Soft coral wash — decorative, low-key, never a hard gradient block */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
            style={{
              background:
                "radial-gradient(60% 100% at 50% 0%, var(--coral-soft) 0%, rgba(252,233,226,0) 70%)",
            }}
          />

          <div className="w-full max-w-md">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mb-8 text-center"
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[var(--coral)]/20 bg-[var(--dawn-cream)] px-3.5 py-1.5">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--coral)]" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
                  Beta Tester Access
                </span>
              </div>

              <h1 className="text-balance text-[clamp(28px,3.6vw,38px)] font-semibold leading-[1.03] tracking-[-0.02em] text-[var(--dawn-ink)]">
                {activeTab === "login" ? "Welcome back, tester" : "Join as a beta tester"}
              </h1>
              <p className="mx-auto mt-3 max-w-[46ch] text-[clamp(15px,1.1vw,17px)] leading-[1.6] text-[var(--dawn-ink-2)]">
                {activeTab === "login"
                  ? "Sign in to pick up where you left off. Every feature, unlocked."
                  : "A quiet corner of JobSilver where you get the whole toolkit, early."}
              </p>
            </motion.div>

            {/* Auth Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[16px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-7 shadow-[0_1px_2px_rgba(31,27,24,0.04)] sm:p-8"
            >
              {/* Features Banner */}
              <div className="mb-6 flex items-center gap-3 rounded-[12px] border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-3.5">
                <AssistantIdentity size={40} variant="folio" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[var(--dawn-ink)]">
                    Full feature access
                  </p>
                  <p className="text-[12.5px] leading-[1.45] text-[var(--dawn-ink-2)]">
                    Unlimited AI responses, cover letters, CV optimization, and more.
                  </p>
                </div>
              </div>

              {/* Animated Tab Indicator */}
              <div
                role="group"
                aria-label="Authentication mode"
                className="mb-6 inline-flex w-full items-center rounded-[12px] border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-1.5"
              >
                {(["signup", "login"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative min-h-[44px] flex-1 rounded-[9px] px-4 py-2.5 text-[14px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-cream)]"
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="tester-tab-indicator"
                        className="absolute inset-0 rounded-[9px] bg-[var(--dawn-surface)] shadow-[0_1px_2px_rgba(31,27,24,0.06)] ring-1 ring-[var(--dawn-line-2)]"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <span
                      className={`relative z-10 ${
                        activeTab === tab
                          ? "text-[var(--dawn-ink)]"
                          : "text-[var(--dawn-ink-3)]"
                      }`}
                    >
                      {tab === "login" ? "Sign in" : "Sign up"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Invite Code Input */}
              <div className="mb-4 space-y-2">
                <Label htmlFor="invite-code" className={labelClass}>
                  Invite code <span className="text-[var(--coral-lo)]">*</span>
                </Label>
                <div className="relative">
                  <KeyRound
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dawn-ink-3)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="invite-code"
                    type="text"
                    autoComplete="off"
                    aria-describedby="tester-invite-help"
                    placeholder="Enter your invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                    className={`${fieldClass} uppercase`}
                  />
                </div>
                <p id="tester-invite-help" className="text-[12.5px] text-[var(--dawn-ink-2)]">
                  Contact us to get a tester invite code.
                </p>
              </div>

              {/* Forms */}
              {activeTab === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className={labelClass}>
                      Email
                    </Label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dawn-ink-3)]"
                        aria-hidden="true"
                      />
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                        className={fieldClass}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className={labelClass}>
                      Password
                    </Label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dawn-ink-3)]"
                        aria-hidden="true"
                      />
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        required
                        className={fieldClass}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[var(--coral)] px-6 text-[14px] font-medium text-[var(--coral-ink)] transition-[background-color,transform] duration-200 hover:bg-[var(--coral-hi)] active:scale-[0.985] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in as tester
                        <ArrowRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className={labelClass}>
                      Full name
                    </Label>
                    <div className="relative">
                      <User
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dawn-ink-3)]"
                        aria-hidden="true"
                      />
                      <Input
                        id="signup-name"
                        name="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="Jane Doe"
                        required
                        className={fieldClass}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className={labelClass}>
                      Email
                    </Label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dawn-ink-3)]"
                        aria-hidden="true"
                      />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                        className={fieldClass}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className={labelClass}>
                      Password
                    </Label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dawn-ink-3)]"
                        aria-hidden="true"
                      />
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        aria-describedby="tester-password-help"
                        placeholder="Create a password"
                        required
                        minLength={6}
                        className={fieldClass}
                        disabled={isLoading}
                      />
                    </div>
                    <p id="tester-password-help" className="text-[12.5px] text-[var(--dawn-ink-2)]">
                      Must be at least 6 characters.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[var(--coral)] px-6 text-[14px] font-medium text-[var(--coral-ink)] transition-[background-color,transform] duration-200 hover:bg-[var(--coral-hi)] active:scale-[0.985] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        Join as tester
                      </>
                    )}
                  </button>
                </form>
              )}

              {googleAuthEnabled ? (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-[var(--dawn-line)]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[var(--dawn-surface)] px-3 text-[12px] uppercase tracking-[0.09em] text-[var(--dawn-ink-3)]">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleGoogleAuth}
                    className="flex min-h-[44px] w-full items-center justify-center gap-3 rounded-full border border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] text-[14px] font-medium text-[var(--dawn-ink)] transition-colors duration-200 hover:border-[var(--coral)] hover:text-[var(--coral-lo)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </>
              ) : null}

              {/* Terms */}
              <p className="mt-6 text-center text-[12.5px] leading-[1.5] text-[var(--dawn-ink-2)]">
                By continuing, you agree to our{" "}
                <Link
                  href="/terms"
                  className="rounded-[4px] text-[var(--coral-lo)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="rounded-[4px] text-[var(--coral-lo)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
                >
                  Privacy Policy
                </Link>
              </p>
            </motion.div>
          </div>
        </main>
      </MotionConfig>

      <Footer />
    </div>
  )
}
