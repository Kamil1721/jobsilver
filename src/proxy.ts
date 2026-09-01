import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSafeInternalPath } from '@/lib/security/urls'

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && getAdminEmails().includes(email.toLowerCase()))
}

function matchesPath(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  let authResponseHeaders: Record<string, string> = {}

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          authResponseHeaders = { ...authResponseHeaders, ...headersToSet }
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
          Object.entries(authResponseHeaders).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
        },
      },
    }
  )

  // Keep this auth verification immediately after client creation so expired
  // sessions can refresh before any response or redirect is produced.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const withRefreshedCookies = (nextResponse: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => nextResponse.cookies.set(cookie))
    Object.entries(authResponseHeaders).forEach(([key, value]) => {
      nextResponse.headers.set(key, value)
    })
    return nextResponse
  }

  const redirect = (url: URL) => withRefreshedCookies(NextResponse.redirect(url))
  const hiddenNotFound = () =>
    withRefreshedCookies(new NextResponse(null, { status: 404 }))
  const profileUnavailable = () =>
    withRefreshedCookies(
      new NextResponse(
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JobSilver is temporarily unavailable</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #fffdfb; color: #1f1b18; }
      main { width: min(100%, 560px); padding: clamp(32px, 7vw, 48px); text-align: center; border: 1px solid rgba(31,27,24,.09); border-radius: 24px; background: #fff; box-shadow: 0 18px 50px -32px rgba(31,27,24,.24); }
      .mark { display: grid; place-items: center; width: 48px; height: 48px; margin: 0 auto 24px; border-radius: 999px; background: #fff0eb; color: #b83c20; font-size: 24px; font-weight: 700; }
      h1 { margin: 0; font-size: clamp(24px, 5vw, 32px); line-height: 1.12; letter-spacing: -.025em; }
      p { max-width: 46ch; margin: 14px auto 0; color: #6b645e; font-size: 15px; line-height: 1.65; }
      a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; margin-top: 26px; padding: 0 24px; border-radius: 999px; background: #f0603a; color: #28140f; font-size: 14px; font-weight: 700; text-decoration: none; }
      a:hover { background: #f57451; }
      a:focus-visible { outline: 2px solid #f0603a; outline-offset: 3px; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">!</div>
      <h1>Your account details are temporarily unavailable</h1>
      <p>We couldn’t safely confirm your setup, so we paused this page instead of sending you to the wrong step. Check your connection and try again.</p>
      <a href="">Try again</a>
    </main>
  </body>
</html>`,
        {
          status: 503,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Retry-After': '5',
          },
        }
      )
    )

  const protectedPaths = [
    '/dashboard',
    '/profile',
    '/preferences',
    '/jobs',
    '/setup',
    '/choose-plan',
  ]
  const isProtectedPath = protectedPaths.some((path) =>
    matchesPath(request.nextUrl.pathname, path)
  )

  if (isProtectedPath) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set(
        'next',
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      )
      return redirect(loginUrl)
    }

    const isOnChoosePlan = matchesPath(request.nextUrl.pathname, '/choose-plan')
    const isOnSetup = matchesPath(request.nextUrl.pathname, '/setup')

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('job_filters, has_selected_plan, is_tester')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Protected route profile lookup failed:', profileError.message)
      return profileUnavailable()
    }

    const hasCompletedSetup = Boolean(
      profile?.job_filters && Object.keys(profile.job_filters).length > 0
    )
    const hasSelectedPlan =
      profile?.has_selected_plan === true ||
      profile?.is_tester === true ||
      hasCompletedSetup

    if (!hasSelectedPlan && !isOnChoosePlan) {
      return redirect(new URL('/choose-plan', request.url))
    }

    if (hasSelectedPlan && !hasCompletedSetup && !isOnSetup && !isOnChoosePlan) {
      return redirect(new URL('/setup', request.url))
    }

    const isEditMode = request.nextUrl.searchParams.get('edit') === 'true'
    if (hasCompletedSetup && isOnSetup && !isEditMode) {
      return redirect(new URL('/dashboard', request.url))
    }
  }

  if (matchesPath(request.nextUrl.pathname, '/control-k7x9m2p4')) {
    if (!user) {
      return hiddenNotFound()
    }

    if (!isAdminEmail(user.email)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin !== true) {
        return hiddenNotFound()
      }
    }
  }

  if (matchesPath(request.nextUrl.pathname, '/admin')) {
    return hiddenNotFound()
  }

  if (request.nextUrl.pathname === '/login' && user) {
    const nextUrl = getSafeInternalPath(request.nextUrl.searchParams.get('next'))
    return redirect(new URL(nextUrl, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
