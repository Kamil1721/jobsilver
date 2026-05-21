-- Auto-apply: allow a per-application resume that overrides the profile CV.
-- NULL resume_override_path => the application uses the user's profile CV.

alter table public.job_applications
  add column if not exists resume_override_path     text,
  add column if not exists resume_override_filename text;
