/**
 * Website Documentation for AI Assistant
 *
 * User-facing documentation only - no internal details, file paths,
 * database tables, or admin features.
 */

export const WEBSITE_HELP = {
  pages: {
    '/dashboard': {
      name: 'Dashboard',
      purpose: 'Track your job applications on a visual Kanban board',
      features: [
        'Three columns: NEW MATCHES (jobs found for you), APPLIED (jobs you applied to), OFFERS (jobs with offer status)',
        'Drag and drop jobs between columns to update their status',
        'Click any job card to view full details and apply',
        'Use the X button on cards to discard jobs you are not interested in',
        'Filter bar to narrow down jobs by keywords, location, job type, or remote status',
        'Bulk select mode for managing multiple jobs at once',
        'Jobs are automatically matched daily based on your preferences from Setup',
      ],
      proFeatures: [
        'Favorites filter to see only starred jobs',
        'Match percentage badges showing how well jobs fit your profile',
      ],
      tips: [
        'Jobs in NEW MATCHES are based on your preferences from the Setup page',
        'Move jobs to APPLIED after you submit applications on company websites',
        'Use OFFERS column for jobs where you received an offer',
      ],
    },

    '/profile': {
      name: 'Profile',
      purpose: 'Manage your account, CV, and subscription',
      tabs: {
        'Profile': 'Update your name, email, phone number, and location',
        'CV': 'Upload your CV as a PDF, DOCX, or TXT file (up to 10MB), or generate one with AI',
        'Preferences': 'Email notification settings for job alerts',
        'Subscription': 'View your current plan, manage billing, or upgrade to Pro',
      },
      features: [
        'Drag and drop CV upload with automatic parsing',
        'View extracted skills and experience from your CV',
        'Edit personal information used for job applications',
        'Download or regenerate your CV anytime',
      ],
      tips: [
        'Keep your CV up to date for better job matches',
        'Check the CV tab to verify parsing extracted your skills correctly',
      ],
    },

    '/setup': {
      name: 'Setup Wizard',
      purpose: 'Configure job search preferences for personalized matches',
      steps: [
        'Job Preferences: Set your target location, remote/hybrid/on-site preference, and job types (full-time, contract, etc.)',
        'Job Filters: Add keywords you want in job listings, set seniority level, exclude specific companies',
        'Screening: Personal details like availability, work authorization, and visa requirements',
        'Your CV: Upload your resume or let AI help generate one from your profile information',
        'Finalize: Review all settings and save your preferences',
      ],
      features: [
        'Match threshold slider to control how strictly jobs match your criteria',
        'Industry and company size filters (Pro feature)',
        'Salary range filters (Pro feature)',
        'Timezone preferences for remote work',
      ],
      tips: [
        'Complete all steps for the best job matches',
        'You can always come back and adjust these settings later',
        'More specific preferences lead to more relevant job matches',
      ],
    },

    '/choose-plan': {
      name: 'Choose Plan',
      purpose: 'Select or change your subscription plan',
      options: {
        'Free': 'Browse 3 jobs/day, track applications on Kanban board, no AI features',
        'Pro': '15 jobs/day, limited AI access (30 responses, 5 cover letters, 3 CV generations per day), daily emails',
        'Ultra': '35 jobs/day, unlimited AI access, daily emails, priority support',
      },
      features: [
        'Three-column comparison of Free, Pro, and Ultra features',
        'Weekly or monthly billing options',
        'Secure checkout through Stripe',
      ],
      tips: [
        'Pro includes a 3-day free trial to test AI features',
        'Ultra has no trial - immediate billing for unlimited access',
        'You can cancel anytime from your Profile settings',
      ],
    },

    '/pricing': {
      name: 'Pricing',
      purpose: 'Compare subscription plans and features',
      features: [
        'Toggle between weekly and monthly billing to see different prices',
        'Complete feature comparison table',
        'Frequently asked questions section',
        'Direct upgrade button',
      ],
      tips: [
        'Monthly billing offers savings compared to weekly',
        'Pro includes a 3-day free trial',
      ],
    },
  },

  workflows: {
    'Getting Started': [
      'Sign up on the login page with email or Google',
      'Choose Free or Pro plan (Pro has a 3-day trial)',
      'Complete the Setup Wizard to set your job preferences',
      'View your matched jobs on the Dashboard',
    ],
    'Applying to a Job': [
      'Click a job card on the Dashboard to view details',
      'Review the full job description and requirements',
      'Use the AI chat for help with cover letters or application questions (Pro)',
      'Click "Apply Now" to open the company\'s job posting',
      'Apply on the company\'s website',
      'Drag the job to the APPLIED column on your Dashboard',
    ],
    'Upgrading to Pro': [
      'Click any locked feature or go to Profile > Subscription',
      'Select Pro plan and choose weekly or monthly billing',
      'Complete checkout (includes 3-day free trial)',
      'Enjoy unlimited AI assistance and all Pro features',
    ],
    'Updating Your CV': [
      'Go to Profile and click the CV tab',
      'Drag and drop a new CV file or click to upload',
      'Wait for automatic parsing to extract your information',
      'Review the extracted skills and experience',
      'Edit any information that was parsed incorrectly',
    ],
    'Changing Job Preferences': [
      'Click Setup in the navigation menu',
      'Navigate through the sections using Next/Back buttons',
      'Update your location, job type, or other preferences',
      'Save your changes on the final step',
      'New job matches will appear on your Dashboard',
    ],
  },

  planComparison: {
    free: [
      'Price: Free forever',
      '3 jobs discovered per day',
      'Kanban board to track applications',
      'Save up to 50 jobs',
      'Basic job match scores',
      'Filter jobs by keyword, location, or type',
      'Manual apply to external job sites',
      'No AI features',
      'No email alerts',
    ],
    pro: [
      'Price: $3.99/week or $12.99/month',
      '3-day free trial included',
      '15 jobs discovered per day',
      '30 AI responses per day',
      '5 cover letters per day',
      '3 CV generations per day',
      'Save up to 200 jobs',
      'Favorite jobs feature',
      'Daily email alerts',
      'AI learns your preferences',
    ],
    ultra: [
      'Price: $6.99/week or $19.99/month',
      'No trial - immediate full access',
      '35 jobs discovered per day',
      'Unlimited AI chat assistance',
      'Unlimited cover letter generation',
      'Unlimited CV generations',
      'Unlimited saved jobs',
      'Favorite jobs feature',
      'Daily email alerts',
      'Priority support',
    ],
  },

  pricing: {
    free: {
      name: 'Free',
      price: '$0',
      billing: 'Free forever',
      jobsPerDay: 3,
      savedJobs: 50,
      aiAccess: false,
      emailAlerts: 'none',
    },
    pro: {
      name: 'Pro',
      weeklyPrice: '$3.99/week',
      monthlyPrice: '$12.99/month',
      trial: '3-day free trial',
      jobsPerDay: 15,
      savedJobs: 200,
      aiAccess: true,
      aiResponsesPerDay: 30,
      coverLettersPerDay: 5,
      cvGenerationsPerDay: 3,
      emailAlerts: 'daily',
      recommendation: 'Great for active job seekers',
    },
    ultra: {
      name: 'Ultra',
      weeklyPrice: '$6.99/week',
      monthlyPrice: '$19.99/month',
      trial: 'No trial',
      jobsPerDay: 35,
      savedJobs: -1, // unlimited
      aiAccess: true,
      aiResponsesPerDay: -1, // unlimited
      coverLettersPerDay: -1,
      cvGenerationsPerDay: -1,
      emailAlerts: 'daily',
      prioritySupport: true,
      recommendation: 'Best for power users who want unlimited AI',
    },
  },

  commonQuestions: {
    'How does job matching work?': 'JobSilver searches multiple job boards and matches listings to your preferences set in the Setup wizard. Jobs that match your criteria appear in the NEW MATCHES column on your Dashboard.',
    'Can JobSilver apply to jobs for me?': 'No, JobSilver helps you find and track jobs, but you apply directly on company websites. The AI can help you write cover letters and answer application questions.',
    'How do I cancel my subscription?': 'Go to Profile > Subscription and click Manage Subscription. You can cancel anytime and keep access until the end of your billing period.',
    'Is my data secure?': 'Yes, your data is encrypted and stored securely. We never share your personal information with employers without your action.',
    'How do I report a problem?': 'Look for the orange flag icon in the bottom-left corner of the screen. Click it to open the Report dialog. Choose a report type: (1) Incorrect Questions - if application questions are wrong or missing, (2) Incorrect Description - if the job description does not match the actual posting, (3) Bug Report - if something is not working as expected, (4) Suggestion - for feature requests or improvement ideas, (5) Other - for anything else. Add a title and detailed description, then click Submit. Your page URL and browser info are automatically included to help us debug.',
    'Who do I contact for support?': 'For any issues or questions, you can: (1) Click the orange flag icon in the bottom-left corner to submit a report, (2) Email us directly at jobsilver50@gmail.com, (3) Visit the Contact page at /contact, or (4) Use this AI chat to report bugs - just describe the issue and I can submit a bug report for you.',
    'How do I contact JobSilver?': 'Email us at jobsilver50@gmail.com or visit the Contact page from the footer. We typically respond within 24-48 hours.',
    'What is the orange flag button?': 'The orange flag icon in the bottom-left corner opens the Report Problem dialog. Use it to report incorrect job info, bugs, or submit suggestions. Choose from: Incorrect Questions, Incorrect Description, Bug Report, Suggestion, or Other. Fill in a title and description, and we will review your report.',
    'How do I get more job matches?': 'Update your preferences in the Setup wizard. Adding more target job titles, expanding location options, or adjusting your match threshold can increase matches.',
    'What file formats are supported for CV upload?': 'PDF, DOCX, and TXT files up to 10MB are supported.',
    'How much does Pro cost?': 'Pro costs $3.99 per week or $12.99 per month. Monthly billing saves you about 25% compared to weekly. Pro includes a 3-day free trial with 15 jobs/day and limited AI access (30 responses, 5 cover letters, 3 CV generations per day).',
    'How much does Ultra cost?': 'Ultra costs $6.99 per week or $19.99 per month. Ultra has no trial and provides immediate access to 35 jobs/day, unlimited AI features, and priority support.',
    'Which plan should I choose?': 'Free is great for casual browsing. Pro ($3.99/week) is good for active job seekers who want AI help but can work within daily limits. Ultra ($6.99/week) is best for power users who want unlimited AI and priority support.',
    'What is the difference between Pro and Ultra?': 'Pro gives you 15 jobs/day and limited AI (30 responses, 5 cover letters, 3 CV generations per day) with daily email alerts. Ultra gives you 35 jobs/day, unlimited AI, daily email alerts, and priority support.',
  },
}

