# Graph Report - .  (2026-05-21)

## Corpus Check
- 340 files · ~279,265 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1828 nodes · 4006 edges · 100 communities (91 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.82)
- Token cost: 93,000 input · 3,143 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Plans & AI Usage Tracking|Plans & AI Usage Tracking]]
- [[_COMMUNITY_Chat State & Events|Chat State & Events]]
- [[_COMMUNITY_Job Card UI & Utils|Job Card UI & Utils]]
- [[_COMMUNITY_Dashboard Page & UI Primitives|Dashboard Page & UI Primitives]]
- [[_COMMUNITY_API Validation & Routes|API Validation & Routes]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_Email Notification Routes|Email Notification Routes]]
- [[_COMMUNITY_Rate Limiting & Feature Access|Rate Limiting & Feature Access]]
- [[_COMMUNITY_Setup Wizard Form Steps|Setup Wizard Form Steps]]
- [[_COMMUNITY_CV PDF Generation|CV PDF Generation]]
- [[_COMMUNITY_Landing Page UI|Landing Page UI]]
- [[_COMMUNITY_Subscription Context & Feature Gate|Subscription Context & Feature Gate]]
- [[_COMMUNITY_Account & Subscription Pages|Account & Subscription Pages]]
- [[_COMMUNITY_Announcements & Notifications|Announcements & Notifications]]
- [[_COMMUNITY_Public Pages & Footer|Public Pages & Footer]]
- [[_COMMUNITY_Audit Logging & Admin Routes|Audit Logging & Admin Routes]]
- [[_COMMUNITY_Interaction Tracking|Interaction Tracking]]
- [[_COMMUNITY_Supabase Server Client|Supabase Server Client]]
- [[_COMMUNITY_Adzuna Job Source|Adzuna Job Source]]
- [[_COMMUNITY_CV Upload & Rate Limit|CV Upload & Rate Limit]]
- [[_COMMUNITY_Fantastic.jobs Source|Fantastic.jobs Source]]
- [[_COMMUNITY_ATS Search & Question Scraping|ATS Search & Question Scraping]]
- [[_COMMUNITY_Animation Definitions|Animation Definitions]]
- [[_COMMUNITY_Remotive Job Source|Remotive Job Source]]
- [[_COMMUNITY_Preference Learning|Preference Learning]]
- [[_COMMUNITY_Chat Panel Components|Chat Panel Components]]
- [[_COMMUNITY_TheMuse Job Source|TheMuse Job Source]]
- [[_COMMUNITY_Layout & Theme Toggle|Layout & Theme Toggle]]
- [[_COMMUNITY_Setup Wizard & Filter Validation|Setup Wizard & Filter Validation]]
- [[_COMMUNITY_Search Route & Query Prep|Search Route & Query Prep]]
- [[_COMMUNITY_Multi-Source ATS Search|Multi-Source ATS Search]]
- [[_COMMUNITY_Dialog Components|Dialog Components]]
- [[_COMMUNITY_Job Matching Route|Job Matching Route]]
- [[_COMMUNITY_Ashby Job Source|Ashby Job Source]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Job Preferences Step|Job Preferences Step]]
- [[_COMMUNITY_Layout Provider & Cookie Consent|Layout Provider & Cookie Consent]]
- [[_COMMUNITY_Preference Scoring|Preference Scoring]]
- [[_COMMUNITY_Arbeitnow Job Source|Arbeitnow Job Source]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Greenhouse Job Source|Greenhouse Job Source]]
- [[_COMMUNITY_Pricing & Plan Selection|Pricing & Plan Selection]]
- [[_COMMUNITY_Lever Job Source|Lever Job Source]]
- [[_COMMUNITY_Fonts & AI Chat Components|Fonts & AI Chat Components]]
- [[_COMMUNITY_Toast Hook|Toast Hook]]
- [[_COMMUNITY_Project Overview Docs|Project Overview Docs]]
- [[_COMMUNITY_shadcn Components Config|shadcn Components Config]]
- [[_COMMUNITY_Remotion Video Players|Remotion Video Players]]
- [[_COMMUNITY_Remotion Demo Colors|Remotion Demo Colors]]
- [[_COMMUNITY_Stripe Webhook Handler|Stripe Webhook Handler]]
- [[_COMMUNITY_Changelog & Pivot History|Changelog & Pivot History]]
- [[_COMMUNITY_Metallic UI Styles|Metallic UI Styles]]
- [[_COMMUNITY_Query Generation & Cache|Query Generation & Cache]]
- [[_COMMUNITY_Multi-Source Search Coordination|Multi-Source Search Coordination]]
- [[_COMMUNITY_Description Formatting|Description Formatting]]
- [[_COMMUNITY_Remotion Kanban Demo|Remotion Kanban Demo]]
- [[_COMMUNITY_Vercel Config & Crons|Vercel Config & Crons]]
- [[_COMMUNITY_Toast UI Components|Toast UI Components]]
- [[_COMMUNITY_Tech Stack Concepts|Tech Stack Concepts]]
- [[_COMMUNITY_Company Discovery Strategy|Company Discovery Strategy]]
- [[_COMMUNITY_Package Scripts|Package Scripts]]
- [[_COMMUNITY_CV Generation Python API|CV Generation Python API]]
- [[_COMMUNITY_Application Architecture Doc|Application Architecture Doc]]
- [[_COMMUNITY_Remotion Apply Button Demo|Remotion Apply Button Demo]]
- [[_COMMUNITY_Adzuna Integration Spec|Adzuna Integration Spec]]
- [[_COMMUNITY_Supabase Setup Script|Supabase Setup Script]]
- [[_COMMUNITY_Location Normalization|Location Normalization]]
- [[_COMMUNITY_CV Text Extraction|CV Text Extraction]]
- [[_COMMUNITY_Cron Cleanup Route|Cron Cleanup Route]]
- [[_COMMUNITY_AI Usage Hook|AI Usage Hook]]
- [[_COMMUNITY_Lazy Video Players|Lazy Video Players]]
- [[_COMMUNITY_Supabase Email Templates|Supabase Email Templates]]
- [[_COMMUNITY_Video Section & Motion|Video Section & Motion]]
- [[_COMMUNITY_Admin Middleware|Admin Middleware]]
- [[_COMMUNITY_DB Setup Script|DB Setup Script]]
- [[_COMMUNITY_Remotion Job Tracking Demo|Remotion Job Tracking Demo]]
- [[_COMMUNITY_Remotion Smart Filters Demo|Remotion Smart Filters Demo]]
- [[_COMMUNITY_Setup Verification Script|Setup Verification Script]]
- [[_COMMUNITY_Timezone Mapping|Timezone Mapping]]
- [[_COMMUNITY_Table Creation Script|Table Creation Script]]
- [[_COMMUNITY_Full Setup Verification|Full Setup Verification]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_pdf-parse Type Defs|pdf-parse Type Defs]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 111 edges
2. `checkRateLimit()` - 90 edges
3. `getClientIdentifier()` - 56 edges
4. `getRateLimitHeaders()` - 54 edges
5. `createServiceClient()` - 53 edges
6. `createClient()` - 48 edges
7. `useToast()` - 35 edges
8. `Button` - 33 edges
9. `canAccessFeature()` - 30 edges
10. `POST()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Adzuna Job Search API` --semantically_similar_to--> `fantastic.jobs`  [INFERRED] [semantically similar]
  docs/requirements/adzuna-api-integration.md → README.md
