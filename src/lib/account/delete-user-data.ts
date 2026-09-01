import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared, fail-closed deletion of ALL data belonging to a user.
 *
 * Used by both the self-service route (/api/account/delete) and the admin panel
 * (/api/admin/users DELETE) so the two paths can never drift apart again — the
 * admin path previously missed public.users entirely, which left orphaned rows
 * that blocked re-signup via the users_email_key unique constraint.
 *
 * Contract:
 * - Returns a list of failure messages. EMPTY means every delete succeeded and
 *   it is safe to remove the auth.users record. Callers MUST NOT delete the
 *   auth user when failures are returned.
 * - A missing table (Postgres 42P01) is tolerated: the schema has drifted
 *   between environments (e.g. notifications exists locally but not in prod)
 *   and a table that does not exist holds no user data.
 * - supabase-js never throws on query errors, so every result is checked.
 */

// Deletion order matters: children before parents.
const TABLES_IN_DELETE_ORDER: Array<{ table: string; column: string }> = [
  // References jobs — must go before jobs
  { table: 'job_chat_messages', column: 'user_id' },
  { table: 'user_favorite_jobs', column: 'user_id' },
  { table: 'user_interactions', column: 'user_id' },
  { table: 'job_applications', column: 'user_id' },
  // References profiles — must go before profiles
  { table: 'user_learning_settings', column: 'user_id' },
  { table: 'user_ai_preferences', column: 'user_id' },
  { table: 'user_reports', column: 'user_id' },
  // References auth.users / user_job_quotas
  { table: 'daily_job_quota_reservations', column: 'user_id' },
  { table: 'user_job_quotas', column: 'user_id' },
  { table: 'curation_logs', column: 'user_id' },
  { table: 'subscriptions', column: 'user_id' },
  { table: 'customers', column: 'user_id' },
  { table: 'notifications', column: 'user_id' },
  { table: 'user_ai_usage', column: 'user_id' },
  { table: 'api_request_log', column: 'triggered_by_user_id' },
  // Main tables last. public.users MUST be included: it has UNIQUE (email), and
  // an orphaned row there permanently blocks the email from signing up again.
  { table: 'jobs', column: 'user_id' },
  { table: 'profiles', column: 'id' },
  { table: 'users', column: 'id' },
]

// A table absent from the environment holds no user data. Postgres reports it
// as 42P01 (undefined_table); PostgREST reports it as PGRST205 (not in schema
// cache) — tolerate both.
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205'])
const isMissingTable = (error: { code?: string } | null): boolean =>
  !!error?.code && MISSING_TABLE_CODES.has(error.code)

export async function deleteUserData(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<string[]> {
  const failures: string[] = []

  // References that must be unlinked, not deleted
  const { error: inviteUnlinkError } = await supabaseAdmin
    .from('tester_invites').update({ used_by: null }).eq('used_by', userId)
  if (inviteUnlinkError && !isMissingTable(inviteUnlinkError)) {
    failures.push(`tester_invites(used_by): ${inviteUnlinkError.message}`)
  }
  const { error: inviteDeleteError } = await supabaseAdmin
    .from('tester_invites').delete().eq('created_by', userId)
  if (inviteDeleteError && !isMissingTable(inviteDeleteError)) {
    failures.push(`tester_invites(created_by): ${inviteDeleteError.message}`)
  }
  const { error: reportUnlinkError } = await supabaseAdmin
    .from('user_reports').update({ resolved_by: null }).eq('resolved_by', userId)
  if (reportUnlinkError && !isMissingTable(reportUnlinkError)) {
    failures.push(`user_reports(resolved_by): ${reportUnlinkError.message}`)
  }

  for (const { table, column } of TABLES_IN_DELETE_ORDER) {
    const { error } = await supabaseAdmin.from(table).delete().eq(column, userId)
    if (error && !isMissingTable(error)) {
      console.error(`[deleteUserData] Error deleting from ${table}:`, error)
      failures.push(`${table}: ${error.message}`)
      // Keep going so one failure doesn't strand the remaining tables
    }
  }

  // CV files in storage
  const { data: files, error: listFilesError } = await supabaseAdmin.storage
    .from('cvs')
    .list(userId)
  if (listFilesError) {
    failures.push(`storage list: ${listFilesError.message}`)
  } else if (files && files.length > 0) {
    const filePaths = files.map((file) => `${userId}/${file.name}`)
    const { error: removeFilesError } = await supabaseAdmin.storage.from('cvs').remove(filePaths)
    if (removeFilesError) failures.push(`storage remove: ${removeFilesError.message}`)
  }

  return failures
}