/**
 * Get help documentation for a specific page
 * Note: Only pages in WEBSITE_HELP.pages are supported (dashboard, profile, setup, choose-plan, pricing)
 * Job detail pages (/jobs/[id]) have their own embedded AI chat and don't use this function
 */
export function getHelpForPage(pathname: string | null): string {
  if (!pathname) return ''

  const pageInfo = WEBSITE_HELP.pages[pathname as keyof typeof WEBSITE_HELP.pages]
  if (!pageInfo) return ''

  let help = `## Current Page: ${pageInfo.name}\n`
  help += `${pageInfo.purpose}\n\n`

  if ('features' in pageInfo && pageInfo.features) {
    help += `**Features:**\n`
    pageInfo.features.forEach((f: string) => {
      help += `- ${f}\n`
    })
    help += '\n'
  }

  if ('tabs' in pageInfo && pageInfo.tabs) {
    help += `**Tabs:**\n`
    Object.entries(pageInfo.tabs).forEach(([tab, desc]) => {
      help += `- **${tab}**: ${desc}\n`
    })
    help += '\n'
  }

  if ('steps' in pageInfo && pageInfo.steps) {
    help += `**Steps:**\n`
    pageInfo.steps.forEach((step: string, i: number) => {
      help += `${i + 1}. ${step}\n`
    })
    help += '\n'
  }

  if ('options' in pageInfo && pageInfo.options) {
    help += `**Plan Options:**\n`
    Object.entries(pageInfo.options).forEach(([plan, desc]) => {
      help += `- **${plan}**: ${desc}\n`
    })
    help += '\n'
  }

  if ('proFeatures' in pageInfo && pageInfo.proFeatures) {
    help += `**Pro Features on this page:**\n`
    pageInfo.proFeatures.forEach((f: string) => {
      help += `- ${f}\n`
    })
    help += '\n'
  }

  if ('tips' in pageInfo && pageInfo.tips) {
    help += `**Tips:**\n`
    pageInfo.tips.forEach((tip: string) => {
      help += `- ${tip}\n`
    })
  }

  return help
}