- `Subscription Plans (Legacy 4-Tier)` --semantically_similar_to--> `3-Tier Pricing Model`  [INFERRED] [semantically similar]
  docs/research/application-system-architecture.md → README.md
- `cn()` --calls--> `clsx`  [INFERRED]
  src/lib/utils.ts → package.json
- `Research Brief: Scaling Company Database to 500+` --references--> `JobSilver`  [INFERRED]
  docs/research/company-discovery-strategies.md → README.md
- `JobSilver Changelog` --references--> `JobSilver`  [INFERRED]
  docs/changelog.md → README.md

## Hyperedges (group relationships)
- **ATS Public API Integrations** — readme_greenhouse, readme_lever, readme_ashby, company_discovery_strategies_board_token_validation [EXTRACTED 0.90]
- **Auto-Apply Processing Pipeline** — application_system_architecture_auto_apply_modes, application_system_architecture_auto_apply_state_machine, application_system_architecture_quota_system, application_system_architecture_scraping_flow [EXTRACTED 0.90]
- **Supabase Auth Email Template Set** — email_templates_confirm_signup, email_templates_invite_user, email_templates_change_email, email_templates_magic_link [EXTRACTED 0.90]

## Communities (100 total, 9 thin omitted)

### Community 0 - "Plans & AI Usage Tracking"
Cohesion: 0.05
Nodes (65): formatPreferencesForAI(), AIFeature, canUseAI(), CanUseAIResult, CanUseFeatureResult, checkCanUseFeature(), checkNearLimits(), DailyUsageStats (+57 more)

