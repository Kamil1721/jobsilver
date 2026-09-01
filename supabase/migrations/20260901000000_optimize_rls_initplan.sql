-- Migration: wrap auth.uid()/is_admin() in RLS policies as (select ...) — InitPlan optimization
--
-- WHY: An unwrapped auth.uid() in a policy is a volatile call re-evaluated ONCE PER ROW
-- scanned. On per-user tables that grow with usage (jobs, user_interactions,
-- job_chat_messages, user_favorite_jobs, user_job_quotas) this makes every SELECT's RLS
-- overhead scale with row count. Wrapping as (select auth.uid()) lets Postgres compute it
-- ONCE per query (an InitPlan) — the documented Supabase RLS performance pattern.
--
-- LOCK BEHAVIOR: ALTER POLICY only rewrites the policy expression in the catalog. It takes
-- a brief ACCESS EXCLUSIVE lock on each table for a metadata update (sub-millisecond, no
-- table rewrite, no data scan). Safe on a live DB. No transaction wrapper needed, but one
-- keeps it all-or-nothing.
--
-- SEMANTICS: identical. (select auth.uid()) returns the same value as auth.uid(); this is a
-- pure performance rewrite with zero change to who can see/write which rows.
--
-- ROLLBACK: re-run the previous policy definitions (or ALTER POLICY ... back to auth.uid()).

BEGIN;

ALTER POLICY "Admins can manage announcements" ON public.admin_announcements USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Admins can insert audit logs" ON public.admin_audit_logs WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Admins can read audit logs" ON public.admin_audit_logs USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Admins can read api_request_log" ON public.api_request_log USING ((select is_admin()));
ALTER POLICY "Users can read own api_request_log" ON public.api_request_log USING (((select auth.uid()) = triggered_by_user_id));
ALTER POLICY "Admins can read api_usage" ON public.api_usage USING ((select is_admin()));
ALTER POLICY "Users can view own curation logs" ON public.curation_logs USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own customer" ON public.customers USING (((select auth.uid()) = user_id));
ALTER POLICY "applications insertable by owner" ON public.job_applications WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "applications selectable by owner" ON public.job_applications USING (((select auth.uid()) = user_id));
ALTER POLICY "applications updatable by owner" ON public.job_applications USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete their own chat messages" ON public.job_chat_messages USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert their own chat messages" ON public.job_chat_messages WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view their own chat messages" ON public.job_chat_messages USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own jobs" ON public.jobs USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own jobs" ON public.jobs WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own jobs" ON public.jobs USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own jobs" ON public.jobs USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can view all profiles" ON public.profiles USING (((select is_admin()) OR ((select auth.uid()) = id)));
ALTER POLICY "Users can insert own profile" ON public.profiles WITH CHECK (((select auth.uid()) = id));
ALTER POLICY "Users can update own profile" ON public.profiles USING (((select auth.uid()) = id)) WITH CHECK (((select auth.uid()) = id));
ALTER POLICY "Users can view own profile" ON public.profiles USING (((select auth.uid()) = id));
ALTER POLICY "Users can view own subscription" ON public.subscriptions USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can create tester invites" ON public.tester_invites WITH CHECK (((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))) AND (created_by = (select auth.uid()))));
ALTER POLICY "Admins can delete tester invites" ON public.tester_invites USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Admins can update tester invites" ON public.tester_invites USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Admins can view all tester invites" ON public.tester_invites USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Users can insert own ai preferences" ON public.user_ai_preferences WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own ai preferences" ON public.user_ai_preferences USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own ai preferences" ON public.user_ai_preferences USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own ai usage" ON public.user_ai_usage WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can read own ai usage" ON public.user_ai_usage USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own ai usage" ON public.user_ai_usage USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own favorites" ON public.user_favorite_jobs USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own favorites" ON public.user_favorite_jobs WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own favorites" ON public.user_favorite_jobs USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own favorites" ON public.user_favorite_jobs USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own interactions" ON public.user_interactions USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own interactions" ON public.user_interactions WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own interactions" ON public.user_interactions USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own quotas" ON public.user_job_quotas WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own quotas" ON public.user_job_quotas USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own quotas" ON public.user_job_quotas USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own learning settings" ON public.user_learning_settings USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own learning settings" ON public.user_learning_settings WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own learning settings" ON public.user_learning_settings USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own learning settings" ON public.user_learning_settings USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can delete reports" ON public.user_reports USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Admins can update reports" ON public.user_reports USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Admins can view all reports" ON public.user_reports USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));
ALTER POLICY "Users can create reports" ON public.user_reports WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own reports" ON public.user_reports USING (((select auth.uid()) = user_id));

COMMIT;
