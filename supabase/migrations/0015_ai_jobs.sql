-- ============================================================================
-- 0015_ai_jobs.sql  —  DRAFT
-- Jejak permintaan AI Guru. Hasil tetap draft; tidak ada auto-publish.
-- ============================================================================

create table if not exists public.ai_jobs (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id),
  requested_by  uuid not null references public.profiles(id) on delete cascade,
  kind          text not null check (kind in ('module','material','lkpd','kuis','bank')),
  status        text not null default 'queued'
                check (status in ('queued','running','done','failed','approved','rejected')),
  params        jsonb not null default '{}'::jsonb,
  result        jsonb not null default '{}'::jsonb,
  provider      text,
  model         text,
  tokens_in     int,
  tokens_out    int,
  error         text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists ix_ai_jobs_user on public.ai_jobs(requested_by, created_at desc);
create index if not exists ix_ai_jobs_school on public.ai_jobs(school_id, status);

alter table public.ai_jobs enable row level security;

create policy ai_sel on public.ai_jobs for select to authenticated using (
  requested_by = auth.uid()
  or (public.app_is_guru() and school_id = public.app_school())
);
create policy ai_ins on public.ai_jobs for insert to authenticated with check (
  requested_by = auth.uid() and school_id = public.app_school()
);
create policy ai_upd on public.ai_jobs for update to authenticated
  using (public.app_is_guru() and school_id = public.app_school())
  with check (public.app_is_guru() and school_id = public.app_school());