### Community 1 - "Chat State & Events"
Cohesion: 0.05
Nodes (47): ChatMessage, ChatResponse, createCoverLetterDoc(), downloadCoverLetter(), ChatProviderProps, VALID_PAGE_PATHNAMES, ValidPathname, QuickAction (+39 more)

### Community 2 - "Job Card UI & Utils"
Cohesion: 0.06
Nodes (43): JobAIChat(), JobAIChatProps, Message, AIUsage, UsageDetails(), UsageIndicator(), UsageIndicatorProps, JobCardProps (+35 more)

### Community 3 - "Dashboard Page & UI Primitives"
Cohesion: 0.07
Nodes (41): DOWNGRADE_REASONS, formatPeriodEndDate(), getLostFeatures(), mapPlanToFeatureKey(), PLAN_FEATURE_DISPLAY, PlanChangeDialog(), PlanChangeDialogProps, PlanFeatureKey (+33 more)

### Community 4 - "API Validation & Routes"
Cohesion: 0.09
Nodes (48): AdminAuthResult, checkAdminAuth(), getAdminEmails(), getRedactedAdminEmails(), isAdminEmail(), announcementTypeSchema, createAnnouncementSchema, DELETE() (+40 more)

### Community 5 - "NPM Dependencies"
Cohesion: 0.04
Nodes (52): dependencies, adm-zip, @adobe/pdfservices-node-sdk, ai, class-variance-authority, clsx, crypto-js, @dnd-kit/core (+44 more)

### Community 6 - "Email Notification Routes"
Cohesion: 0.09
Nodes (40): applyTesterInvite(), GET(), authenticateCronRequest(), curateJobsForUser(), CurationSummary, fetchAndCurateJobs(), fetchJobsFromSearch(), GET() (+32 more)

### Community 7 - "Rate Limiting & Feature Access"
Cohesion: 0.12
Nodes (41): ANNOUNCEMENTS_RATE_LIMIT, GET(), VALID_PLANS, getUserPreferences(), GET(), GET(), POST(), GET() (+33 more)

### Community 8 - "Setup Wizard Form Steps"
Cohesion: 0.07
Nodes (35): AdminPage(), DEGREE_OPTIONS, DEGREE_REGIONS, DegreeCombobox(), EducationEntry, EducationSectionProps, EMPTY_ENTRY, SKILL_PRESETS (+27 more)

### Community 9 - "CV PDF Generation"
Cohesion: 0.07
Nodes (34): generateBasicTailoredContent(), JobContext, openai, shouldUseAITailoring(), tailorCVForJob(), TailoredContent, mapParsedCVToScreeningAnswers(), MappingResult (+26 more)

