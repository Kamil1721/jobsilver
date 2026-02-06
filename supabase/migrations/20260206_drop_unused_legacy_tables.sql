-- Drop unused legacy tables from the removed auto-apply system (removed 2026-01-29)
-- and other write-only/ghost tables that are never read by the application.
--
-- Tables dropped:
--   application_queue    - auto-apply queue, never written to since removal
--   platform_credentials - encrypted ATS credentials, never used
--   scraper_failures     - scraper error logs, never written to since removal
--   scraped_questions    - scraped form questions, never written to since removal
--   saved_answers        - saved application answers, no code writes new rows
--   application_history  - write-only audit log, never read by any feature

-- Drop in order respecting foreign key dependencies
DROP TABLE IF EXISTS application_queue CASCADE;
DROP TABLE IF EXISTS platform_credentials CASCADE;
DROP TABLE IF EXISTS scraper_failures CASCADE;
DROP TABLE IF EXISTS scraped_questions CASCADE;
DROP TABLE IF EXISTS saved_answers CASCADE;
DROP TABLE IF EXISTS application_history CASCADE;

-- Also drop the ghost user_preferences table if it exists
-- (the actual table is user_ai_preferences; user_preferences was never created via migrations)
DROP TABLE IF EXISTS user_preferences CASCADE;
