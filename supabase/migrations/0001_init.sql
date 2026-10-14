-- ============================================================================
-- 0001_init.sql — Fondasi skema LMS (Supabase/Postgres 15+)
-- Kebijakan: tidak menyalin struktur Sheets; rancangan normal per domain.
-- ============================================================================
create extension if not exists pgcrypto;

-- ---------- ENUM ----------
do $$ begin
  create type public.user_role      as enum ('admin','guru','siswa');
  create type public.lkpd_status    as enum ('draft','active','exambro','inactive','locked','archived','deleted');
  create type public.collab_mode    as enum ('none','optional','optional_fixed','required','required_fixed');
  create type public.delivery_mode  as enum ('portal','exambro','direct');
  create type public.assessment_kind as enum ('lkpd','kuis','tugas','projek');
  create type public.attempt_status as enum ('in_progress','submitted','graded','void');
  create type public.checked_by     as enum ('auto','guru','ai');
  create type public.rating_level   as enum ('kurang','cukup','baik','sangat_baik');
  create type public.grant_reason   as enum ('susulan','remedial','pengayaan','lain');
  create type public.entry_kind     as enum ('assessment','manual');
  create type public.audience_type  as enum ('user','class','role','school');
exception when duplicate_object then null; end $$;

-- ---------- trigger util ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- SEKOLAH & PENGATURAN ----------
create table public.schools(
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  logo_url    text,
  headmaster  text,
  address     text,
  settings    jsonb not null default '{}'::jsonb,   -- activity caps, semester aktif, TA, flags
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_schools_upd before update on public.schools
  for each row execute function public.set_updated_at();

-- ---------- PROFIL (terpisah dari auth.users) ----------
create table public.profiles(
  id                   uuid primary key references auth.users(id) on delete cascade,
  school_id            uuid not null references public.schools(id),
  role                 public.user_role not null,
  username             text not null,
  full_name            text not null,
  gender               text check (gender in ('L','P')),
  status               text not null default 'aktif',
  legacy_username      text,
  legacy_password_hash text,                 -- SHA-256 hex lama; NULL-kan setelah migrasi login
  must_change_password boolean not null default false,
  settings             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (school_id, username)
);
create trigger trg_profiles_upd before update on public.profiles
  for each row execute function public.set_updated_at();

-- anti eskalasi: role & school hanya boleh diubah admin
create or replace function public.protect_profile_privilege() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.role is distinct from new.role or old.school_id is distinct from new.school_id)
     and not public.app_is_admin() then
    raise exception 'Perubahan role/sekolah hanya boleh oleh admin';
  end if;
  return new;
end $$;
create trigger trg_profiles_priv before update on public.profiles
  for each row execute function public.protect_profile_privilege();

-- ---------- TAHUN PELAJARAN / TINGKAT / KELAS ----------
create table public.academic_years(
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id),
  label      text not null,
  start_date date not null,
  end_date   date not null,
  is_active  boolean not null default false,
  unique (school_id, label),
  check (end_date > start_date)
);
create table public.grade_levels(
  id        uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  label     text not null,
  rank      int  not null check (rank between 1 and 13),
  unique (school_id, rank)
);
create table public.classes(
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  grade_level_id   uuid not null references public.grade_levels(id),
  label            text not null,
  homeroom_id      uuid references public.profiles(id),
  unique (academic_year_id, label)
);
create table public.class_memberships(
  class_id   uuid not null references public.classes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  primary key (class_id, profile_id)
);

-- ---------- MAPEL & PENUGASAN GURU (multi-mapel, multi-guru) ----------
create table public.subjects(
  id        uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  code      text not null,
  name      text not null,
  unique (school_id, code)
);
create table public.teacher_assignments(
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id),
  subject_id       uuid not null references public.subjects(id),
  teacher_id       uuid not null references public.profiles(id),
  academic_year_id uuid not null references public.academic_years(id),
  class_id         uuid references public.classes(id),  -- null = semua kelas mapel tsb
  unique (subject_id, teacher_id, academic_year_id, class_id)
);