### Community 10 - "Landing Page UI"
Cohesion: 0.06
Nodes (29): metadata, AIDemoEmbed(), FeatureVideoPlayer, AIDemoSection(), AmbientBackground(), copperBoxShadow, CopperButton(), CopperButtonProps (+21 more)

### Community 11 - "Subscription Context & Feature Gate"
Cohesion: 0.07
Nodes (33): UpgradeModal(), SubscriptionContext, SubscriptionContextValue, SubscriptionData, SubscriptionProvider(), SubscriptionProviderProps, useSubscription(), FavoriteButton() (+25 more)

### Community 12 - "Account & Subscription Pages"
Cohesion: 0.08
Nodes (36): ReportStats, Tester, TesterInvite, TesterInviteStatus, TesterStats, User, UserReport, PLAN_DETAILS (+28 more)

### Community 13 - "Announcements & Notifications"
Cohesion: 0.05
Nodes (40): AnnouncementBanner(), AnnouncementBannerProps, DismissedRecord, getTypeStyles(), ActiveAnnouncement, AdminAuditLogWithAdmin, AIUsageStats, AIUsageWithLimits (+32 more)

### Community 14 - "Public Pages & Footer"
Cohesion: 0.06
Nodes (17): PublicFooter(), PublicFooterProps, metadata, FAQ_CATEGORIES, FAQItem(), BillingCycle, FAQ_ITEMS, FAQItem() (+9 more)

### Community 15 - "Audit Logging & Admin Routes"
Cohesion: 0.09
Nodes (32): checkoutRequestSchema, getBaseUrl(), POST(), DELETE(), DowngradeReason, getStripeErrorMessage(), POST(), VALID_REASONS (+24 more)

### Community 16 - "Interaction Tracking"
Cohesion: 0.09
Nodes (26): getJobInteractionHistory(), getUserInteractionStats(), lastComputeTime, shouldTriggerRecompute(), trackInteractionAndLearn(), trackInteractionsBatch(), GET(), safeCompare() (+18 more)

### Community 17 - "Supabase Server Client"
Cohesion: 0.09
Nodes (18): GET(), GET(), FEATURE_REQUIREMENTS, formatPlanName(), getRequiredPlan(), PLAN_HIERARCHY, SUBSCRIPTION_PLAN_HIERARCHY, GET() (+10 more)

### Community 18 - "Adzuna Job Source"
Cohesion: 0.09
Nodes (23): ADZUNA_COUNTRIES, ADZUNA_COUNTRY_CURRENCY, AdzunaApiError, AdzunaCountry, AdzunaJob, AdzunaRateLimitError, AdzunaResponse, AdzunaSearchParams (+15 more)

### Community 19 - "CV Upload & Rate Limit"
Cohesion: 0.11
Nodes (19): extractTextFromFile(), parseCV(), POST(), POST(), checkRateLimitDistributed(), checkRateLimitInMemory(), InternalAuthOptions, InternalAuthResult (+11 more)

### Community 20 - "Fantastic.jobs Source"
Cohesion: 0.11
Nodes (25): ApiUsageInfo, checkGlobalQuota(), COMPANY_SIZE_RANGES, EmploymentTypeFilter, FantasticJobsJob, FantasticJobsResponse, FantasticJobsSearchParams, INDUSTRY_KEYWORDS (+17 more)

### Community 21 - "ATS Search & Question Scraping"
Cohesion: 0.11
Nodes (20): parseAshbyUrl(), ASHBY_BOARDS, AshbyCompany, ATS_STATS, findCompanyByName(), GREENHOUSE_BOARDS, GreenhouseCompany, LEVER_COMPANIES (+12 more)

### Community 22 - "Animation Definitions"
Cohesion: 0.08
Nodes (23): buttonPress, cardHover, expandAnimation, fadeIn, fadeInUp, fastTransition, modalAnimation, overlayAnimation (+15 more)

