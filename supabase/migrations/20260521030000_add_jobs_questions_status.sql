-- Auto-apply: link per-user job rows to their extracted question set.
-- posting_key      — canonical posting identity (sha256 of the normalized
--                    application URL); matches job_application_questions.posting_key.
-- questions_status — extraction lifecycle for this posting's question set:
--                    pending  — not yet attempted (default for new rows)
--                    ready    — questions extracted (or posting genuinely has none)
--                    failed   — a supported ATS returned an error
--                    unsupported — URL is not a Greenhouse/Lever/Ashby ATS

alter table public.jobs
  add column if not exists posting_key text,
  add column if not exists questions_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_questions_status_check'
  ) then
    alter table public.jobs
      add constraint jobs_questions_status_check
      check (questions_status in ('pending', 'ready', 'failed', 'unsupported'));
  end if;
end $$;

create index if not exists jobs_posting_key_idx on public.jobs (posting_key);
