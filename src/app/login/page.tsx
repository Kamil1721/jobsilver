"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, MotionConfig } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useGoogleAuthEnabled } from "@/hooks/use-google-auth-enabled"
import { getSafeInternalPath } from "@/lib/security/urls"
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { Footer } from "@/components/landing/dawn-footer"

// ---------------------------------------------------------------------------
// Dawn theme — shared field primitive. Uncontrolled inputs (the forms read via
// FormData on submit), so no value/onChange wiring is needed here.
// ---------------------------------------------------------------------------
function Field({
  id,
  name,
  type,
  label,
  placeholder,
  autoComplete,
  icon: Icon,
  disabled,
  minLength,
  hint,
}: {
  id: string
  name: string
  type: string
  label: string
  placeholder: string
  autoComplete: string
  icon: LucideIcon
  disabled?: boolean
  minLength?: number
  hint?: string
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-[var(--dawn-ink-2)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={minLength}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="peer h-12 w-full rounded-[12px] border border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] pl-11 pr-3.5 text-[15px] text-[var(--dawn-ink)] transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--dawn-ink-3)] hover:border-[var(--dawn-ink-2)] focus:border-[var(--coral)] focus:outline-none focus:ring-2 focus:ring-[var(--coral-soft)] disabled:opacity-60 disabled:hover:border-[var(--dawn-line-2)]"
        />
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dawn-ink-3)] transition-colors duration-200 peer-focus:text-[var(--coral-lo)]"
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-[var(--dawn-ink-3)]">{hint}</p>
      ) : null}
    </div>
  )
}

