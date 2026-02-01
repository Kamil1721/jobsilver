import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the CV path from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cv_url')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.cv_url) {
      return NextResponse.json({ error: 'No CV found' }, { status: 404 })
    }

    // Create a signed URL that expires in 1 hour
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('cvs')
      .createSignedUrl(profile.cv_url, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError)
      return NextResponse.json({ error: 'Failed to generate CV URL' }, { status: 500 })
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      fileName: profile.cv_url.split('/').pop()?.replace(/^\d+-/, '') || 'CV Document'
    })
  } catch (error) {
    console.error('CV view error:', error)
    return NextResponse.json({ error: 'Failed to get CV' }, { status: 500 })
  }
}
