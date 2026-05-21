-- Auto-apply Milestone 1: extracted questions (shared per posting) + per-user drafts.

create table if not exists public.job_application_questions (
  id            uuid primary key default gen_random_uuid(),
  posting_key   text not null,
  field_key     text not null,
  label         text not null,
  field_type    text not null,
  semantic_type text not null default 'text',
  required      boolean not null default false,
  options       jsonb,
  source        text not null,
  position      integer not null default 0,
  extracted_at  timestamptz not null default now(),
  unique (posting_key, field_key)
);
create index if not exists job_application_questions_posting_key_idx
  on public.job_application_questions (posting_key);

create table if not exists public.job_applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  job_id       uuid not null references public.jobs (id) on delete cascade,
  posting_key  text not null,
  answers      jsonb not null default '{}'::jsonb,
  status       text not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, job_id)
);
create index if not exists job_applications_user_id_idx
  on public.job_applications (user_id);

alter table public.job_application_questions enable row level security;
alter table public.job_applications enable row level security;

create policy "questions readable by authenticated"
  on public.job_application_questions for select
  to authenticated using (true);

create policy "applications selectable by owner"
  on public.job_applications for select to authenticated
  using (auth.uid() = user_id);
create policy "applications insertable by owner"
  on public.job_applications for insert to authenticated
  with check (auth.uid() = user_id);
create policy "applications updatable by owner"
  on public.job_applications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
