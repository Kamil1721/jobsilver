-- Auto-apply Milestone 2: track the Skyvern submission run on each application.

alter table public.job_applications
  add column if not exists skyvern_run_id        text,
  add column if not exists skyvern_app_url       text,
  add column if not exists result_screenshot_url text,
  add column if not exists failure_reason        text,
  add column if not exists submitted_at          timestamptz;
