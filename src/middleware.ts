import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Get admin emails from environment variable
 * Format: ADMIN_EMAILS=admin1@example.com,admin2@example.com
 */
function getAdminEmails(): string[] {
  const adminEmailsEnv = process.env.ADMIN_EMAILS || ''

  if (!adminEmailsEnv) {
    return []
  }

  return adminEmailsEnv
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0)
}

/**
 * Check if an email is in the admin list
 */
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = getAdminEmails()
  return adminEmails.includes(email.toLowerCase())
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect dashboard, setup, and choose-plan routes
  const protectedPaths = ['/dashboard', '/profile', '/jobs', '/setup', '/choose-plan']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isProtectedPath) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // For authenticated users, check onboarding flow status
    // Flow: Login -> Choose Plan -> Setup -> Dashboard
    const isOnChoosePlan = request.nextUrl.pathname.startsWith('/choose-plan')
    const isOnSetup = request.nextUrl.pathname.startsWith('/setup')

    // Fetch profile to check plan selection and setup status
    const { data: profile } = await supabase
      .from('profiles')
      .select('job_filters, has_selected_plan, is_tester')
      .eq('id', user.id)
      .single()

    const hasCompletedSetup = profile?.job_filters && Object.keys(profile.job_filters).length > 0
    // Users who have selected a plan OR completed setup (existing users) OR are testers
    // Existing users with job_filters are grandfathered in (they existed before plan selection)
    const hasSelectedPlan = profile?.has_selected_plan === true || profile?.is_tester === true || hasCompletedSetup

    // Step 1: Check if user has selected a plan (testers skip this)
    if (!hasSelectedPlan && !isOnChoosePlan) {
      return NextResponse.redirect(new URL('/choose-plan', request.url))
    }

    // Step 2: Check if user has completed setup (skip if on setup or choose-plan)
    if (hasSelectedPlan && !hasCompletedSetup && !isOnSetup && !isOnChoosePlan) {
      return NextResponse.redirect(new URL('/setup', request.url))
    }

    // Step 3: If user already completed setup but is on /setup page, redirect to dashboard
    // This handles returning users who already have job_filters set
    // Allow access if ?edit=true is present (user explicitly wants to edit preferences)
    const isEditMode = request.nextUrl.searchParams.get('edit') === 'true'
    if (hasCompletedSetup && isOnSetup && !isEditMode) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Protect admin routes - check both email list and is_admin flag
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Check if user email is in admin list
    const emailIsAdmin = isAdminEmail(user.email)

    // If not in email list, check the database is_admin flag
    // Note: For middleware performance, we first check the fast email check
    // The API routes will do the full database check as well
    if (!emailIsAdmin) {
      // Fetch is_admin from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      const dbIsAdmin = profile?.is_admin === true

      if (!dbIsAdmin) {
        // Redirect non-admin users to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  // Redirect logged-in users from login page
  if (request.nextUrl.pathname === '/login' && user) {
    // Respect the 'next' parameter if provided, otherwise go to dashboard
    const nextUrl = request.nextUrl.searchParams.get('next')
    if (nextUrl && nextUrl.startsWith('/')) {
      return NextResponse.redirect(new URL(nextUrl, request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
