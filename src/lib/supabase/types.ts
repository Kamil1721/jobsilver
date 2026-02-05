export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Generated search queries cached in profile
export interface GeneratedQueries {
  primary: string[]           // 4 main job title variations
  skillBased: string[]        // 3 skill-anchored queries
  seniorityVariants: string[] // 2 adjacent-level titles
  industrySpecific: string[]  // 2-3 industry-specific roles
  metadata: {
    generatedAt: string
    profileHash: string
    reasoning: string
  }
}

// Subscription plan types - 3-tier model (February 2026)
// Free: 3 jobs/day, no AI access
// Pro: 15 jobs/day, limited AI access (30/day), $3.99/wk or $12.99/mo
// Ultra: 35 jobs/day, unlimited AI access, $6.99/wk or $19.99/mo
export type SubscriptionPlan = 'free' | 'pro' | 'ultra'

// Legacy plans - kept for backwards compatibility with existing users
// These will be migrated to new plans on next subscription update
export type LegacySubscriptionPlan = 'starter' | 'basic' | 'mega'

// All possible subscription plans (current + legacy)
export type AllSubscriptionPlans = SubscriptionPlan | LegacySubscriptionPlan

// RapidAPI plan limits
export const PLAN_LIMITS: Record<string, { jobs: number; requests: number; price: number }> = {
  basic: { jobs: 250, requests: 25, price: 0 },
  pro: { jobs: 5000, requests: 2500, price: 45 },
  ultra: { jobs: 20000, requests: 20000, price: 95 },
  mega: { jobs: 50000, requests: 50000, price: 175 },
}

// AI Learning System Types (declared early for use in Database interface)
export type InteractionType = 'view' | 'view_details' | 'save' | 'favorite' | 'unfavorite' | 'apply' | 'discard' | 'skip'
export type ConfidenceLevel = 'none' | 'low' | 'medium' | 'high'

// Auto-Apply Mode Types
// - full_auto: Automatically submit applications without user review
// - assisted: Fill forms for user review, user clicks submit
// - manual: User handles everything themselves
export type AutoApplyMode = 'full_auto' | 'assisted' | 'manual'

