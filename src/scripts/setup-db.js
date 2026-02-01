const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Supabase database connection
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Extract project reference from environment variable
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = SUPABASE_URL
  ? SUPABASE_URL.replace('https://', '').split('.')[0]
  : null;

if (!PROJECT_REF) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL not set in environment');
  console.error('Please set this in your .env.local file');
  process.exit(1);
}

// The database password is the same as the one you set when creating the project
// You can find/reset it in: Project Settings > Database > Database password
// For now, we'll prompt the user

async function setupDatabase() {
  console.log('='.repeat(60));
  console.log('JobSilver Database Setup');
  console.log('='.repeat(60));
  console.log(`
To set up the database, you need your Supabase database password.

Find it at: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database

Look for "Database password" in the Connection String section.
`);

  // Read the password from command line argument
  const dbPassword = process.argv[2];

  if (!dbPassword) {
    console.log('Usage: node src/scripts/setup-db.js YOUR_DATABASE_PASSWORD');
    console.log('\nOr run the SQL manually:');
    console.log(`https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    process.exit(1);
  }

  const connectionString = `postgresql://postgres.${PROJECT_REF}:${dbPassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

  console.log('Connecting to database...');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Read schema SQL
    const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('Executing schema SQL...\n');

    // Execute the entire schema
    await client.query(schemaSql);

    console.log('✓ Database schema created successfully!\n');

    // Verify tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);

    console.log('Tables in database:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\nThe database password is incorrect.');
      console.log(`Find your password at: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database`);
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('\nCould not connect to database. Trying alternative region...');
    }
  } finally {
    await client.end();
  }
}

setupDatabase();
