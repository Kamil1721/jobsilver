import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Cleanup duplicate jobs for a user
 * Keeps the oldest job (first inserted) and deletes newer duplicates
 * Duplicates are identified by:
 * 1. Same application_url
 * 2. Same company + same title (case-insensitive)
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find all jobs for user
    const { data: allJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('id, application_url, title, company, created_at')
      .eq('user_id', user.id)
      .neq('status', 'discarded')
      .order('created_at', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const duplicateIds: string[] = []
    const keptJobs: Array<{ title: string; company: string; reason: string }> = []

    // Track which IDs we've already marked for deletion
    const markedForDeletion = new Set<string>()

    // 1. Group by application_url
    const urlGroups = new Map<string, typeof allJobs>()
    for (const job of allJobs || []) {
      if (!job.application_url) continue
      if (!urlGroups.has(job.application_url)) {
        urlGroups.set(job.application_url, [])
      }
      urlGroups.get(job.application_url)!.push(job)
    }

    // Find URL duplicates (groups with more than 1 job)
    for (const [, jobs] of Array.from(urlGroups.entries())) {
      if (jobs.length > 1) {
        // Keep the first (oldest), delete the rest
        const [keep, ...duplicates] = jobs
        keptJobs.push({ title: keep.title, company: keep.company || 'Unknown', reason: 'same_url' })
        for (const dup of duplicates) {
          if (!markedForDeletion.has(dup.id)) {
            duplicateIds.push(dup.id)
            markedForDeletion.add(dup.id)
          }
        }
      }
    }

    // 2. Group by company + title (case-insensitive)
    // Only consider jobs NOT already marked for deletion
    const companyTitleGroups = new Map<string, typeof allJobs>()
    for (const job of allJobs || []) {
      if (markedForDeletion.has(job.id)) continue // Skip already marked
      if (!job.company || !job.title) continue

      const key = `${job.company.toLowerCase().trim()}:${job.title.toLowerCase().trim()}`
      if (!companyTitleGroups.has(key)) {
        companyTitleGroups.set(key, [])
      }
      companyTitleGroups.get(key)!.push(job)
    }

    // Find company+title duplicates (groups with more than 1 job)
    for (const jobs of companyTitleGroups.values()) {
      if (jobs.length > 1) {
        // Keep the first (oldest), delete the rest
        const [keep, ...duplicates] = jobs
        keptJobs.push({ title: keep.title, company: keep.company || 'Unknown', reason: 'same_company_title' })
        for (const dup of duplicates) {
          if (!markedForDeletion.has(dup.id)) {
            duplicateIds.push(dup.id)
            markedForDeletion.add(dup.id)
          }
        }
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

    // Count by reason
    const byUrl = keptJobs.filter(j => j.reason === 'same_url').length
    const byCompanyTitle = keptJobs.filter(j => j.reason === 'same_company_title').length

    return NextResponse.json({
      message: `Removed ${duplicateIds.length} duplicate jobs`,
      duplicatesRemoved: duplicateIds.length,
      breakdown: {
        by_url: byUrl,
        by_company_title: byCompanyTitle,
      },
      keptJobs: keptJobs.slice(0, 10), // Show first 10 kept jobs
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Failed to cleanup duplicates' }, { status: 500 })
  }
}
