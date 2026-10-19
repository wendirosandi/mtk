-- 0006_bank_soal.sql — Bank Soal, Pool, Kisi-kisi, Generator, Paket, Snapshot
-- Mode default: paket-level (sama untuk semua siswa). attempt_items = opsi per-siswa (belum aktif).

-- ---------- 1. POOL (kelompok/sumber soal; BUKAN kesulitan) ----------
create table public.question_pools(
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id),
  subject_id  uuid not null references public.subjects(id),
  topic_id    uuid references public.topics(id),
  title       text not null,
  description text,
  config      jsonb not null default '{}'::jsonb,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, subject_id, title)
);

-- ---------- 2. TEMPLATE GENERATOR (logika+params+versi) ----------
create table public.generator_templates(
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id),
  subject_id    uuid references public.subjects(id),
  code          text not null,
  name          text not null,
  version       int  not null default 1,
  params_schema jsonb not null default '{}'::jsonb,
  producer      text,                 -- referensi producer tepercaya (edge/admin)
  status        text not null default 'draft' check (status in ('draft','active','deprecated')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (school_id, code, version)
);

-- ---------- 3. BANK SOAL TERPUSAT (reusable; difficulty A/B/C opsional) ----------
create table public.bank_items(
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id),
  subject_id            uuid not null references public.subjects(id),
  pool_id               uuid references public.question_pools(id) on delete set null,
  indicator             text,
  kind                  text not null,
  difficulty            text check (difficulty is null or difficulty in ('A','B','C')),
  payload               jsonb not null default '{}'::jsonb,   -- soal+key statis ATAU params template
  generator_template_id uuid references public.generator_templates(id),
  version               int not null default 1,
  status                text not null default 'active' check (status in ('draft','active','archived')),
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index ix_bank_match on public.bank_items(subject_id, indicator, difficulty, kind, status);
create index ix_bank_pool  on public.bank_items(pool_id);

-- ---------- 4. KISI-KISI (blueprint per asesmen) ----------
create table public.kisi_kisi(
  id                    uuid primary key default gen_random_uuid(),
  assessment_id         uuid not null references public.assessments(id) on delete cascade,
  indicator             text,
  difficulty            text check (difficulty is null or difficulty in ('A','B','C')),
  kind                  text,
  pool_id               uuid references public.question_pools(id),
  generator_template_id uuid references public.generator_templates(id),
  count                 int not null default 1 check (count > 0),
  weight                numeric not null default 1 check (weight >= 0),
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  unique (assessment_id, sort_order)
);

-- ---------- 5. SNAPSHOT PER-ATTEMPT (opsi per-siswa; belum dipakai scoring) ----------
create table public.attempt_items(
  attempt_id        uuid not null references public.attempts(id) on delete cascade,
  item_key          text not null,
  rendered          jsonb not null,          -- soal tampil (TANPA key)
  answer_key        jsonb,                   -- key (disembunyikan dari siswa)
  source_type       text not null check (source_type in ('static','bank','generated')),
  source_id         uuid,
  seed              bigint,
  generator_version int,
  created_at        timestamptz not null default now(),
  primary key (attempt_id, item_key)
);

-- ---------- 6. Perluas question_items (penelusuran asal) ----------
alter table public.question_items
  add column if not exists source_type text not null default 'static'
    check (source_type in ('static','bank','generated')),
  add column if not exists source_id uuid,
  add column if not exists seed bigint,
  add column if not exists generator_version int;

-- ---------- 7. Freeze marker di level asesmen ----------
alter table public.assessments
  add column if not exists package_frozen_at timestamptz;

-- bekukan paket yang SUDAH punya attempt (backfill, mis. MTK-8202)
update public.assessments a set package_frozen_at = now()
 where a.package_frozen_at is null
   and exists (select 1 from public.attempts t where t.assessment_id = a.id);

-- set freeze saat attempt pertama masuk
create or replace function public.freeze_package_on_attempt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.assessments set package_frozen_at = now()
   where id = new.assessment_id and package_frozen_at is null;
  return new;
end $$;
create trigger trg_freeze_on_attempt after insert on public.attempts
  for each row execute function public.freeze_package_on_attempt();

-- cegah perubahan substansial paket setelah beku
create or replace function public.protect_frozen_package() returns trigger
language plpgsql security definer set search_path = public as $$
declare frozen timestamptz;
begin
  select package_frozen_at into frozen from public.assessments where id = old.assessment_id;
  if frozen is not null then
    if tg_op = 'DELETE' then
      raise exception 'Paket beku: dilarang menghapus soal setelah attempt dimulai';
    end if;
    if old.payload is distinct from new.payload
       or old.kind is distinct from new.kind
       or old.weight is distinct from new.weight
       or old.item_key is distinct from new.item_key then
      raise exception 'Paket beku: dilarang mengubah soal setelah attempt dimulai';
    end if;
  end if;
  return new;
end $$;
create trigger trg_protect_package before update or delete on public.question_items
  for each row execute function public.protect_frozen_package();

-- ---------- 8. Helper buang kunci (untuk render ke siswa) ----------
create or replace function public.strip_answer_keys(p jsonb) returns jsonb
language sql immutable as $$
  select p - 'answer' - 'key' - 'keys' - 'answers' - 'answer_key';