// Dawn loading fallback for Suspense — warm-white with a coral ring.
function LoginLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[60] grid place-items-center"
      style={{ background: "var(--dawn-bg)" }}
    >
      <span className="h-11 w-11 animate-spin rounded-full border-[2.5px] border-[var(--dawn-line-2)] border-t-[var(--coral)]" />
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
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"login" | "signup">(() =>
    searchParams.get("invite") ? "signup" : "login"
  )
  const [inviteStatus, setInviteStatus] = React.useState<{
    checked: boolean
    valid: boolean
    code: string | null
    reason?: string
  }>({ checked: false, valid: false, code: null })
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const googleAuthEnabled = useGoogleAuthEnabled()
  const shownCallbackError = React.useRef<string | null>(null)

  React.useEffect(() => {
    const callbackError = searchParams.get("error")
    if (!callbackError || shownCallbackError.current === callbackError) return

    shownCallbackError.current = callbackError
    toast({
      variant: "destructive",
      title: "Sign in failed",
      description:
        callbackError === "profile_setup_failed"
          ? "Your account could not be prepared. Please try signing in again."
          : "We could not complete authentication. Please try again.",
    })
  }, [searchParams, toast])

  // Check for invite code in URL
  React.useEffect(() => {
    const inviteCode = searchParams.get("invite")
    if (!inviteCode || inviteStatus.checked) return

    const abortController = new AbortController()
    fetch(`/api/auth/tester-signup?code=${encodeURIComponent(inviteCode)}`, {
      signal: abortController.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        setInviteStatus({
          checked: true,
          valid: data.valid === true,
          code: data.valid ? inviteCode : null,
          reason: data.reason,
        })
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("Failed to validate invite code:", error)
        setInviteStatus({ checked: true, valid: false, code: null, reason: "error" })
      })

    return () => abortController.abort()
  }, [inviteStatus.checked, searchParams])

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

  const bootstrapApplicationProfile = async () => {
    const response = await fetch("/api/auth/bootstrap-profile", {
      method: "POST",
    })

    if (!response.ok) {
      throw new Error("Unable to prepare your account")
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

    try {
      await bootstrapApplicationProfile()
    } catch (profileError) {
      console.error("Failed to prepare application profile:", profileError)
      await supabase.auth.signOut()
      toast({
        variant: "destructive",
        title: "Account setup failed",
        description: "We could not prepare your account. Please try signing in again.",
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
    const nextUrl = getSafeInternalPath(searchParams.get("next"))
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

    if (data.session) {
      try {
        await bootstrapApplicationProfile()
      } catch (profileError) {
        console.error("Failed to prepare application profile:", profileError)
        await supabase.auth.signOut()
        toast({
          variant: "destructive",
          title: "Account setup failed",
          description: "Your account was created, but setup could not start. Please sign in again.",
        })
        setActiveTab("login")
        setIsLoading(false)
        return
      }

      if (inviteStatus.valid && inviteStatus.code) {
        const applied = await applyTesterInvite(inviteStatus.code)
        if (applied) {
          toast({
            title: "Welcome, Tester!",
            description: "Account created with full feature access.",
          })
          router.push("/dashboard")
          router.refresh()
          return
        }
      }

      toast({
        title: "Account created!",
        description: "Let’s finish setting up your JobSilver account.",
      })
      router.push(getSafeInternalPath(searchParams.get("next")))
      router.refresh()
      return
    }

    // If we have a valid invite code, apply it after signup
    if (inviteStatus.valid && inviteStatus.code && data.user) {
      // For email signups, user needs to confirm email first
      // Store the invite code to apply after email confirmation
      localStorage.setItem("pending_tester_invite", inviteStatus.code)
      toast({
        title: "Account created!",
        description: "Check your email to verify, then your tester access will be activated.",
      })
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      })
    }

    setActiveTab("login")
    setIsLoading(false)
  }

  const handleGoogle = async () => {
    if (!googleAuthEnabled) return

    setIsLoading(true)
    // Build redirect URL with next param and optional invite code
    const nextUrl = getSafeInternalPath(searchParams.get("next"))
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
  }

  const isSignup = activeTab === "signup"

  const primaryBtn =
    "group relative mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--coral)] px-6 text-[15px] font-medium leading-none text-[var(--coral-ink)] transition-colors duration-200 hover:bg-[var(--coral-hi)] active:scale-[0.985] disabled:cursor-progress disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="flex min-h-screen flex-col overflow-x-hidden"
        style={{ background: "var(--dawn-bg)", color: "var(--dawn-ink)" }}
      >
        {/* Minimal top bar — wordmark + back to site (no full Nav on auth pages) */}
        <header className="w-full">
          <div className="mx-auto flex max-w-[var(--dawn-content)] items-center justify-between px-[var(--dawn-gutter)] py-5">
            <Link
              href="/"
              aria-label="JobSilver home"
              className={`inline-flex min-h-[44px] items-center rounded-[8px] text-[18px] font-semibold tracking-[-0.02em] text-[var(--dawn-ink)] ${focusRing}`}
            >
              JobSilver
            </Link>
            <Link
              href="/"
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[8px] text-[13px] text-[var(--dawn-ink-2)] transition-colors duration-200 hover:text-[var(--dawn-ink)] ${focusRing}`}
            >
              <span aria-hidden="true">&larr;</span> Back to site
            </Link>
          </div>
        </header>

        {/* Centered auth stage */}
        <main className="flex flex-1 items-center justify-center px-[var(--dawn-gutter)] py-[clamp(32px,7vw,80px)]">
          <motion.div
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
            }}
            initial="hidden"
            animate="show"
            className="w-full max-w-[440px]"
          >
            {/* Heading */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="mb-7 text-center"
            >
              <span className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
                {isSignup ? "Join JobSilver" : "JobSilver members"}
              </span>
              <h1 className="mt-3 text-balance text-[clamp(30px,4vw,40px)] font-semibold leading-[1.03] tracking-[-0.02em] text-[var(--dawn-ink)]">
                {isSignup ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mx-auto mt-3 max-w-[34ch] text-pretty text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
                {isSignup
                  ? "Set up your account. Curated matches start landing the same day."
                  : "Sign in to pick up where you left off."}
              </p>
            </motion.div>

            {/* Auth card */}
            <motion.section
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="rounded-[20px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-6 shadow-[0_1px_2px_rgba(31,27,24,0.04),0_18px_50px_-24px_rgba(31,27,24,0.18)] sm:p-8"
            >
              {/* Tester invite banner */}
              {inviteStatus.checked && (
                <div
                  role="status"
                  className="mb-6 flex items-center gap-3.5 rounded-[14px] border p-3.5"
                  style={
                    inviteStatus.valid
                      ? {
                          background: "var(--coral-soft)",
                          borderColor: "rgba(240,96,58,0.25)",
                        }
                      : {
                          background: "var(--dawn-cream)",
                          borderColor: "rgba(31,27,24,0.12)",
                        }
                  }
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px]"
                    style={{
                      background: inviteStatus.valid
                        ? "rgba(255,255,255,0.7)"
                        : "rgba(31,27,24,0.05)",
                      color: inviteStatus.valid
                        ? "var(--coral-lo)"
                        : "var(--dawn-ink-3)",
                    }}
                  >
                    {inviteStatus.valid ? (
                      <FlaskConical className="h-[18px] w-[18px]" />
                    ) : (
                      <XCircle className="h-[18px] w-[18px]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[14px] font-medium"
                      style={{
                        color: inviteStatus.valid
                          ? "var(--coral-lo)"
                          : "var(--dawn-ink)",
                      }}
                    >
                      {inviteStatus.valid ? "Beta Tester Invite" : "Invalid Invite Code"}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-[var(--dawn-ink-2)]">
                      {inviteStatus.valid
                        ? activeTab === "signup"
                          ? "Sign up to unlock full feature access"
                          : "Sign in to apply your tester access"
                        : inviteStatus.reason === "already_used"
                        ? "This invite has already been used"
                        : inviteStatus.reason === "expired"
                        ? "This invite has expired"
                        : inviteStatus.reason === "revoked"
                        ? "This invite has been revoked"
                        : "The invite code is not valid"}
                    </span>
                  </span>
                  {inviteStatus.valid && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--coral-lo)]" />
                  )}
                </div>
              )}

              {/* Segmented tabs */}
              <div
                role="group"
                aria-label="Authentication mode"
                className="relative mb-6 grid grid-cols-2 rounded-full border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-1"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full border border-[var(--dawn-line)] bg-[var(--dawn-surface)] shadow-[0_1px_2px_rgba(31,27,24,0.06)] transition-transform duration-300 ease-out"
                  style={{ transform: isSignup ? "translateX(100%)" : "translateX(0)" }}
                />
                <button
                  type="button"
                  aria-pressed={!isSignup}
                  onClick={() => setActiveTab("login")}
                  className={`relative z-[1] min-h-[44px] rounded-full text-[14px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)] ${
                    !isSignup ? "text-[var(--dawn-ink)]" : "text-[var(--dawn-ink-3)]"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  aria-pressed={isSignup}
                  onClick={() => setActiveTab("signup")}
                  className={`relative z-[1] min-h-[44px] rounded-full text-[14px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)] ${
                    isSignup ? "text-[var(--dawn-ink)]" : "text-[var(--dawn-ink-3)]"
                  }`}
                >
                  Sign up
                </button>
              </div>

              {/* Forms */}
              {!isSignup ? (
                <form method="post" onSubmit={handleLogin}>
                  <Field
                    id="login-email"
                    name="email"
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    icon={Mail}
                    disabled={isLoading}
                  />
                  <Field
                    id="login-password"
                    name="password"
                    type="password"
                    label="Password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    icon={Lock}
                    disabled={isLoading}
                  />
                  <button type="submit" disabled={isLoading} className={`${primaryBtn} h-12`}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Signing in&hellip;</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form method="post" onSubmit={handleSignUp}>
                  <Field
                    id="signup-name"
                    name="fullName"
                    type="text"
                    label="Full name"
                    placeholder="John Doe"
                    autoComplete="name"
                    icon={User}
                    disabled={isLoading}
                  />
                  <Field
                    id="signup-email"
                    name="email"
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    icon={Mail}
                    disabled={isLoading}
                  />
                  <Field
                    id="signup-password"
                    name="password"
                    type="password"
                    label="Password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    icon={Lock}
                    minLength={6}
                    disabled={isLoading}
                    hint="Must be at least 6 characters"
                  />
                  <button type="submit" disabled={isLoading} className={`${primaryBtn} h-12`}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Creating account&hellip;</span>
                      </>
                    ) : (
                      <>
                        <span>Create account</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {googleAuthEnabled ? (
                <>
                  <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-[var(--dawn-line)]" aria-hidden="true" />
                    <span className="whitespace-nowrap text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--dawn-ink-3)]">
                      Or continue with
                    </span>
                    <span className="h-px flex-1 bg-[var(--dawn-line)]" aria-hidden="true" />
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleGoogle}
                    className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] px-6 text-[14px] font-medium text-[var(--dawn-ink)] transition-[border-color,background-color] duration-200 hover:border-[var(--coral)] hover:bg-[var(--dawn-cream)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </>
              ) : null}

              {/* Terms */}
              <p className="mx-auto mt-6 max-w-[36ch] text-center text-[12px] leading-[1.55] text-[var(--dawn-ink-3)]">
                By continuing, you agree to our{" "}
                <Link
                  href="/terms"
                  className="text-[var(--dawn-ink-2)] underline decoration-[var(--dawn-line-2)] underline-offset-2 transition-colors hover:text-[var(--coral-lo)]"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-[var(--dawn-ink-2)] underline decoration-[var(--dawn-line-2)] underline-offset-2 transition-colors hover:text-[var(--coral-lo)]"
                >
                  Privacy Policy
                </Link>
              </p>
            </motion.section>
          </motion.div>
        </main>

        <Footer />
      </div>
    </MotionConfig>
  )
}