### Community 23 - "Remotive Job Source"
Cohesion: 0.10
Nodes (18): fetchWithRetry(), isJobAvailableInCountry(), mapRemotiveJobToJob(), parseLocationRequirement(), parseSalary(), REMOTIVE_CATEGORIES, RemotiveApiError, RemotiveCategory (+10 more)

### Community 24 - "Preference Learning"
Cohesion: 0.11
Nodes (22): AggregatedPreferences, aggregatePreferences(), computeConfidence(), computeUserPreferences(), CONFIDENCE_THRESHOLDS, ExtractedFeatures, extractJobFeatures(), extractKeywords() (+14 more)

### Community 25 - "Chat Panel Components"
Cohesion: 0.12
Nodes (18): ChatButton(), ChatHeader(), ChatPanel(), ChatPanelProps, getPageContext(), PAGE_CONTEXT_HINTS, ChatProvider(), MessageInput() (+10 more)

### Community 26 - "TheMuse Job Source"
Cohesion: 0.11
Nodes (19): fetchWithRetry(), getJobDetails(), mapTheMuseJobToJob(), sanitizeString(), searchJobs(), searchJobsMultiCategory(), sleep(), THEMUSE_CATEGORIES (+11 more)

### Community 27 - "Layout & Theme Toggle"
Cohesion: 0.15
Nodes (17): ChatHeaderProps, ThemeToggle(), useTheme(), DashboardLayout(), SystemMessage, Avatar, AvatarFallback, AvatarImage (+9 more)

### Community 28 - "Setup Wizard & Filter Validation"
Cohesion: 0.12
Nodes (16): FilterValidationError, FilterValidationResult, getMissingScreeningFields(), isMandatoryScreeningFieldValid(), validateMandatoryFilters(), validateScreeningAnswers(), ValidationError, ValidationResult (+8 more)

### Community 29 - "Search Route & Query Prep"
Cohesion: 0.15
Nodes (21): getUserLearnedPreferences(), injectDiversity(), mergeExplicitWithLearnedPreferences(), getQueriesForAPI(), getCompanySizeCategory(), mapIndustriesToTaxonomyFilter(), mapWorkArrangementsToFilter(), computeProfileHash() (+13 more)

### Community 30 - "Multi-Source ATS Search"
Cohesion: 0.16
Nodes (22): searchAshbyJobs(), getAshbyBoards(), getGreenhouseBoards(), getLeverCompanies(), searchGreenhouseJobs(), searchLeverJobs(), searchATSJobs(), createJobFingerprint() (+14 more)

### Community 31 - "Dialog Components"
Cohesion: 0.15
Nodes (18): UpgradeModalEventDetail, COUNTRY_PHONE_CODES, CVGeneratorDialog(), CVGeneratorDialogProps, EducationEntry, getPhoneCodeFromCountry(), WorkHistoryEntry, JobContext (+10 more)

### Community 32 - "Job Matching Route"
Cohesion: 0.14
Nodes (18): calculateJobMatch(), CVData, FiltersData, generateApplicationQuestions(), MatchResult, openai, sanitizeForAIPrompt(), ScreeningData (+10 more)

### Community 33 - "Ashby Job Source"
Cohesion: 0.12
Nodes (18): AshbyCompensation, AshbyDepartment, AshbyFormField, AshbyJobBoardInfo, AshbyJobPosting, AshbyJobPostingInfoResponse, AshbyJobPostingListItem, AshbyJobPostingsResponse (+10 more)

### Community 34 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 35 - "Job Preferences Step"
Cohesion: 0.12
Nodes (12): INDUSTRY_CATEGORIES, JOB_TITLES_BY_INDUSTRY, DEFAULT_JOB_FILTERS, CATEGORY_ORDER, COUNTRIES, INDUSTRIES, INDUSTRIES_BY_CATEGORY, JOB_TYPES (+4 more)

### Community 36 - "Layout Provider & Cookie Consent"
Cohesion: 0.14
Nodes (12): fraunces, inter, metadata, ConsentStatus, CookieConsent, CookieConsentBanner(), ThemeProvider(), ThemeProviderProps (+4 more)

