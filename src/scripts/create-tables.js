// Script to create database tables via Supabase
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing environment variables.');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function createTables() {
  console.log('Creating database tables...\n');

  // Read schema SQL
  const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Split into individual statements
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute.\n`);

  // Execute via PostgREST RPC (this won't work for DDL)
  // We need to provide manual instructions

  // Let's at least create the storage bucket
  console.log('Creating storage bucket...');

  const bucketResponse = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 'cvs',
      name: 'cvs',
      public: true,
      file_size_limit: 10485760,
      allowed_mime_types: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    })
  });

  if (bucketResponse.ok) {
    console.log('✓ Storage bucket "cvs" created successfully!');
  } else {
    const error = await bucketResponse.json();
    if (error.message?.includes('already exists')) {
      console.log('✓ Storage bucket "cvs" already exists');
    } else {
      console.log('Storage bucket error:', error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEP: Create database tables');
  console.log('='.repeat(60));

  // Extract project reference from URL
  const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
  console.log(`
The storage bucket is ready. Now you need to create the database tables.

1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new

2. Copy and paste this SQL:
`);
  console.log(schemaSql);
  console.log('\n3. Click "Run" to execute the SQL.\n');
}

createTables().catch(console.error);
