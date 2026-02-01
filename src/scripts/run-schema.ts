import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runSchema() {
  console.log('Setting up Supabase database...\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // Test connection and check existing tables
  console.log('Checking existing tables...')

  const tables = ['profiles', 'jobs', 'application_history', 'saved_answers']

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error && error.code === '42P01') {
      console.log(`  ❌ Table "${table}" does not exist`)
    } else if (error) {
      console.log(`  ⚠️ Table "${table}" error: ${error.message}`)
    } else {
      console.log(`  ✓ Table "${table}" exists`)
    }
  }

  // Check storage bucket
  console.log('\nChecking storage bucket...')
  const { data: buckets } = await supabase.storage.listBuckets()
  const cvsBucket = buckets?.find(b => b.name === 'cvs')

  if (cvsBucket) {
    console.log('  ✓ Storage bucket "cvs" exists')
  } else {
    console.log('  Creating storage bucket "cvs"...')
    const { error } = await supabase.storage.createBucket('cvs', {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    })
    if (error) {
      console.log(`  ❌ Failed to create bucket: ${error.message}`)
    } else {
      console.log('  ✓ Storage bucket "cvs" created')
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('DATABASE SETUP INSTRUCTIONS')
  console.log('='.repeat(60))

  // Extract project reference from URL
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0]
  console.log(`
To create the missing tables, run this SQL in your Supabase dashboard:
https://supabase.com/dashboard/project/${projectRef}/sql/new

Copy and paste the SQL from: supabase/schema.sql
`)
}

runSchema().catch(console.error)