/**
 * Get general help including workflows and Free vs Pro comparison
 */
export function getGeneralHelp(): string {
  let help = ''

  // Workflows
  help += `## Common Workflows\n\n`
  Object.entries(WEBSITE_HELP.workflows).forEach(([name, steps]) => {
    help += `**${name}:**\n`
    steps.forEach((step, i) => {
      help += `${i + 1}. ${step}\n`
    })
    help += '\n'
  })

  // Pricing
  help += `## Pricing\n\n`
  help += `**Free Plan:** $0 - Free forever\n`
  help += `- 3 jobs discovered per day\n`
  help += `- Kanban tracking board\n`
  help += `- Save up to 50 jobs\n`
  help += `- No AI features\n\n`
  help += `**Pro Plan:** $3.99/week or $12.99/month (save ~25% with monthly)\n`
  help += `- Includes 3-day free trial\n`
  help += `- 15 jobs discovered per day\n`
  help += `- 30 AI responses per day\n`
  help += `- 5 cover letters per day\n`
  help += `- 3 CV generations per day\n`
  help += `- Save up to 200 jobs\n`
  help += `- Daily email alerts\n\n`
  help += `**Ultra Plan:** $6.99/week or $19.99/month\n`
  help += `- No trial - immediate full access\n`
  help += `- 35 jobs discovered per day\n`
  help += `- Unlimited AI assistance\n`
  help += `- Unlimited cover letters\n`
  help += `- Unlimited CV generations\n`
  help += `- Unlimited saved jobs\n`
  help += `- Daily email alerts\n`
  help += `- Priority support\n\n`
  help += `**Recommendation:** Free for casual browsing, Pro for active job seekers with AI help, Ultra for power users who want unlimited AI.\n\n`

  // Plan comparison detailed features
  help += `## Detailed Feature Comparison\n\n`
  help += `**Free Plan includes:**\n`
  WEBSITE_HELP.planComparison.free.forEach(f => {
    help += `- ${f}\n`
  })
  help += `\n**Pro Plan includes:**\n`
  WEBSITE_HELP.planComparison.pro.forEach(f => {
    help += `- ${f}\n`
  })
  help += `\n**Ultra Plan includes:**\n`
  WEBSITE_HELP.planComparison.ultra.forEach(f => {
    help += `- ${f}\n`
  })

  // Common questions
  help += `\n## Frequently Asked Questions\n\n`
  Object.entries(WEBSITE_HELP.commonQuestions).forEach(([q, a]) => {
    help += `**${q}**\n${a}\n\n`
  })

  return help
}

// Note: Page suggestions are defined in ChatPanel.tsx PAGE_CONTEXT_HINTS
// to keep frontend UI concerns separate from documentation content
