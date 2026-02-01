/**
 * Test Script for fantastic.jobs API Integration
 *
 * Run with: npx tsx src/scripts/test-fantasticjobs.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import {
  searchJobs,
  mapFantasticJobToJob,
  mapJobTypeToEmploymentType,
  mapSeniorityToExperienceLevel,
  mapRemoteToWorkArrangement,
  isSpamJob,
  isJobFresh,
  validateJobLocation,
  isWorldwideRemote,
} from '../lib/api/fantasticjobs'

async function testAPI() {
  console.log('='.repeat(60))
  console.log('FANTASTIC.JOBS API TEST (Active Jobs DB)')
  console.log('='.repeat(60))

  // Check for API key
  if (!process.env.RAPIDAPI_KEY) {
    console.error('❌ RAPIDAPI_KEY is not set in .env.local')
    process.exit(1)
  }
  console.log('✓ RAPIDAPI_KEY is set')

  // Test 1: Basic search
  console.log('\n' + '-'.repeat(40))
  console.log('TEST 1: Basic search for "Software Engineer"')
  console.log('-'.repeat(40))

  try {
    const jobs = await searchJobs({
      title_filter: 'Software Engineer',
      limit: 10,
    })

    console.log(`✓ API returned ${jobs.length} jobs`)

    if (jobs.length > 0) {
      console.log('\nSample job:')
      const sample = jobs[0]
      console.log(`  Title: ${sample.title}`)
      console.log(`  Company: ${sample.organization}`)
      console.log(`  Countries: ${sample.countries_derived?.join(', ') || 'N/A'}`)
      console.log(`  Date Posted: ${sample.date_posted}`)
      console.log(`  AI Work Arrangement: ${sample.ai_work_arrangement || 'N/A'}`)
      console.log(`  AI Employment Type: ${sample.ai_employment_type?.join(', ') || 'N/A'}`)
      console.log(`  Has URL: ${!!sample.url}`)
      console.log(`  Source: ${sample.source}`)
    }
  } catch (error) {
    console.error('❌ Basic search failed:', error)
    process.exit(1)
  }

  // Test 2: Remote-only search
  console.log('\n' + '-'.repeat(40))
  console.log('TEST 2: Remote-only search')
  console.log('-'.repeat(40))

  try {
    const remoteJobs = await searchJobs({
      title_filter: 'Developer',
      limit: 10,
      ai_work_arrangement_filter: 'Remote Solely',
    })

    console.log(`✓ API returned ${remoteJobs.length} remote jobs`)

    // Check how many are actually remote
    const fullyRemote = remoteJobs.filter(j =>
      j.ai_work_arrangement === 'Remote Solely' ||
      j.ai_work_arrangement === 'Remote OK'
    ).length
    console.log(`  AI-confirmed remote: ${fullyRemote}/${remoteJobs.length}`)
  } catch (error) {
    console.error('❌ Remote search failed:', error)
  }

  // Test 3: Experience level filter
  console.log('\n' + '-'.repeat(40))
  console.log('TEST 3: Senior-level search (5-10 years)')
  console.log('-'.repeat(40))

  try {
    const seniorJobs = await searchJobs({
      title_filter: 'Engineer',
      limit: 10,
      ai_experience_level_filter: '5-10',
    })

    console.log(`✓ API returned ${seniorJobs.length} senior-level jobs`)

    if (seniorJobs.length > 0) {
      console.log('  Sample titles:')
      seniorJobs.slice(0, 3).forEach(j => console.log(`    - ${j.title} (${j.ai_experience_level || 'N/A'})`))
    }
  } catch (error) {
    console.error('❌ Experience level search failed:', error)
  }

  // Test 4: Location search
  console.log('\n' + '-'.repeat(40))
  console.log('TEST 4: Location-specific search (Poland)')
  console.log('-'.repeat(40))

  try {
    const polandJobs = await searchJobs({
      title_filter: 'Developer',
      location_filter: 'Poland',
      limit: 10,
    })

    console.log(`✓ API returned ${polandJobs.length} jobs in Poland`)

    if (polandJobs.length > 0) {
      console.log('  Sample locations:')
      polandJobs.slice(0, 3).forEach(j => {
        const loc = j.locations_derived?.[0]
        console.log(`    - ${loc?.city || 'N/A'}, ${loc?.country || 'N/A'}`)
      })
    }
  } catch (error) {
    console.error('❌ Location search failed:', error)
  }

  // Test 5: Mapper function
  console.log('\n' + '-'.repeat(40))
  console.log('TEST 5: Job mapper function')
  console.log('-'.repeat(40))

  try {
    const jobs = await searchJobs({
      title_filter: 'Software Engineer',
      limit: 1,
    })

    if (jobs.length > 0) {
      const mapped = mapFantasticJobToJob(jobs[0], 'test-user-id')
      console.log('✓ Mapped job:')
      console.log(`  ID: ${mapped.id}`)
      console.log(`  Title: ${mapped.title}`)
      console.log(`  Company: ${mapped.company}`)
      console.log(`  Location: ${mapped.location}`)
      console.log(`  Remote: ${mapped.remote}`)
      console.log(`  Remote Type: ${mapped.remote_type}`)
      console.log(`  Source: ${mapped.source}`)
      console.log(`  ATS Source: ${mapped.ats_source}`)
      console.log(`  Application URL: ${mapped.application_url?.slice(0, 50)}...`)
    }
  } catch (error) {
    console.error('❌ Mapper test failed:', error)
  }

  // Test 6: Filter mappers
  console.log('\n' + '-'.repeat(40))
  console.log('TEST 6: Filter mapper functions')
  console.log('-'.repeat(40))

  const jobType = mapJobTypeToEmploymentType(['fulltime', 'contractor'])
  console.log(`  Job type filter: ['fulltime', 'contractor'] -> ${jobType}`)

  const experience = mapSeniorityToExperienceLevel(['mid-senior', 'director'])
  console.log(`  Experience filter: ['mid-senior', 'director'] -> ${experience}`)

  const workArrangement = mapRemoteToWorkArrangement(true, false)
  console.log(`  Work arrangement (remote=true, hybrid=false): ${workArrangement}`)

  console.log('\n' + '='.repeat(60))
  console.log('✅ ALL TESTS COMPLETED')
  console.log('='.repeat(60))
}

// Run tests
testAPI().catch(console.error)
