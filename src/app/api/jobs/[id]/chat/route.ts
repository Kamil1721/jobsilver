import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  image_url?: string
  created_at: string
}

// GET - Load chat history for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 14.2+
    const { id: jobId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log(`[Chat GET] Job: ${jobId}, User: ${user?.id || 'none'}, Auth error: ${authError?.message || 'none'}`)

    if (!user) {
      console.log('[Chat GET] Unauthorized - no user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError) {
      console.log(`[Chat GET] Job lookup error: ${jobError.message}`)
    }

    if (!job) {
      console.log(`[Chat GET] Job not found: ${jobId} for user ${user.id}`)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch chat messages for this job
    const { data: messages, error } = await supabase
      .from('job_chat_messages')
      .select('id, role, content, image_url, created_at')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Chat GET] Error fetching chat messages:', error)
      return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 })
    }

    console.log(`[Chat GET] Loaded ${messages?.length || 0} messages for job ${jobId}`)
    return NextResponse.json({ messages: messages || [] })
  } catch (error) {
    console.error('[Chat GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Save a new chat message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 14.2+
    const { id: jobId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log(`[Chat POST] Job: ${jobId}, User: ${user?.id || 'none'}, Auth error: ${authError?.message || 'none'}`)

    if (!user) {
      console.log('[Chat POST] Unauthorized - no user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, content, imageUrl } = await request.json()

    // Role is required, but content can be empty for image-only messages (if there's an image)
    if (!role) {
      console.log('[Chat POST] Missing role')
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    // Content is required unless there's an image
    if (!content && !imageUrl) {
      console.log('[Chat POST] Missing content (and no image)')
      return NextResponse.json({ error: 'Content or image is required' }, { status: 400 })
    }

    // Verify user owns the job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError) {
      console.log(`[Chat POST] Job lookup error: ${jobError.message}`)
    }

    if (!job) {
      console.log(`[Chat POST] Job not found: ${jobId} for user ${user.id}`)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Insert the message
    const { data: message, error } = await supabase
      .from('job_chat_messages')
      .insert({
        job_id: jobId,
        user_id: user.id,
        role,
        content: content || '', // Allow empty content for image-only messages
        image_url: imageUrl || null,
      })
      .select('id, role, content, image_url, created_at')
      .single()

    if (error) {
      console.error('[Chat POST] Error saving chat message:', error)
      // Check if it's a table doesn't exist error
      if (error.code === '42P01') {
        console.error('[Chat POST] Table job_chat_messages does not exist! Run migrations.')
      }
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    console.log(`[Chat POST] Saved message ${message?.id} (${role}) for job ${jobId}`)
    return NextResponse.json({ message })
  } catch (error) {
    console.error('[Chat POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Clear chat history for a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 14.2+
    const { id: jobId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the job
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Delete all messages for this job
    const { error } = await supabase
      .from('job_chat_messages')
      .delete()
      .eq('job_id', jobId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting chat messages:', error)
      return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Chat history DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
