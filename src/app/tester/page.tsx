"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
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
} from "lucide-react"
import { PublicFooter } from "@/components/public-footer"

export default function TesterLoginPage() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"login" | "signup">("signup")
  const [inviteCode, setInviteCode] = React.useState("")
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  // Check for invite code in URL on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    if (code) {
      setInviteCode(code)
      // Store for OAuth callback
      localStorage.setItem("tester_invite_code", code)
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
      title: "Welcome, Tester!",
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
        title: "Welcome, Tester!",
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
      title: "Account created!",
      description: "Check your email to verify, then you'll have full tester access.",
    })

    setActiveTab("login")
    setIsLoading(false)
  }

  const handleGoogleAuth = async () => {
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

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Purple/violet gradient orbs for tester theme */}
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-violet-900/30 via-purple-900/20 to-transparent blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-purple-700/20 via-transparent to-transparent blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-gradient-to-t from-violet-800/20 via-transparent to-transparent blur-[80px]" />

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
        <div className="absolute inset-0 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-violet-500/10" />
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
            {/* Tester Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
              <FlaskConical className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">Beta Tester Access</span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              {activeTab === "login" ? "Welcome back, Tester" : "Join as a Beta Tester"}
            </h1>
            <p className="text-zinc-400">
              {activeTab === "login"
                ? "Sign in to access all features"
                : "Get full access to all premium features"
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
            {/* Card background with violet tint */}
            <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-zinc-900/80 to-zinc-900" />
            <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-b from-violet-500/[0.08] via-transparent to-transparent" />

            {/* Shine line */}
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />

            <div className="relative z-10 p-8">
              {/* Features Banner */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-violet-300">
                    Full Feature Access
                  </p>
                  <p className="text-xs text-violet-400/70">
                    Unlimited AI responses, cover letters, CV optimization, and more
                  </p>
                </div>
              </div>

              {/* Animated Tab Indicator */}
              <div className="inline-flex items-center p-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-6 w-full">
                {(["signup", "login"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200"
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="tester-tab-indicator"
                        className="absolute inset-0 bg-violet-500/20 rounded-lg border border-violet-500/20"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.5,
                        }}
                      />
                    )}
                    <span
                      className={`relative z-10 ${
                        activeTab === tab ? "text-violet-200" : "text-zinc-500"
                      }`}
                    >
                      {tab === "login" ? "Sign In" : "Sign Up"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Invite Code Input */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="invite-code" className="text-zinc-300">
                  Invite Code <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="invite-code"
                    type="text"
                    placeholder="Enter your invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                    className="pl-10 bg-white/[0.02] border-violet-500/20 text-white placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-violet-500/20 uppercase"
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  Contact us to get a tester invite code
                </p>
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
                        className="pl-10 bg-white/[0.02] border-violet-500/20 text-white placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-violet-500/20"
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
                        className="pl-10 bg-white/[0.02] border-violet-500/20 text-white placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-violet-500/20"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full h-11 rounded-xl overflow-hidden group disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="relative z-10 text-white font-medium flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign In as Tester
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
                        className="pl-10 bg-white/[0.02] border-violet-500/20 text-white placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-violet-500/20"
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
                        className="pl-10 bg-white/[0.02] border-violet-500/20 text-white placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-violet-500/20"
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
                        className="pl-10 bg-white/[0.02] border-violet-500/20 text-white placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-violet-500/20"
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
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="relative z-10 text-white font-medium flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          <FlaskConical className="w-4 h-4" />
                          Join as Tester
                        </>
                      )}
                    </span>
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-violet-500/10" />
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
                onClick={handleGoogleAuth}
                className="w-full h-11 rounded-xl border border-violet-500/20 bg-white/[0.02] hover:bg-violet-500/10 hover:border-violet-500/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
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
                <Link href="/terms" className="text-violet-400 hover:text-violet-300 transition-colors">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-violet-400 hover:text-violet-300 transition-colors">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