### Community 37 - "Preference Scoring"
Cohesion: 0.18
Nodes (17): CATEGORY_WEIGHTS, computeFinalJobScore(), computePreferenceScore(), CONFIDENCE_INFLUENCE, extractKeywords(), FinalScoreResult, PreferenceScoreResult, scoreCompanyMatch() (+9 more)

### Community 38 - "Arbeitnow Job Source"
Cohesion: 0.15
Nodes (13): ArbeitnowApiError, ArbeitnowJob, ArbeitnowRateLimitError, ArbeitnowResponse, ArbeitnowSearchParams, ArbeitnowTimeoutError, fetchWithRetry(), mapArbeitnowJobToJob() (+5 more)

### Community 39 - "Dev Dependencies"
Cohesion: 0.12
Nodes (17): devDependencies, autoprefixer, eslint, eslint-config-next, pg, postcss, sharp, tailwindcss (+9 more)

### Community 40 - "Greenhouse Job Source"
Cohesion: 0.15
Nodes (13): detectRemoteType(), fetchGreenhouseJobWithQuestions(), getGreenhouseJob(), GreenhouseBoardInfo, GreenhouseDepartment, GreenhouseJob, GreenhouseJobsResponse, GreenhouseLocation (+5 more)

### Community 41 - "Pricing & Plan Selection"
Cohesion: 0.17
Nodes (10): ChoosePlanPageContent(), DowngradeReason, PRICING_PLANS, PricingCard(), PricingCardProps, PricingFeature, PricingPlan, BillingCycle (+2 more)

### Community 42 - "Lever Job Source"
Cohesion: 0.17
Nodes (14): buildDescription(), detectRemoteType(), fetchLeverPostings(), fetchLeverPostingsByGroup(), LeverApplicationForm, LeverCategory, LeverCustomQuestion, LeverFormField (+6 more)

### Community 43 - "Fonts & AI Chat Components"
Cohesion: 0.19
Nodes (10): AIChatPanel(), AIChatPanelProps, Message, ChatMessage(), ChatMessageProps, MatchScoreBadgeProps, TypewriterText(), TypewriterTextProps (+2 more)

### Community 44 - "Toast Hook"
Cohesion: 0.17
Nodes (14): Action, ActionType, actionTypes, addToRemoveQueue(), clearToastState(), dispatch(), genId(), listeners (+6 more)

### Community 45 - "Project Overview Docs"
Cohesion: 0.15
Nodes (14): API Quota Optimization, Global Quota Guard in fantasticjobs.ts, rendercv, generate-cv Python Requirements, generate-cv Python 3.12 Runtime, Ashby ATS, Vercel Cron Jobs, Daily Curation Flow (+6 more)

### Community 46 - "shadcn Components Config"
Cohesion: 0.14
Nodes (13): aliases, components, utils, rsc, $schema, style, tailwind, baseColor (+5 more)

### Community 47 - "Remotion Video Players"
Cohesion: 0.15
Nodes (6): LandingHero(), landingHeroConfig, featureConfigs, FeatureType, FeatureVideoPlayerProps, HeroVideoPlayerProps

### Community 48 - "Remotion Demo Colors"
Cohesion: 0.22
Nodes (9): AnimatedCursor(), AnimatedCursorProps, jobDescriptionLines, JobDetailPanel(), JobDetailPanelProps, applicationFlowDemoConfig, chatMessages, cursorKeyframes (+1 more)

### Community 49 - "Stripe Webhook Handler"
Cohesion: 0.29
Nodes (13): getPlanFromPriceId(), mapLegacyPlan(), getActivePlan(), handleCheckoutCompleted(), handleInvoicePaymentFailed(), handleInvoicePaymentSucceeded(), handleSubscriptionDeleted(), handleSubscriptionScheduleReleased() (+5 more)

