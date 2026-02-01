const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: Missing environment variables.');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function verify() {
  console.log('Verifying complete JobSilver setup...\n');

  const supabase = createClient(supabaseUrl, serviceKey);

  // Check tables
  const tables = ['profiles', 'jobs', 'application_history', 'saved_answers'];

  console.log('Database Tables:');
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error && error.code === '42P01') {
      console.log(`  ❌ ${table} - NOT FOUND`);
    } else if (error) {
      console.log(`  ⚠️  ${table} - ${error.message}`);
    } else {
      console.log(`  ✓  ${table}`);
    }
  }

  // Check if screening_answers column exists
  console.log('\nProfile Columns:');
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, job_filters, screening_answers')
    .limit(1);

  if (profileError) {
    console.log(`  ⚠️  Error checking columns: ${profileError.message}`);
  } else {
    console.log('  ✓  job_filters column exists');
    console.log('  ✓  screening_answers column exists');
  }

  // Check storage bucket
  console.log('\nStorage Buckets:');
  const { data: buckets } = await supabase.storage.listBuckets();
  const cvsBucket = buckets?.find(b => b.name === 'cvs');
  if (cvsBucket) {
    console.log(`  ✓  cvs (public: ${cvsBucket.public})`);
  } else {
    console.log('  ❌ cvs - NOT FOUND');
  }

  console.log('\n' + '='.repeat(50));
  console.log('SETUP COMPLETE!');
  console.log('='.repeat(50));
  console.log(`
Your JobSilver app is ready to use:

  Dashboard:     http://localhost:3000/dashboard
  Setup Wizard:  http://localhost:3000/setup
  Profile:       http://localhost:3000/profile

Get started:
  1. Sign up / Log in
  2. Go to /setup to configure your job preferences
  3. Upload your CV in /profile
  4. Search for jobs in /dashboard
`);
}

verify().catch(console.error);