// Auto-Apply Quota for tracking daily limits (especially for free tier)
export interface AutoApplyQuota {
  used: number
  limit: number
  resets_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          location: string | null
          cv_url: string | null
          cv_parsed_data: Json | null
          cv_is_generated: boolean
          job_filters: JobFilters | null
          screening_answers: ScreeningAnswers | null
          generated_queries: GeneratedQueries | null
          queries_profile_hash: string | null
          queries_generated_at: string | null
          auto_apply_enabled: boolean
          production_mode: boolean
          subscription_plan: SubscriptionPlan
          subscription_started_at: string | null
          is_admin: boolean
          is_tester: boolean
          tester_invite_code: string | null
          email_notifications: boolean
          notification_preferences: NotificationPreferences | null
          auto_apply_mode: AutoApplyMode
          has_selected_plan: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          location?: string | null
          cv_url?: string | null
          cv_parsed_data?: Json | null
          cv_is_generated?: boolean
          job_filters?: JobFilters | null
          screening_answers?: ScreeningAnswers | null
          generated_queries?: GeneratedQueries | null
          queries_profile_hash?: string | null
          queries_generated_at?: string | null
          auto_apply_enabled?: boolean
          production_mode?: boolean
          subscription_plan?: SubscriptionPlan
          subscription_started_at?: string | null
          is_admin?: boolean
          is_tester?: boolean
          tester_invite_code?: string | null
          email_notifications?: boolean
          notification_preferences?: NotificationPreferences | null
          auto_apply_mode?: AutoApplyMode
          has_selected_plan?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          location?: string | null
          cv_url?: string | null
          cv_parsed_data?: Json | null
          cv_is_generated?: boolean
          job_filters?: JobFilters | null
          screening_answers?: ScreeningAnswers | null
          generated_queries?: GeneratedQueries | null
          queries_profile_hash?: string | null
          queries_generated_at?: string | null
          auto_apply_enabled?: boolean
          production_mode?: boolean
          subscription_plan?: SubscriptionPlan
          subscription_started_at?: string | null
          is_admin?: boolean
          is_tester?: boolean
          tester_invite_code?: string | null
          email_notifications?: boolean
          notification_preferences?: NotificationPreferences | null
          auto_apply_mode?: AutoApplyMode
          has_selected_plan?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          external_id: string | null
          source: string | null
          title: string
          company: string | null
          company_logo_url: string | null
          location: string | null
          salary_min: number | null
          salary_max: number | null
          salary_currency: string | null
          job_type: string | null
          remote: boolean
          remote_type: 'fully_remote' | 'hybrid' | 'onsite' | null
          industry_category: string | null
          job_posted_at: string | null
          location_verified: boolean
          spam_score: number
          description: string | null
          application_url: string | null
          match_score: number | null
          status: JobStatus
          application_questions: ApplicationQuestion[] | null
          application_answers: ApplicationAnswer[] | null
          applied_at: string | null
          expires_at: string | null
          created_at: string
          platform_detected: PlatformType | null
          auto_apply_status: AutoApplyStatus
          // ATS integration fields
          ats_source: 'greenhouse' | 'lever' | 'ashby' | 'fantasticjobs' | null
          ats_job_id: string | null
          questions_loaded: boolean
          // Application failure tracking
          failure_reason: string | null
          failure_reviewed: boolean
          failure_reviewed_at: string | null
          failure_notes: string | null
          // User notes
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          external_id?: string | null
          source?: string | null
          title: string
          company?: string | null
          company_logo_url?: string | null
          location?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_currency?: string | null
          job_type?: string | null
          remote?: boolean
          remote_type?: 'fully_remote' | 'hybrid' | 'onsite' | null
          industry_category?: string | null
          job_posted_at?: string | null
          location_verified?: boolean
          spam_score?: number
          description?: string | null
          application_url?: string | null
          match_score?: number | null
          status?: JobStatus
          application_questions?: ApplicationQuestion[] | null
          application_answers?: ApplicationAnswer[] | null
          applied_at?: string | null
          expires_at?: string | null
          created_at?: string
          platform_detected?: PlatformType | null
          auto_apply_status?: AutoApplyStatus
          // ATS integration fields
          ats_source?: 'greenhouse' | 'lever' | 'ashby' | 'fantasticjobs' | null
          ats_job_id?: string | null
          questions_loaded?: boolean
          // Application failure tracking
          failure_reason?: string | null
          failure_reviewed?: boolean
          failure_reviewed_at?: string | null
          failure_notes?: string | null
          // User notes
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          external_id?: string | null
          source?: string | null
          title?: string
          company?: string | null
          company_logo_url?: string | null
          location?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_currency?: string | null
          job_type?: string | null
          remote?: boolean
          remote_type?: 'fully_remote' | 'hybrid' | 'onsite' | null
          industry_category?: string | null
          job_posted_at?: string | null
          location_verified?: boolean
          spam_score?: number
          description?: string | null
          application_url?: string | null
          match_score?: number | null
          status?: JobStatus
          application_questions?: ApplicationQuestion[] | null
          application_answers?: ApplicationAnswer[] | null
          applied_at?: string | null
          expires_at?: string | null
          created_at?: string
          platform_detected?: PlatformType | null
          auto_apply_status?: AutoApplyStatus
          // ATS integration fields
          ats_source?: 'greenhouse' | 'lever' | 'ashby' | 'fantasticjobs' | null
          ats_job_id?: string | null
          questions_loaded?: boolean
          // Application failure tracking
          failure_reason?: string | null
          failure_reviewed?: boolean
          failure_reviewed_at?: string | null
          failure_notes?: string | null
          // User notes
          notes?: string | null
        }
      }
      user_job_quotas: {
        Row: {
          id: string
          user_id: string
          date: string
          jobs_fetched: number
          jobs_limit: number
          applications_used: number
          applications_limit: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          jobs_fetched?: number
          jobs_limit?: number
          applications_used?: number
          applications_limit?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          jobs_fetched?: number
          jobs_limit?: number
          applications_used?: number
          applications_limit?: number
          created_at?: string
        }
      }
      application_history: {
        Row: {
          id: string
          user_id: string
          job_id: string | null
          job_title: string | null
          company: string | null
          status: string | null
          applied_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_id?: string | null
          job_title?: string | null
          company?: string | null
          status?: string | null
          applied_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: string | null
          job_title?: string | null
          company?: string | null
          status?: string | null
          applied_at?: string | null
          created_at?: string
        }
      }
      saved_answers: {
        Row: {
          id: string
          user_id: string
          question_type: string | null
          question_text: string | null
          answer_text: string | null
          usage_count: number
          last_used_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_type?: string | null
          question_text?: string | null
          answer_text?: string | null
          usage_count?: number
          last_used_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          question_type?: string | null
          question_text?: string | null
          answer_text?: string | null
          usage_count?: number
          last_used_at?: string
          created_at?: string
        }
      }
      scraped_questions: {
        Row: {
          id: string
          job_id: string
          platform: PlatformType
          questions: ScrapedQuestion[]
          form_structure: FormStructure | null
          scrape_status: ScrapeStatus
          error_message: string | null
          scraped_at: string
          // Source of questions: 'api' (from ATS API) or 'scraped' (from Playwright)
          questions_source: 'api' | 'scraped'
          // Retry tracking columns
          retry_count: number
          max_retries: number
          last_error: string | null
          last_retry_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          platform: PlatformType
          questions?: ScrapedQuestion[]
          form_structure?: FormStructure | null
          scrape_status?: ScrapeStatus
          error_message?: string | null
          scraped_at?: string
          questions_source?: 'api' | 'scraped'
          // Retry tracking columns
          retry_count?: number
          max_retries?: number
          last_error?: string | null
          last_retry_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          platform?: PlatformType
          questions?: ScrapedQuestion[]
          form_structure?: FormStructure | null
          scrape_status?: ScrapeStatus
          error_message?: string | null
          scraped_at?: string
          questions_source?: 'api' | 'scraped'
          // Retry tracking columns
          retry_count?: number
          max_retries?: number
          last_error?: string | null
          last_retry_at?: string | null
        }
      }
      application_queue: {
        Row: {
          id: string
          user_id: string
          job_id: string
          answers: Record<string, string | string[] | boolean>
          cv_url: string | null
          status: ApplicationQueueStatus
          error_code: string | null
          error_message: string | null
          screenshot_url: string | null
          retry_count: number
          created_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          job_id: string
          answers?: Record<string, string | string[] | boolean>
          cv_url?: string | null
          status?: ApplicationQueueStatus
          error_code?: string | null
          error_message?: string | null
          screenshot_url?: string | null
          retry_count?: number
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: string
          answers?: Record<string, string | string[] | boolean>
          cv_url?: string | null
          status?: ApplicationQueueStatus
          error_code?: string | null
          error_message?: string | null
          screenshot_url?: string | null
          retry_count?: number
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
      }
      platform_credentials: {
        Row: {
          id: string
          user_id: string
          platform: PlatformType
          credentials_encrypted: string
          session_data_encrypted: string | null
          last_verified_at: string | null
          is_valid: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: PlatformType
          credentials_encrypted: string
          session_data_encrypted?: string | null
          last_verified_at?: string | null
          is_valid?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: PlatformType
          credentials_encrypted?: string
          session_data_encrypted?: string | null
          last_verified_at?: string | null
          is_valid?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      scraper_failures: {
        Row: {
          id: string
          user_id: string
          job_id: string | null
          external_id: string | null
          source: string | null
          title: string
          company: string | null
          application_url: string | null
          platform_detected: string | null
          failure_reason: ScraperFailureReason
          error_message: string | null
          error_details: Json | null
          detected_auth_elements: Json | null
          page_title: string | null
          page_url: string | null
          failed_at: string
          created_at: string
          reviewed: boolean
          reviewed_at: string | null
          review_notes: string | null
          is_test_run: boolean
          debug_info: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          job_id?: string | null
          external_id?: string | null
          source?: string | null
          title: string
          company?: string | null
          application_url?: string | null
          platform_detected?: string | null
          failure_reason: ScraperFailureReason
          error_message?: string | null
          error_details?: Json | null
          detected_auth_elements?: Json | null
          page_title?: string | null
          page_url?: string | null
          failed_at?: string
          created_at?: string
          reviewed?: boolean
          reviewed_at?: string | null
          review_notes?: string | null
          is_test_run?: boolean
          debug_info?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: string | null
          external_id?: string | null
          source?: string | null
          title?: string
          company?: string | null
          application_url?: string | null
          platform_detected?: string | null
          failure_reason?: ScraperFailureReason
          error_message?: string | null
          error_details?: Json | null
          detected_auth_elements?: Json | null
          page_title?: string | null
          page_url?: string | null
          failed_at?: string
          created_at?: string
          reviewed?: boolean
          reviewed_at?: string | null
          review_notes?: string | null
          is_test_run?: boolean
          debug_info?: Json | null
        }
      }
      api_usage: {
        Row: {
          id: string
          month_year: string
          jobs_fetched: number
          requests_made: number
          jobs_limit: number
          requests_limit: number
          rapidapi_plan: string
          rate_limit_remaining: number | null
          rate_limit_reset: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          month_year: string
          jobs_fetched?: number
          requests_made?: number
          jobs_limit?: number
          requests_limit?: number
          rapidapi_plan?: string
          rate_limit_remaining?: number | null
          rate_limit_reset?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          month_year?: string
          jobs_fetched?: number
          requests_made?: number
          jobs_limit?: number
          requests_limit?: number
          rapidapi_plan?: string
          rate_limit_remaining?: number | null
          rate_limit_reset?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      api_request_log: {
        Row: {
          id: string
          endpoint: string
          params: Json | null
          jobs_returned: number
          response_status: number | null
          rate_limit_limit: number | null
          rate_limit_remaining: number | null
          rate_limit_reset: string | null
          response_time_ms: number | null
          requested_at: string
          triggered_by_user_id: string | null
        }
        Insert: {
          id?: string
          endpoint: string
          params?: Json | null
          jobs_returned?: number
          response_status?: number | null
          rate_limit_limit?: number | null
          rate_limit_remaining?: number | null
          rate_limit_reset?: string | null
          response_time_ms?: number | null
          requested_at?: string
          triggered_by_user_id?: string | null
        }
        Update: {
          id?: string
          endpoint?: string
          params?: Json | null
          jobs_returned?: number
          response_status?: number | null
          rate_limit_limit?: number | null
          rate_limit_remaining?: number | null
          rate_limit_reset?: string | null
          response_time_ms?: number | null
          requested_at?: string
          triggered_by_user_id?: string | null
        }
      }
      user_reports: {
        Row: {
          id: string
          user_id: string
          report_type: ReportType
          title: string
          description: string
          job_id: string | null
          job_title: string | null
          job_company: string | null
          page_url: string | null
          browser_info: string | null
          status: ReportStatus
          admin_notes: string | null
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          report_type: ReportType
          title: string
          description: string
          job_id?: string | null
          job_title?: string | null
          job_company?: string | null
          page_url?: string | null
          browser_info?: string | null
          status?: ReportStatus
          admin_notes?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          report_type?: ReportType
          title?: string
          description?: string
          job_id?: string | null
          job_title?: string | null
          job_company?: string | null
          page_url?: string | null
          browser_info?: string | null
          status?: ReportStatus
          admin_notes?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_subscription_id: string
          stripe_customer_id: string
          status: string
          plan: string
          price_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          trial_start: string | null
          trial_end: string | null
          // Scheduled downgrade fields (for Ultra→Pro auto-transition)
          scheduled_downgrade_to: string | null
          scheduled_downgrade_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_subscription_id: string
          stripe_customer_id: string
          status: string
          plan: string
          price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          trial_start?: string | null
          trial_end?: string | null
          scheduled_downgrade_to?: string | null
          scheduled_downgrade_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_subscription_id?: string
          stripe_customer_id?: string
          status?: string
          plan?: string
          price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          trial_start?: string | null
          trial_end?: string | null
          scheduled_downgrade_to?: string | null
          scheduled_downgrade_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      curation_logs: {
        Row: {
          id: string
          user_id: string
          started_at: string
          completed_at: string | null
          status: CurationLogStatus
          jobs_target: number
          jobs_curated: number
          jobs_failed: number
          error_message: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_at?: string
          completed_at?: string | null
          status?: CurationLogStatus
          jobs_target?: number
          jobs_curated?: number
          jobs_failed?: number
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          started_at?: string
          completed_at?: string | null
          status?: CurationLogStatus
          jobs_target?: number
          jobs_curated?: number
          jobs_failed?: number
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          status: NotificationStatus
          error: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          status?: NotificationStatus
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: NotificationType
          status?: NotificationStatus
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
      }
      user_favorite_jobs: {
        Row: {
          id: string
          user_id: string
          job_id: string
          favorited_at: string
          favorite_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_id: string
          favorited_at?: string
          favorite_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: string
          favorited_at?: string
          favorite_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_interactions: {
        Row: {
          id: string
          user_id: string
          job_id: string | null
          interaction_type: InteractionType
          duration_seconds: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_id?: string | null
          interaction_type: InteractionType
          duration_seconds?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: string | null
          interaction_type?: InteractionType
          duration_seconds?: number | null
          metadata?: Json
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          confidence_level: ConfidenceLevel
          preferred_industries: Json
          preferred_company_sizes: Json
          preferred_job_types: Json
          remote_preference: Json
          preferred_salary_min: number | null
          preferred_salary_max: number | null
          salary_currency: string | null
          keyword_weights: Json
          preferred_locations: Json
          preferred_companies: Json
          avoided_companies: Json
          total_interactions: number
          total_favorites: number
          total_applies: number
          total_discards: number
          last_computed_at: string | null
          computation_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          confidence_level?: ConfidenceLevel
          preferred_industries?: Json
          preferred_company_sizes?: Json
          preferred_job_types?: Json
          remote_preference?: Json
          preferred_salary_min?: number | null
          preferred_salary_max?: number | null
          salary_currency?: string | null
          keyword_weights?: Json
          preferred_locations?: Json
          preferred_companies?: Json
          avoided_companies?: Json
          total_interactions?: number
          total_favorites?: number
          total_applies?: number
          total_discards?: number
          last_computed_at?: string | null
          computation_version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          confidence_level?: ConfidenceLevel
          preferred_industries?: Json
          preferred_company_sizes?: Json
          preferred_job_types?: Json
          remote_preference?: Json
          preferred_salary_min?: number | null
          preferred_salary_max?: number | null
          salary_currency?: string | null
          keyword_weights?: Json
          preferred_locations?: Json
          preferred_companies?: Json
          avoided_companies?: Json
          total_interactions?: number
          total_favorites?: number
          total_applies?: number
          total_discards?: number
          last_computed_at?: string | null
          computation_version?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_learning_settings: {
        Row: {
          id: string
          user_id: string
          learning_enabled: boolean
          track_interactions: boolean
          use_for_recommendations: boolean
          use_for_chat: boolean
          last_reset_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          learning_enabled?: boolean
          track_interactions?: boolean
          use_for_recommendations?: boolean
          use_for_chat?: boolean
          last_reset_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          learning_enabled?: boolean
          track_interactions?: boolean
          use_for_recommendations?: boolean
          use_for_chat?: boolean
          last_reset_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tester_invites: {
        Row: {
          id: string
          invite_code: string
          created_by: string
          used_by: string | null
          used_at: string | null
          expires_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invite_code: string
          created_by: string
          used_by?: string | null
          used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invite_code?: string
          created_by?: string
          used_by?: string | null
          used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_ai_usage: {
        Row: {
          id: string
          user_id: string
          date: string
          ai_responses_used: number
          cover_letters_generated: number
          cv_optimizations_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          ai_responses_used?: number
          cover_letters_generated?: number
          cv_optimizations_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          ai_responses_used?: number
          cover_letters_generated?: number
          cv_optimizations_used?: number
          created_at?: string
          updated_at?: string
        }
      }
      downgrade_reasons: {
        Row: {
          id: string
          user_id: string
          from_plan: string
          to_plan: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          from_plan: string
          to_plan: string
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          from_plan?: string
          to_plan?: string
          reason?: string
          created_at?: string
        }
      }
    }
  }
}

export type JobStatus = 'discovered' | 'saved' | 'applied' | 'interviewing' | 'offer' | 'discarded'

// ============================================
// NOTIFICATION TYPES
// ============================================

// Notification type enum
// Note: Database schema may include legacy types ('application_status', 'quota_warning')
// that are no longer used by the application. These were removed in January 2026.
export type NotificationType = 'welcome' | 'job_matches'

// Notification status enum
export type NotificationStatus = 'pending' | 'sent' | 'failed'

// Notification preferences for granular control
export interface NotificationPreferences {
  welcome?: boolean
  job_matches?: boolean
}

// Notification record from database
export type Notification = Database['public']['Tables']['notifications']['Row']

// User report types
export type ReportType = 'incorrect_questions' | 'incorrect_description' | 'bug' | 'suggestion' | 'other'
export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix' | 'duplicate'

// Curation log status
export type CurationLogStatus = 'running' | 'success' | 'failed' | 'partial'

// Work arrangement types matching fantastic.jobs API
export type WorkArrangement = 'on_site' | 'hybrid' | 'remote_ok' | 'remote_only'

// Step 1: Work Location & Job Types
export interface JobFilters {
  // Work Location (legacy - kept for backward compatibility)
  remote_jobs: boolean
  remote_countries: string[]
  onsite_hybrid: boolean
  onsite_locations: string[]

  // Granular Work Arrangements (new - maps to ai_work_arrangement_filter)
  // 'on_site' = On-site only, 'hybrid' = Hybrid, 'remote_ok' = Remote OK, 'remote_only' = Remote Solely
  work_arrangements?: WorkArrangement[]

  // Job Types
  job_types: ('fulltime' | 'part-time' | 'contractor' | 'internship')[]

  // Job Titles (up to 5)
  job_titles: string[]

  // Job Match
  match_threshold: 'high' | 'higher' | 'highest'

  // Seniority
  seniority_levels: ('entry' | 'associate' | 'mid-senior' | 'director')[]

  // Time Zones
  time_zones: string[]
  include_flexible_timezone: boolean

  // Worldwide Remote - opt-in to include jobs that say "worldwide" or "work from anywhere"
  // When false, only jobs from selected countries are shown (stricter filtering)
  include_worldwide_remote: boolean

  // Industry
  industries: string[]

  // Language
  job_languages: string[]

  // Keywords
  include_keywords: string[]
  exclude_keywords: string[]

  // Companies to exclude
  exclude_companies: string[]

  // Salary
  salary_min: number | null
  salary_max: number | null
  salary_currency: string

  // Company Size Preference (optional)
  company_size: ('startup' | 'small' | 'medium' | 'large' | 'enterprise')[]
}

// Screening Questions / Profile Info
export interface ScreeningAnswers {
  // Personal Info (mandatory)
  first_name: string
  last_name: string

  // CV & Cover Letter
  cv_url: string | null
  cv_generation_mode?: 'upload' | 'generate'
  cover_letter_mode: 'auto_generate' | 'upload'
  cover_letter_url: string | null

  // CV Generation Data (used when cv_generation_mode is 'generate')
  work_history?: {
    company: string
    position: string
    start_date: string  // YYYY-MM
    end_date: string | null  // YYYY-MM or null for "Present"
    location?: string
    highlights: string[]  // 2-4 bullet points
  }[]
  education?: {
    institution: string
    degree: string
    area: string  // field of study
    graduation_year: string  // YYYY
    location?: string
    highlights?: string[]
  }[]
  skills?: string[]  // Array of skill keywords, max 15

  // Contact Info
  phone_country_code: string
  phone_number: string

  // Location
  country: string
  city: string
  state_region: string
  postcode: string

  // Professional Info
  current_job_title: string
  experience_summary: string
  linkedin_url: string | null
  no_linkedin: boolean

  // Availability
  availability: 'immediately' | '1_week' | '2_weeks' | '1_month' | '2_months'

  // Work Authorization
  work_authorization_countries: string[]
  requires_visa_sponsorship: boolean

  // Personal Info
  nationalities: string[]
  salary_currency: string
  current_salary: number | null
  expected_salary: number | null

  // Preferences
  remote_preference: 'hybrid' | 'full_remote'
  open_to_travel: boolean
  open_to_relocation: boolean

  // Languages
  spoken_languages: string[]

  // Optional Info
  date_of_birth: string | null
  gpa: string | null
  is_over_18: boolean
  gender: string | null
  disability_status: 'yes' | 'no' | 'prefer_not_to_say' | null
  military_service: 'yes' | 'no' | 'prefer_not_to_say' | null
  ethnicity: string | null
  driving_license: string | null
  security_clearance: string | null

  // Configuration
  apply_mode: 'auto_save_review' | 'full_auto_apply'
}

export interface ApplicationQuestion {
  id: string
  question: string
  type: 'text' | 'textarea' | 'select' | 'checkbox'
  required: boolean
  options?: string[]
}

export interface ApplicationAnswer {
  question_id: string
  answer: string
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type SavedAnswer = Database['public']['Tables']['saved_answers']['Row']
export type UserJobQuota = Database['public']['Tables']['user_job_quotas']['Row']

// Quota status returned from search API
export interface QuotaStatus {
  remaining: number
  limit: number
  jobs_fetched_today: number
  resets_at?: string
}

// ============================================
// AUTO-APPLY FEATURE TYPES
// ============================================

// Platform types for job application sources
// All platforms are supported - no restrictions
export type PlatformType =
  // ATS platforms
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'smartrecruiters'
  | 'rippling'
  | 'icims'
  | 'taleo'
  | 'workable'
  | 'teamtailor'
  | 'bamboohr'
  | 'jazzhr'
  | 'jobvite'
  | 'personio'
  | 'recruitee'
  | 'breezy'
  | 'freshteam'
  | 'gohire'
  | 'comeet'
  | 'pinpoint'
  | 'polymer'
  | 'successfactors'
  | 'dayforce'
  | 'paylocity'
  | 'paycom'
  | 'adp'
  | 'zoho'
  // Major job boards
  | 'linkedin'
  | 'indeed'
  | 'glassdoor'
  // Generic platforms
  | 'ats'
  | 'unknown'

// ATS source types for direct API integrations
export type ATSSource = 'greenhouse' | 'lever' | 'ashby' | 'fantasticjobs' | null

// Auto-apply status for jobs
export type AutoApplyStatus =
  | 'not_started'
  | 'not_available'  // Jobs without application URL - cannot auto-apply
  | 'manual'         // Jobs from non-Easy Apply platforms - require external application
  | 'scraping'
  | 'ready_to_apply'
  | 'needs_review'   // Scraping incomplete/low confidence - needs human review before applying
  | 'form_filled'    // Assisted mode: form is filled, waiting for user confirmation
  | 'submitting'
  | 'applied'
  | 'failed'
  | 'login_required' // Job requires login to view/apply - hidden from user
  | 'scrape_failed'  // Scraper couldn't extract questions - hidden from user

// Scraper failure reasons
export type ScraperFailureReason =
  | 'login_required'      // Page requires authentication
  | 'scraper_error'       // Technical scraping failure
  | 'no_questions_found'  // Could access page but no form fields found
  | 'timeout'             // Page load timeout
  | 'page_not_found'      // 404 or job expired
  | 'captcha_required'    // Anti-bot protection detected
  | 'unknown'             // Other failures

// Application queue status
export type ApplicationQueueStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'manual_required'

// Scrape status
export type ScrapeStatus = 'pending' | 'processing' | 'success' | 'failed'

// Question types for scraped form fields
export type ScrapedQuestionType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'date'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'

// Scraped question from job application form
export interface ScrapedQuestion {
  id: string
  label: string
  type: ScrapedQuestionType
  required: boolean
  placeholder?: string
  options?: string[]
  validation?: {
    pattern?: string
    minLength?: number
    maxLength?: number
  }
  selector: string
  page?: number
  section?: string
}

// Validation status for scraped questions
export type ValidationStatus = 'complete' | 'partial' | 'needs_review' | 'failed'

// Validation check result
export interface ValidationCheck {
  check: string
  passed: boolean
  details?: string
}

// Form structure metadata
export interface FormStructure {
  platform: PlatformType
  total_pages: number
  has_cv_upload: boolean
  has_cover_letter: boolean
  requires_login: boolean
  application_type: 'easy_apply' | 'external' | 'direct'
  // Validation fields (populated by droplet after scraping)
  validation_status?: ValidationStatus
  confidence_score?: number // 0-100
  validation_checks?: ValidationCheck[]
}

// Scraped questions record from database
export interface ScrapedQuestionsRecord {
  id: string
  job_id: string
  platform: PlatformType
  questions: ScrapedQuestion[]
  form_structure: FormStructure | null
  scrape_status: ScrapeStatus
  error_message: string | null
  scraped_at: string
  questions_source: 'api' | 'scraped'
}

// Application queue item from database
export interface ApplicationQueueItem {
  id: string
  user_id: string
  job_id: string
  answers: Record<string, string | string[] | boolean>
  cv_url: string | null
  status: ApplicationQueueStatus
  error_code: string | null
  error_message: string | null
  screenshot_url: string | null
  retry_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

// Platform credential (without sensitive data for frontend)
export interface PlatformCredential {
  id: string
  user_id: string
  platform: PlatformType
  last_verified_at: string | null
  is_valid: boolean
  created_at: string
  updated_at: string
}

// Error codes for application failures
export enum ApplicationErrorCode {
  // Scraping errors
  SCRAPE_PAGE_NOT_FOUND = 'SCRAPE_PAGE_NOT_FOUND',
  SCRAPE_NO_FORM_FOUND = 'SCRAPE_NO_FORM_FOUND',
  SCRAPE_TIMEOUT = 'SCRAPE_TIMEOUT',
  SCRAPE_LOGIN_REQUIRED = 'SCRAPE_LOGIN_REQUIRED',

  // Submission errors
  SUBMIT_FIELD_NOT_FOUND = 'SUBMIT_FIELD_NOT_FOUND',
  SUBMIT_FIELD_VALIDATION_FAILED = 'SUBMIT_FIELD_VALIDATION_FAILED',
  SUBMIT_CV_UPLOAD_FAILED = 'SUBMIT_CV_UPLOAD_FAILED',
  SUBMIT_BUTTON_NOT_FOUND = 'SUBMIT_BUTTON_NOT_FOUND',
  SUBMIT_CONFIRMATION_NOT_FOUND = 'SUBMIT_CONFIRMATION_NOT_FOUND',

  // Authentication errors
  AUTH_LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  AUTH_CREDENTIALS_INVALID = 'AUTH_CREDENTIALS_INVALID',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_2FA_REQUIRED = 'AUTH_2FA_REQUIRED',

  // Anti-bot errors
  CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',

  // Job-specific errors
  JOB_ALREADY_APPLIED = 'JOB_ALREADY_APPLIED',
  JOB_EXPIRED = 'JOB_EXPIRED',
  JOB_NOT_ACCEPTING = 'JOB_NOT_ACCEPTING',

  // Technical errors
  BROWSER_CRASH = 'BROWSER_CRASH',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

// User report types
export type UserReport = Database['public']['Tables']['user_reports']['Row']

// User report with profile info (for admin views)
export interface UserReportWithProfile extends UserReport {
  profiles?: {
    email: string | null
    full_name: string | null
  }
}

// ============================================
// STRIPE / SUBSCRIPTION TYPES
// ============================================

// Stripe subscription status
export type StripeSubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

// Customer table type
export interface Customer {
  id: string
  user_id: string
  stripe_customer_id: string
  created_at: string
}

// Subscription table type
export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  status: StripeSubscriptionStatus
  plan: SubscriptionPlan
  price_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  trial_start: string | null
  trial_end: string | null
  created_at: string
  updated_at: string
}

// Subscription with plan details for frontend
export interface SubscriptionDetails {
  plan: SubscriptionPlan
  status: StripeSubscriptionStatus | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  trialEnd: string | null
}

// ============================================
// CURATION TYPES
// ============================================

// Curation log record from database
export type CurationLog = Database['public']['Tables']['curation_logs']['Row']

// Curation log with summary for admin views
export interface CurationLogSummary {
  total_runs: number
  successful_runs: number
  failed_runs: number
  total_jobs_curated: number
  total_jobs_failed: number
  average_jobs_per_run: number
  last_run_at: string | null
}

// ============================================
// AI LEARNING SYSTEM TYPES
// ============================================

// User favorite job record
export interface UserFavoriteJob {
  id: string
  user_id: string
  job_id: string
  favorited_at: string
  favorite_reason: string | null
  created_at: string
  updated_at: string
}

// User interaction record
export interface UserInteraction {
  id: string
  user_id: string
  job_id: string | null
  interaction_type: InteractionType
  duration_seconds: number | null
  metadata: Json
  created_at: string
}

// User preferences computed from behavior (matches user_preferences table)
export interface UserPreferences {
  id: string
  user_id: string

  // Confidence level
  confidence_level: ConfidenceLevel

  // Industry & Company Preferences (JSONB with weights)
  preferred_industries: Record<string, number>
  preferred_company_sizes: Record<string, number>
  preferred_job_types: Record<string, number>

  // Remote preference (JSONB with remote type weights)
  remote_preference: Record<string, number>

  // Salary Preferences
  preferred_salary_min: number | null
  preferred_salary_max: number | null
  salary_currency: string | null

  // Keyword weights (keyword -> score mapping)
  keyword_weights: Record<string, number>

  // Location preferences (JSONB with weights)
  preferred_locations: Record<string, number>

  // Company Preferences
  preferred_companies: Record<string, number>
  avoided_companies: string[]

  // Statistics
  total_interactions: number
  total_favorites: number
  total_applies: number
  total_discards: number

  // Computation metadata
  last_computed_at: string | null
  computation_version: number

  created_at: string
  updated_at: string
}

// User settings for AI learning
export interface UserLearningSettings {
  id: string
  user_id: string

  learning_enabled: boolean
  track_interactions: boolean
  use_for_recommendations: boolean
  use_for_chat: boolean

  last_reset_at: string | null
  created_at: string
  updated_at: string
}

// ============================================
// TESTER SYSTEM TYPES
// ============================================

// Tester invite record from database
export interface TesterInvite {
  id: string
  invite_code: string
  created_by: string
  used_by: string | null
  used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Tester invite with creator profile info (for admin views)
export interface TesterInviteWithCreator extends TesterInvite {
  creator?: {
    email: string | null
    full_name: string | null
  }
  user?: {
    email: string | null
    full_name: string | null
  }
}

// ============================================
// ADMIN ANNOUNCEMENT TYPES
// ============================================

// Announcement type enum
export type AnnouncementType = 'info' | 'warning' | 'promo' | 'maintenance'

// Announcement record from database
export interface AdminAnnouncement {
  id: string
  message: string
  type: AnnouncementType
  priority: number
  target_plans: string[] | null // null = all plans
  starts_at: string
  ends_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// Announcement for display (subset of fields)
export interface ActiveAnnouncement {
  id: string
  message: string
  type: AnnouncementType
  priority: number
  updated_at: string // Used to track if announcement was restarted/updated
}

// ============================================
// ADMIN AUDIT LOG TYPES
// ============================================

// Audit log action types
export type AuditLogAction =
  | 'tester_granted'
  | 'tester_revoked'
  | 'invite_generated'
  | 'invite_revoked'
  | 'report_updated'
  | 'report_status_changed'
  | 'report_deleted'
  | 'user_deleted'
  | 'announcement_created'
  | 'announcement_updated'
  | 'announcement_deleted'

// Audit log target types
export type AuditLogTargetType = 'user' | 'report' | 'tester' | 'announcement' | 'invite'

// Audit log record from database
export interface AdminAuditLog {
  id: string
  admin_id: string
  admin_email: string
  action: AuditLogAction
  target_type: AuditLogTargetType | null
  target_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

// Audit log with enriched admin info for display
export interface AdminAuditLogWithAdmin extends AdminAuditLog {
  admin_name?: string | null
}

// ============================================
// AI USAGE TRACKING TYPES
// ============================================

// AI usage record from database
export type UserAIUsage = Database['public']['Tables']['user_ai_usage']['Row']

// AI usage stats for display
export interface AIUsageStats {
  aiResponsesUsed: number
  coverLettersGenerated: number
  cvOptimizationsUsed: number
  date: string
}

// AI usage with plan limits for display
export interface AIUsageWithLimits {
  usage: AIUsageStats
  limits: {
    aiResponses: { used: number; limit: number; limitDisplay: string }
    coverLetters: { used: number; limit: number; limitDisplay: string }
    cvOptimization: { enabled: boolean }
    aiLearning: { enabled: boolean }
  }
  plan: SubscriptionPlan
  isTester: boolean
}

// ============================================
// DOWNGRADE TRACKING TYPES
// ============================================

// Downgrade reason record from database
export type DowngradeReason = Database['public']['Tables']['downgrade_reasons']['Row']

// Downgrade reason codes
export type DowngradeReasonCode =
  | 'too_expensive'
  | 'not_using'
  | 'found_alternative'
  | 'missing_features'
  | 'temporary_break'
  | 'other'