-- ---------- MODUL / TOPIK / MATERI ----------
create table public.modules(
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id),
  subject_id     uuid not null references public.subjects(id),
  grade_level_id uuid not null references public.grade_levels(id),
  title          text not null,
  description    text,
  sort_order     int not null default 0,
  unique (subject_id, grade_level_id, title)
);
create table public.topics(
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.modules(id) on delete cascade,
  title      text not null,
  sort_order int not null default 0,
  unique (module_id, title)
);
create table public.materials(
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.topics(id) on delete cascade,
  kind       text not null default 'dokumen' check (kind in ('dokumen','video','app','geogebra','pdf','lkpd_ref')),
  title      text not null,
  url        text,
  meta       jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

-- ---------- ASESMEN (LKPD/KUIS/TUGAS/PROJEK) ----------
create table public.assessments(
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id),
  code             text not null,
  legacy_code      text,
  subject_id       uuid not null references public.subjects(id),
  module_id        uuid references public.modules(id),
  topic_id         uuid references public.topics(id),
  academic_year_id uuid not null references public.academic_years(id),
  semester         int check (semester in (1,2)),
  title            text not null,
  kind             public.assessment_kind not null default 'lkpd',
  status           public.lkpd_status not null default 'draft',
  collab_mode      public.collab_mode not null default 'none',
  delivery         public.delivery_mode not null default 'portal',
  file_url         text,
  config           jsonb not null default '{}'::jsonb,  -- generator, rubrik, timer, caps
  published_at     timestamptz,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (school_id, code),
  check (status <> 'active' or published_at is not null)
);
create trigger trg_assessments_upd before update on public.assessments
  for each row execute function public.set_updated_at();
create index ix_assess_school_status on public.assessments(school_id, status);
create index ix_assess_legacy on public.assessments(legacy_code);

create table public.question_items(
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  item_key      text not null,
  kind          text not null,             -- num|mc|bs|match|scaffold|text|legacy_raw
  difficulty    text,
  payload       jsonb not null default '{}'::jsonb,
  weight        numeric not null default 1 check (weight >= 0),
  sort_order    int not null default 0,
  unique (assessment_id, item_key)
);

-- ---------- PERCOBAAN & JAWABAN ----------
create table public.attempts(
  id                uuid primary key default gen_random_uuid(),
  assessment_id     uuid not null references public.assessments(id) on delete cascade,
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  partner_id        uuid references public.profiles(id),
  attempt_no        int  not null default 1 check (attempt_no >= 1),
  status            public.attempt_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  client_duration_sec int check (client_duration_sec is null or client_duration_sec >= 0),
  flags             jsonb not null default '{}'::jsonb,
  source            text not null default 'portal',
  created_at        timestamptz not null default now(),
  unique (assessment_id, profile_id, attempt_no)
);
create index ix_attempts_owner on public.attempts(profile_id, assessment_id);
create index ix_attempts_assess on public.attempts(assessment_id, status);

create table public.attempt_answers(
  attempt_id  uuid not null references public.attempts(id) on delete cascade,
  item_key    text not null,
  response    jsonb not null,
  is_correct  boolean,
  score       numeric check (score is null or score >= 0),
  checked_by  public.checked_by,
  checked_at  timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (attempt_id, item_key)
);

-- ---------- GRADEBOOK (ledger nilai, terpisah per jenis via assessment.kind) ----------
create table public.gradebook_entries(
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  class_id         uuid not null references public.classes(id),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  entry_kind       public.entry_kind not null default 'assessment',
  assessment_id    uuid references public.assessments(id) on delete cascade,
  score_kind       public.assessment_kind,
  score            numeric check (score is null or score >= 0),
  max_score        numeric not null default 100 check (max_score > 0),
  letter           text,
  weight           numeric not null default 1 check (weight >= 0),
  source           text not null default 'auto' check (source in ('auto','manual','legacy_pending','impor')),
  note             text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((entry_kind = 'assessment') = (assessment_id is not null))
);
create trigger trg_gradebook_upd before update on public.gradebook_entries
  for each row execute function public.set_updated_at();
create index ix_gb_class_profile on public.gradebook_entries(class_id, profile_id);
create index ix_gb_profile_kind on public.gradebook_entries(profile_id, score_kind);
create index ix_gb_assess on public.gradebook_entries(assessment_id);

-- konsistensi score_kind dengan assessment.kind
create or replace function public.enforce_gradebook_kind() returns trigger
language plpgsql security definer set search_path = public as $$
declare k public.assessment_kind;
begin
  if new.assessment_id is not null then
    select kind into k from public.assessments where id = new.assessment_id;
    new.score_kind := k;
  end if;
  return new;
end $$;
create trigger trg_gb_kind before insert or update on public.gradebook_entries
  for each row execute function public.enforce_gradebook_kind();

-- ---------- PERFORMA (5 dimensi) ----------
create table public.performance_ratings(
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  rater         text not null check (rater in ('self','teacher')),
  dimension     text not null check (dimension in ('diri','lkpd','sikap','pengetahuan','keterampilan')),
  rating        public.rating_level not null,
  note          text,
  updated_at    timestamptz not null default now(),
  unique (assessment_id, profile_id, rater, dimension)
);