### Community 50 - "Changelog & Pivot History"
Cohesion: 0.17
Nodes (13): src/lib/features/config.ts, Tester System (Ultra-Level Bypass), Admin Announcements System, AI Assistant Pivot, AI Learning System, Auto-Apply System Removal, Chat History 404 Routing Fix, Job Notes Feature (+5 more)

### Community 51 - "Metallic UI Styles"
Cohesion: 0.22
Nodes (8): GlassPanelProps, MetallicCardProps, borderRadius, easings, gradients, mixins, shadows, timing

### Community 52 - "Query Generation & Cache"
Cohesion: 0.24
Nodes (8): buildFallbackQueries(), buildQueryInput(), calculateYearsExperience(), determineMarket(), GeneratedQueries, generateSearchQueries(), openai, QueryGenerationInput

### Community 53 - "Multi-Source Search Coordination"
Cohesion: 0.29
Nodes (10): deduplicateJobs(), JOB_SOURCES, searchAllSources(), buildSearchQuery(), determineSourcesFromFilters(), getAvailableSources(), getCountriesFromFilters(), mergeWithFantasticJobsResults() (+2 more)

### Community 54 - "Description Formatting"
Cohesion: 0.23
Nodes (8): cleanHtmlDescription(), convertHeadersToHeadings(), decodeHtmlEntities(), formatDescription(), HEADER_PATTERNS, isHtmlContent(), SAFE_ATTRIBUTES, SAFE_TAGS

### Community 55 - "Remotion Kanban Demo"
Cohesion: 0.20
Nodes (9): JobCard(), JobCardProps, ColumnType, KanbanColumn(), KanbanColumnProps, statusDotColors, appliedJobs, newMatchesJobs (+1 more)

### Community 56 - "Vercel Config & Crons"
Cohesion: 0.18
Nodes (10): crons, functions, src/app/api/cron/check-expired-subscriptions/route.ts, src/app/api/cron/cleanup-expired-jobs/route.ts, src/app/api/cron/daily-curation/route.ts, rewrites, $schema, maxDuration (+2 more)

### Community 57 - "Toast UI Components"
Cohesion: 0.27
Nodes (9): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+1 more)

### Community 58 - "Tech Stack Concepts"
Cohesion: 0.20
Nodes (10): Subscription Downgrade Flow, Next.js 14 App Router, OpenAI gpt-4o-mini via Vercel AI SDK, 3-Tier Pricing Model, Remotion 4.0, Resend, Stripe, Stripe Webhook Integration (+2 more)

### Community 59 - "Company Discovery Strategy"
Cohesion: 0.22
Nodes (10): src/lib/auto-apply/platform-detector.ts, ats-companies.ts, Careers Page ATS Detection Pattern, Board Token Validation Pattern, Research Brief: Scaling Company Database to 500+, crypto-jobs-fyi/crawler Repository, GitHub Repository Harvesting Strategy, Hybrid Strategy: Community Sources + User Submissions (+2 more)

### Community 60 - "Package Scripts"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, dev:webpack, lint, start (+1 more)

### Community 61 - "CV Generation Python API"
Cohesion: 0.28
Nodes (5): BaseHTTPRequestHandler, build_rendercv_yaml(), handler, RenderCV Serverless Function for generating professional PDFs. This function rec, Build RenderCV YAML structure from input data.      Args:         data: Dictiona

### Community 62 - "Application Architecture Doc"
Cohesion: 0.33
Nodes (9): Atomic Quota Reservation Function, Auto-Apply Modes, Auto-Apply Status State Machine, Research Brief: JobSilver Application System Architecture, src/lib/stripe/plans.ts, Daily Quota System, Question Scraping Flow, Subscription Plans (Legacy 4-Tier) (+1 more)

### Community 63 - "Remotion Apply Button Demo"
Cohesion: 0.22
Nodes (5): ApplyButtonProps, aiMatchingDemoConfig, connections, nodes, spacing

