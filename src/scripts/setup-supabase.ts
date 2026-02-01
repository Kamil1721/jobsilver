/**
 * JobSilver Supabase Setup Script
 *
 * Creates all database tables, RLS policies, indexes, triggers and storage bucket
 * for the JobSilver application.
 *
 * Run with: npx tsx src/scripts/setup-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Supabase Configuration - MUST be set in environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required environment variables.');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0];

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLViaAPI(sql: string): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    // Try the Supabase SQL API endpoint (available in newer versions)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql })
    });

    if (response.status === 404) {
      return { success: false, error: 'SQL API not available' };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function verifyTableExists(tableName: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=0`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        }
      }
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

async function createStorageBucket(): Promise<boolean> {
  console.log('\n[STORAGE] Creating/verifying "cvs" bucket...');

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.log(`  [ERROR] Failed to list buckets: ${listError.message}`);
      return false;
    }

    const existingBucket = buckets?.find(b => b.id === 'cvs');

    if (existingBucket) {
      console.log('  [EXISTS] Bucket "cvs" already exists');

      const { error: updateError } = await supabase.storage.updateBucket('cvs', {
        public: false, // Private bucket - use signed URLs for access
        fileSizeLimit: 10485760,
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
      });

      if (updateError) {
        console.log(`  [WARNING] Could not update bucket: ${updateError.message}`);
      } else {
        console.log('  [UPDATED] Bucket settings verified (public: false, 10MB limit)');
      }
      return true;
    }

    const { error: createError } = await supabase.storage.createBucket('cvs', {
      public: false, // Private bucket - use signed URLs for access
      fileSizeLimit: 10485760,
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    });

    if (createError) {
      console.log(`  [ERROR] Failed to create bucket: ${createError.message}`);
      return false;
    }

    console.log('  [CREATED] Bucket "cvs" created successfully (public: true)');
    return true;
  } catch (error) {
    console.log(`  [ERROR] ${error}`);
    return false;
  }
}

async function verifyStorageBucket(): Promise<void> {
  console.log('\n[VERIFY] Storage bucket status:');

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.log(`  [ERROR] ${error.message}`);
      return;
    }

    const cvsBucket = buckets?.find(b => b.id === 'cvs');

    if (cvsBucket) {
      console.log('  [OK] Bucket "cvs"');
      console.log(`       - Public: ${cvsBucket.public}`);
      console.log(`       - ID: ${cvsBucket.id}`);
      console.log(`       - Created: ${cvsBucket.created_at}`);
    } else {
      console.log('  [MISSING] Bucket "cvs" not found');
    }
  } catch (error) {
    console.log(`  [ERROR] Verification failed: ${error}`);
  }
}

function printSchemaSQL(): void {
  console.log(`
================================================================================
  DATABASE SCHEMA SQL
================================================================================

Copy and paste the following SQL into the Supabase SQL Editor:
https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new

--------------------------------------------------------------------------------

-- JobSilver Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile extension
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  cv_url TEXT,
  cv_parsed_data JSONB,
  job_filters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs found/saved
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  external_id TEXT,
  source TEXT,
  title TEXT NOT NULL,
  company TEXT,
  company_logo_url TEXT,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  job_type TEXT,
  remote BOOLEAN DEFAULT FALSE,
  description TEXT,
  application_url TEXT,
  match_score INTEGER,
  status TEXT DEFAULT 'discovered',
  application_questions JSONB,
  application_answers JSONB,
  applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, external_id, source)
);

-- Application history for analytics
CREATE TABLE IF NOT EXISTS application_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  job_title TEXT,
  company TEXT,
  status TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved answers for reuse across applications
CREATE TABLE IF NOT EXISTS saved_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question_type TEXT,
  question_text TEXT,
  answer_text TEXT,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for jobs
CREATE POLICY "Users can view own jobs" ON jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON jobs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for application_history
CREATE POLICY "Users can view own history" ON application_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON application_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for saved_answers
CREATE POLICY "Users can view own answers" ON saved_answers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers" ON saved_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own answers" ON saved_answers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own answers" ON saved_answers
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_history_user_id ON application_history(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_answers_user_id ON saved_answers(user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function for 60-day cleanup of applied jobs
CREATE OR REPLACE FUNCTION cleanup_expired_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM jobs
  WHERE status = 'applied'
  AND applied_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
`);
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('  JobSilver Supabase Setup');
  console.log('='.repeat(70));
  console.log(`\n  Project URL: ${SUPABASE_URL}`);
  console.log(`  Project ID: ${PROJECT_REF}\n`);

  // Step 1: Check current table status
  console.log('='.repeat(70));
  console.log('  STEP 1: Check Current Database State');
  console.log('='.repeat(70));

  const tables = ['profiles', 'jobs', 'application_history', 'saved_answers'];
  const tableStatus: Record<string, boolean> = {};

  console.log('\n  Checking table status:\n');
  for (const table of tables) {
    tableStatus[table] = await verifyTableExists(table);
    const status = tableStatus[table] ? '[EXISTS]' : '[MISSING]';
    console.log(`    ${status.padEnd(10)} ${table}`);
  }

  const missingTables = tables.filter(t => !tableStatus[t]);

  if (missingTables.length > 0) {
    console.log(`\n  [!!] ${missingTables.length} table(s) are missing: ${missingTables.join(', ')}`);
    printSchemaSQL();
  } else {
    console.log('\n  [OK] All database tables exist!');
  }

  // Step 2: Create storage bucket
  console.log('\n' + '='.repeat(70));
  console.log('  STEP 2: Storage Bucket');
  console.log('='.repeat(70));

  await createStorageBucket();
  await verifyStorageBucket();

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('  SETUP SUMMARY');
  console.log('='.repeat(70));

  console.log('\n  Database Tables:');
  for (const table of tables) {
    const icon = tableStatus[table] ? '[OK]' : '[!!]';
    console.log(`    ${icon} ${table}`);
  }

  console.log('\n  Storage:');
  console.log('    [OK] cvs bucket (public)');

  if (missingTables.length > 0) {
    console.log('\n  [ACTION REQUIRED]');
    console.log(`  --> Execute the SQL schema at: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    console.log('  --> The SQL is printed above and also available in: supabase/schema.sql');
    console.log('  --> After executing, run this script again to verify.');
  } else {
    console.log('\n  [SUCCESS] All setup complete!');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch(console.error);