-- ---------- KOLABORASI & AKSES KHUSUS ----------
create table public.collab_pairs(
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id),
  assessment_id uuid references public.assessments(id) on delete cascade, -- null = wildcard semua asesmen
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  partner_id    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','approved','rejected','replaced')),
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  replaced_by   uuid references public.collab_pairs(id),
  check (owner_id <> partner_id)
);
create index ix_collab_owner on public.collab_pairs(owner_id, assessment_id);
create index ix_collab_partner on public.collab_pairs(partner_id, assessment_id);

create table public.access_grants(
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  reason        public.grant_reason not null default 'susulan',
  valid_until   date,
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (assessment_id, profile_id)
);

-- ---------- AKTIFITAS ----------
create table public.activity_logs(
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid references public.schools(id),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  app_code     text not null,
  section      text not null,
  kind         text not null check (kind in ('section','submit')),
  duration_sec int  not null check (duration_sec >= 0),
  score        numeric,
  meta         jsonb not null default '{}'::jsonb,
  logged_at    timestamptz not null default now(),
  log_date     date not null default ((now() at time zone 'Asia/Jakarta')::date)
);
create index ix_act_owner_day on public.activity_logs(profile_id, log_date, app_code, section);

-- ---------- NOTIFIKASI ----------
create table public.notifications(
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id),
  kind         text not null,
  title        text not null,
  body         text,
  audience     public.audience_type not null,
  audience_ref text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create table public.notification_reads(
  notification_id uuid not null references public.notifications(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, profile_id)
);

-- ---------- AUDIT ----------
create table public.audit_logs(
  id        uuid primary key default gen_random_uuid(),
  school_id uuid,
  actor_id  uuid references public.profiles(id),
  action    text not null,
  entity    text not null,
  entity_id text,
  detail    jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);
create index ix_audit_actor on public.audit_logs(actor_id, at);

-- ---------- CROSSWALK KODE LEGACY (konfigurasi bisnis wajib) ----------
create table public.legacy_crosswalk(
  legacy_code text primary key,
  new_code    text not null,
  legacy_file text,
  note        text
);
insert into public.legacy_crosswalk (legacy_code, new_code, legacy_file, note) values
  ('MTK-001','MTK-8102','LKPD/MTK001.html','Remap 2026; delivery exambro/LoginDirect'),
  ('MTK-002','MTK-8103','LKPD/MTK002.html','Remap 2026; delivery exambro/LoginDirect'),
  ('MTK-003','MTK-8104','LKPD/MTK003.html','Remap 2026; delivery exambro/LoginDirect'),
  ('MTK-004','MTK-8202','LKPD/MTK004.html','Remap 2026; kolab Wajib'),
  ('MTK-005','MTK-8203','LKPD/MTK005.html','Remap 2026; PTS Ganjil')
on conflict (legacy_code) do nothing;

-- ---------- SEED MINIMAL (placeholder jelas) ----------
insert into public.schools (code, name, headmaster, settings) values
  ('PLACEHOLDER-SCHOOL','{{NAMA_SEKOLAH}}','{{NAMA_KEPALA}}',
   '{"activity":{"min_sec":30,"max_sec":150,"max_per_day":3},"semester_active":"Ganjil","ta_active":"{{TA}}"}'::jsonb)
on conflict (code) do nothing;

insert into public.grade_levels (school_id, label, rank)
select s.id, v.l, v.r from public.schools s
join (values ('7',7),('8',8),('9',9)) v(l,r) on true
where s.code='PLACEHOLDER-SCHOOL'
on conflict (school_id, rank) do nothing;

insert into public.academic_years (school_id, label, start_date, end_date, is_active)
select s.id, '{{TA_ACTIVE}}', date '{{TA_START}}', date '{{TA_END}}', true
from public.schools s where s.code='PLACEHOLDER-SCHOOL'
on conflict (school_id, label) do nothing;

insert into public.subjects (school_id, code, name)
select s.id, 'MTK', 'Matematika' from public.schools s where s.code='PLACEHOLDER-SCHOOL'
on conflict (school_id, code) do nothing;

-- ---------- VIEW bantu ----------
create or replace view public.v_attempt_duration as
select a.id, a.assessment_id, a.profile_id, a.status,
       a.client_duration_sec,
       case when a.submitted_at is not null
            then (extract(epoch from (a.submitted_at - a.started_at)))::int end as server_duration_sec
from public.attempts a;