### Community 64 - "Adzuna Integration Spec"
Cohesion: 0.32
Nodes (8): Adzuna Job Search API, src/lib/api/adzuna.ts, Adzuna-to-Job Field Mapping, Internal Job Schema, src/lib/api/jsearch.ts, mapAdzunaJobToJob Function, searchAdzunaJobs Function, Requirements Spec: Adzuna API Integration

### Community 65 - "Supabase Setup Script"
Cohesion: 0.39
Nodes (6): createStorageBucket(), main(), printSchemaSQL(), supabase, verifyStorageBucket(), verifyTableExists()

### Community 66 - "Location Normalization"
Cohesion: 0.50
Nodes (7): CITY_ALIASES, COUNTRY_ALIASES, getCitySearchVariants(), normalizeCity(), normalizeCountry(), normalizeLocation(), toTitleCase()

### Community 67 - "CV Text Extraction"
Cohesion: 0.36
Nodes (7): extractTextFromDOCX(), extractTextFromPDF(), extractTextFromPDFAdobe(), extractTextFromPDFBasic(), openai, ParsedCV, sanitizeCVText()

### Community 68 - "Cron Cleanup Route"
Cohesion: 0.48
Nodes (6): authenticateCronRequest(), CleanupSummary, GET(), POST(), safeCompare(), sleep()

### Community 69 - "AI Usage Hook"
Cohesion: 0.33
Nodes (5): AIUsageData, APIResponse, getTomorrowMidnight(), transformAPIResponse(), UseAIUsageResult

### Community 70 - "Lazy Video Players"
Cohesion: 0.29
Nodes (4): FeatureVideoPlayer, HeroVideoPlayer, LazyFeatureVideoPlayerProps, LazyHeroVideoPlayerProps

### Community 71 - "Supabase Email Templates"
Cohesion: 0.60
Nodes (6): Change Email Address Template, Confirm Signup Email Template, Dark Metallic Email Theme, Invite User Email Template, Magic Link Email Template, Supabase Email Templates

### Community 72 - "Video Section & Motion"
Cohesion: 0.60
Nodes (3): useReducedMotion(), VideoSection(), VideoSectionProps

### Community 73 - "Admin Middleware"
Cohesion: 0.60
Nodes (4): config, getAdminEmails(), isAdminEmail(), middleware()

### Community 74 - "DB Setup Script"
Cohesion: 0.40
Nodes (3): { Client }, fs, path

### Community 76 - "Remotion Smart Filters Demo"
Cohesion: 0.40
Nodes (3): allJobs, filterChips, smartFiltersDemoConfig

### Community 79 - "Timezone Mapping"
Cohesion: 0.67
Nodes (3): COUNTRY_TIMEZONE_MAP, normalizeTimezone(), timezoneMatches()

## Knowledge Gaps
- **621 isolated node(s):** `$schema`, `crons`, `maxDuration`, `maxDuration`, `maxDuration` (+616 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Job Card UI & Utils` to `Chat State & Events`, `Dashboard Page & UI Primitives`, `Job Preferences Step`, `NPM Dependencies`, `Setup Wizard Form Steps`, `Pricing & Plan Selection`, `Landing Page UI`, `Subscription Context & Feature Gate`, `Account & Subscription Pages`, `Announcements & Notifications`, `Public Pages & Footer`, `Toast UI Components`, `Layout & Theme Toggle`, `Setup Wizard & Filter Validation`, `Chat Panel Components`, `Dialog Components`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Dependencies` to `Package Scripts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `clsx` connect `NPM Dependencies` to `Job Card UI & Utils`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **What connects `$schema`, `crons`, `maxDuration` to the rest of the system?**
  _626 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Plans & AI Usage Tracking` be split into smaller, more focused modules?**
  _Cohesion score 0.05094905094905095 - nodes in this community are weakly interconnected._
- **Should `Chat State & Events` be split into smaller, more focused modules?**
  _Cohesion score 0.05273937532002048 - nodes in this community are weakly interconnected._
- **Should `Job Card UI & Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.061952074810052604 - nodes in this community are weakly interconnected._