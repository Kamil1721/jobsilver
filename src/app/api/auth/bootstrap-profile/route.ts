import { NextResponse } from 'next/server'
import { ensureProfileForAuthenticatedUser } from '@/lib/supabase/ensure-profile'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  try {
    await ensureProfileForAuthenticatedUser(user)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Profile Bootstrap] Failed to ensure profile:', error)
    return NextResponse.json(
      { error: { code: 'PROFILE_BOOTSTRAP_FAILED', message: 'Unable to prepare account' } },
      { status: 500 }
    )
  }
}
