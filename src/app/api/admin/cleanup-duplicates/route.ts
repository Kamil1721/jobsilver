import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Cleanup duplicate jobs for a user
 * Keeps the oldest job (first inserted) and deletes newer duplicates
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find all jobs for user grouped by application_url
    const { data: allJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('id, application_url, title, company, created_at')
      .eq('user_id', user.id)
      .neq('status', 'discarded')
      .order('created_at', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Group by application_url
    const urlGroups = new Map<string, typeof allJobs>()
    for (const job of allJobs || []) {
      if (!job.application_url) continue
      if (!urlGroups.has(job.application_url)) {
        urlGroups.set(job.application_url, [])
      }
      urlGroups.get(job.application_url)!.push(job)
    }

    // Find duplicates (groups with more than 1 job)
    const duplicateIds: string[] = []
    const keptJobs: Array<{ title: string; company: string }> = []

    for (const [url, jobs] of Array.from(urlGroups.entries())) {
      if (jobs.length > 1) {
        // Keep the first (oldest), delete the rest
        const [keep, ...duplicates] = jobs
        keptJobs.push({ title: keep.title, company: keep.company || 'Unknown' })
        duplicateIds.push(...duplicates.map(j => j.id))
      }
    }

    if (duplicateIds.length === 0) {
      return NextResponse.json({
        message: 'No duplicates found',
        duplicatesRemoved: 0,
      })
    }

    // Delete duplicates
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .in('id', duplicateIds)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Removed ${duplicateIds.length} duplicate jobs`,
      duplicatesRemoved: duplicateIds.length,
      keptJobs: keptJobs.slice(0, 10), // Show first 10 kept jobs
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Failed to cleanup duplicates' }, { status: 500 })
  }
}
