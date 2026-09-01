import 'server-only'

import type { User } from '@supabase/supabase-js'
import { createServiceClient } from './server'

export interface EnsuredProfile {
  id: string
  created_at: string
  wasInserted: boolean
}

function getFullName(user: User): string | null {
  const fullName = user.user_metadata?.full_name
  return typeof fullName === 'string' && fullName.trim()
    ? fullName.trim().slice(0, 100)
    : null
}

/**
 * Idempotent fallback for environments where the auth.users profile trigger is
 * unavailable. Callers must pass a User returned by a server-side Supabase auth
 * operation; the public bootstrap endpoint never accepts a user id from input.
 */
export async function ensureProfileForAuthenticatedUser(
  user: User
): Promise<EnsuredProfile> {
  const serviceClient = createServiceClient()
  const now = new Date().toISOString()

  if (!user.email) {
    throw new Error('Unable to ensure application user: authenticated user has no email')
  }

  // jobs.user_id still references this canonical bridge table. Environments
  // without the auth.users trigger must create both application records.
  const { error: userInsertError } = await serviceClient
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email,
        created_at: user.created_at ?? now,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (userInsertError) {
    throw new Error(`Unable to ensure application user: ${userInsertError.message}`)
  }

  const { data: insertedProfile, error: insertError } = await serviceClient
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: getFullName(user),
        created_at: now,
        updated_at: now,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    .select('id, created_at')
    .maybeSingle()

  if (insertError) {
    throw new Error(`Unable to ensure application profile: ${insertError.message}`)
  }

  if (insertedProfile) {
    return { ...insertedProfile, wasInserted: true }
  }

  const { data: existingProfile, error: fetchError } = await serviceClient
    .from('profiles')
    .select('id, created_at')
    .eq('id', user.id)
    .single()

  if (fetchError || !existingProfile) {
    throw new Error(
      `Unable to load application profile: ${fetchError?.message ?? 'profile was not created'}`
    )
  }

  return { ...existingProfile, wasInserted: false }
}
