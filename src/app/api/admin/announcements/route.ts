import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin/auth'
import { z } from 'zod'
import { parseRequestBody, uuidSchema } from '@/lib/security/validation'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'
import { createAuditContext } from '@/lib/security/audit-log'
import { logAdminActionToDb } from '@/lib/security/audit-log'
import type { AdminAnnouncement } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// Validation schemas
const announcementTypeSchema = z.enum(['info', 'warning', 'promo', 'maintenance'])

const createAnnouncementSchema = z.object({
  message: z.string().min(1).max(500),
  type: announcementTypeSchema.default('info'),
  priority: z.number().int().min(0).max(100).default(0),
  target_plans: z.array(z.enum(['free', 'pro'])).nullable().default(null),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().default(true),
}).refine(
  // P2 FIX: Validate ends_at is after starts_at
  data => {
    if (!data.ends_at || !data.starts_at) return true
    return new Date(data.ends_at) > new Date(data.starts_at)
  },
  { message: 'End date must be after start date' }
)

const updateAnnouncementSchema = z.object({
  id: uuidSchema,
  message: z.string().min(1).max(500).optional(),
  type: announcementTypeSchema.optional(),
  priority: z.number().int().min(0).max(100).optional(),
  target_plans: z.array(z.enum(['free', 'pro'])).nullable().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional(),
})

const deleteAnnouncementSchema = z.object({
  id: uuidSchema,
})

/**
 * GET /api/admin/announcements
 * Get all announcements (active and inactive) for admin management
 */
export async function GET(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: adminAuth.error || 'Forbidden' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'announcements-get')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    const supabase = await createClient()

    const { data: announcements, error } = await supabase
      .from('admin_announcements')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // P0 FIX: Gracefully handle missing table (migration not run)
      const errorMessage = error.message || ''
      const errorCode = (error as { code?: string }).code
      if (errorCode === '42P01' || errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        console.warn('[Admin Announcements] Table admin_announcements does not exist. Run migration 20260205_admin_improvements.sql')
        return NextResponse.json(
          { announcements: [], warning: 'Announcements table not found. Please run database migration.' },
          { headers: getRateLimitHeaders(rateLimit) }
        )
      }
      console.error('Error fetching announcements:', error)
      return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
    }

    return NextResponse.json(
      { announcements: announcements as AdminAnnouncement[] },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in announcements GET:', error)
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}

/**
 * POST /api/admin/announcements
 * Create a new announcement
 */
export async function POST(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'announcements-post')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Validate request body
    const bodyValidation = await parseRequestBody(request, createAnnouncementSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const supabase = await createClient()
    const auditContext = createAuditContext(request)

    const { data: announcement, error } = await supabase
      .from('admin_announcements')
      .insert({
        ...bodyValidation.data,
        created_by: adminAuth.user?.id,
        starts_at: bodyValidation.data.starts_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating announcement:', error)
      return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
    }

    // Log to audit trail
    await logAdminActionToDb(supabase, {
      adminId: adminAuth.user?.id || '',
      adminEmail: adminAuth.user?.email || '',
      action: 'announcement_created',
      targetType: 'announcement',
      targetId: announcement.id,
      details: {
        message: bodyValidation.data.message.substring(0, 100), // Truncate for log
        type: bodyValidation.data.type,
      },
      ipAddress: auditContext.ip,
    })

    return NextResponse.json(
      { announcement },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in announcements POST:', error)
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/announcements
 * Update an announcement
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'announcements-patch')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Validate request body
    const bodyValidation = await parseRequestBody(request, updateAnnouncementSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { id, ...updateData } = bodyValidation.data

    const supabase = await createClient()
    const auditContext = createAuditContext(request)

    const { data: announcement, error } = await supabase
      .from('admin_announcements')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating announcement:', error)
      return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
    }

    // Log to audit trail
    await logAdminActionToDb(supabase, {
      adminId: adminAuth.user?.id || '',
      adminEmail: adminAuth.user?.email || '',
      action: 'announcement_updated',
      targetType: 'announcement',
      targetId: id,
      details: {
        updatedFields: Object.keys(updateData),
      },
      ipAddress: auditContext.ip,
    })

    return NextResponse.json(
      { announcement },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in announcements PATCH:', error)
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/announcements
 * Delete an announcement
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting - stricter for destructive operations
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(
      clientId,
      { maxRequests: 20, windowSeconds: 60, prefix: 'admin-delete' },
      'announcements-delete'
    )

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Validate request body
    const bodyValidation = await parseRequestBody(request, deleteAnnouncementSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { id } = bodyValidation.data

    const supabase = await createClient()
    const auditContext = createAuditContext(request)

    // Get announcement before deleting for audit log
    const { data: existing } = await supabase
      .from('admin_announcements')
      .select('message, type')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('admin_announcements')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting announcement:', error)
      return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
    }

    // Log to audit trail
    await logAdminActionToDb(supabase, {
      adminId: adminAuth.user?.id || '',
      adminEmail: adminAuth.user?.email || '',
      action: 'announcement_deleted',
      targetType: 'announcement',
      targetId: id,
      details: {
        deletedMessage: existing?.message?.substring(0, 100),
        deletedType: existing?.type,
      },
      ipAddress: auditContext.ip,
    })

    return NextResponse.json(
      { success: true, deleted: id },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in announcements DELETE:', error)
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }
}