$$;

-- ---------- 9. RPC baca paket (render TANPA key) ----------
create or replace function public.app_get_package_items(p_assessment_id uuid)
returns table (item_key text, kind text, difficulty text, weight numeric, sort_order int, rendered jsonb)
language sql stable security definer set search_path = public as $$
  select q.item_key, q.kind, q.difficulty, q.weight, q.sort_order, public.strip_answer_keys(q.payload)
  from public.question_items q
  join public.assessments a on a.id = q.assessment_id
  where q.assessment_id = p_assessment_id
    and a.school_id = public.app_school()
    and a.status not in ('draft','deleted')
  order by q.sort_order;
$$;

create or replace function public.app_get_attempt_items(p_attempt_id uuid)
returns table (item_key text, rendered jsonb)
language sql stable security definer set search_path = public as $$
  select ai.item_key, ai.rendered
  from public.attempt_items ai
  join public.attempts t on t.id = ai.attempt_id
  where ai.attempt_id = p_attempt_id
    and (t.profile_id = auth.uid()
         or public.app_guru_scope_assessment(t.assessment_id));
$$;

-- ---------- 10. Builder paket (statis + bank; generator DITUNDA) ----------
create or replace function public.app_build_package(p_assessment_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a public.assessments; k public.kisi_kisi; rec record; added int := 0; skipped int := 0;
begin
  select * into a from public.assessments where id = p_assessment_id;
  if a.id is null then return jsonb_build_object('ok',false,'msg','Asesmen tidak ditemukan'); end if;
  if not public.app_is_guru() then return jsonb_build_object('ok',false,'msg','Tidak berwenang'); end if;
  if a.package_frozen_at is not null then return jsonb_build_object('ok',false,'msg','Paket sudah beku'); end if;

  for k in select * from public.kisi_kisi where assessment_id = a.id order by sort_order loop
    if k.generator_template_id is not null then
      skipped := skipped + 1;   -- generator belum diaktifkan (keputusan #4)
      continue;
    end if;
    for rec in
      select b.id, b.payload, b.kind, b.difficulty
      from public.bank_items b
      where b.school_id = a.school_id and b.subject_id = a.subject_id and b.status='active'
        and (k.indicator is null or b.indicator = k.indicator)
        and (k.difficulty is null or b.difficulty = k.difficulty)
        and (k.kind is null or b.kind = k.kind)
        and (k.pool_id is null or b.pool_id = k.pool_id)
      order by b.created_at
      limit k.count
    loop
      insert into public.question_items
        (assessment_id, item_key, kind, difficulty, payload, weight, sort_order, source_type, source_id)
      values (a.id, 'item-'||added, rec.kind, rec.difficulty, rec.payload, k.weight, added, 'bank', rec.id)
      on conflict (assessment_id, item_key) do nothing;
      added := added + 1;
    end loop;
  end loop;
  return jsonb_build_object('ok',true,'added',added,'generator_skipped',skipped);
end $$;

-- ---------- 11. RLS tabel baru ----------
alter table public.question_pools     enable row level security;
alter table public.generator_templates enable row level security;
alter table public.bank_items         enable row level security;
alter table public.kisi_kisi          enable row level security;
alter table public.attempt_items      enable row level security;

create policy qp_sel on public.question_pools for select to authenticated using (school_id = public.app_school());
create policy qp_wrt on public.question_pools for all to authenticated using (public.app_is_guru() and school_id = public.app_school()) with check (public.app_is_guru());

-- template: baca+tulis hanya guru/admin (params bisa membocorkan pola)
create policy gt_sel on public.generator_templates for select to authenticated using (public.app_is_guru() and school_id = public.app_school());
create policy gt_wrt on public.generator_templates for all to authenticated using (public.app_is_guru()) with check (public.app_is_guru());

-- bank_items berisi KEY: siswa TIDAK boleh baca
create policy bi_sel on public.bank_items for select to authenticated using (public.app_is_guru() and school_id = public.app_school());
create policy bi_wrt on public.bank_items for all to authenticated using (public.app_is_guru()) with check (public.app_is_guru());

-- kisi-kisi (tanpa key): baca warga sekolah, tulis guru
create policy kk_sel on public.kisi_kisi for select to authenticated using (exists (select 1 from public.assessments a where a.id = assessment_id and a.school_id = public.app_school()));
create policy kk_wrt on public.kisi_kisi for all to authenticated using (public.app_is_guru()) with check (public.app_is_guru());

-- attempt_items berisi answer_key: siswa TIDAK boleh select langsung (hanya via RPC rendered)
create policy ai_sel on public.attempt_items for select to authenticated using (public.app_is_guru());
-- insert/update attempt_items hanya via RPC security definer (tidak ada policy tulis)

-- ---------- 12. Grants RPC ----------
revoke all on function public.app_get_package_items(uuid) from public, anon;
revoke all on function public.app_get_attempt_items(uuid) from public, anon;
revoke all on function public.app_build_package(uuid) from public, anon;
grant execute on function public.app_get_package_items(uuid) to authenticated;
grant execute on function public.app_get_attempt_items(uuid) to authenticated;
grant execute on function public.app_build_package(uuid) to authenticated;