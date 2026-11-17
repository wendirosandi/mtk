-- ============================================================================
-- 0011_integrity_fixes.sql  —  DRAFT
-- JANGAN diterapkan ke cloud tanpa persetujuan tertulis.
--
-- Berisi perbaikan integritas:
--   1. Policy audit_logs yang benar (idempoten)
--   2. Dedupe + unique index gradebook per (assessment, siswa)
--   3. app_score_attempt memakai upsert yang benar
--   4. Proteksi kolom profiles agar siswa tidak bisa mengubah sendiri
--   5. Event aktivitas (open/use/complete/submit) + RPC v2
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUDIT LOGS — pastikan kedua policy ada dan valid
-- ----------------------------------------------------------------------------
drop policy if exists ad_sel on public.audit_logs;
drop policy if exists ad_ins on public.audit_logs;

create policy ad_sel on public.audit_logs for select to authenticated
  using (public.app_is_guru() and (school_id = public.app_school() or school_id is null));

create policy ad_ins on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. GRADEBOOK — hapus duplikat, lalu pasang unique index
-- ----------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by assessment_id, profile_id
           order by updated_at desc nulls last, created_at desc, id desc
         ) as rn
  from public.gradebook_entries
  where entry_kind = 'assessment' and assessment_id is not null
)
delete from public.gradebook_entries g
using ranked r
where g.id = r.id and r.rn > 1;

create unique index if not exists ux_gb_assessment_profile
  on public.gradebook_entries(assessment_id, profile_id)
  where entry_kind = 'assessment' and assessment_id is not null;

-- ----------------------------------------------------------------------------
-- 3. SCORING — satu baris nilai per asesmen/siswa
-- ----------------------------------------------------------------------------
create or replace function public.app_score_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.attempts; asmt public.assessments; it public.question_items;
        raw numeric := 0; maxw numeric := 0; item_score numeric; frac numeric;
        resp jsonb; arr jsonb; keyarr jsonb; tol numeric; tot numeric; got numeric;
        cls uuid; yr uuid; final numeric;
begin
  select * into a from public.attempts where id = p_attempt;
  if a.id is null then return jsonb_build_object('ok',false,'msg','Percobaan tidak ditemukan'); end if;
  if a.profile_id <> auth.uid()
     and not public.app_guru_scope_assessment(a.assessment_id) then
    return jsonb_build_object('ok',false,'msg','Tidak berwenang'); end if;
  if a.status not in ('in_progress','submitted') then
    return jsonb_build_object('ok',false,'msg','Sudah dinilai'); end if;
  select * into asmt from public.assessments where id = a.assessment_id;

  for it in select * from public.question_items where assessment_id = asmt.id order by sort_order loop
    maxw := maxw + it.weight;
    select response into resp from public.attempt_answers where attempt_id = a.id and item_key = it.item_key;
    if resp is null then
      update public.attempt_answers set is_correct=false, score=0, checked_by='auto', checked_at=now()
       where attempt_id=a.id and item_key=it.item_key;
      continue;
    end if;
    item_score := 0; frac := 0;
    if it.kind = 'num' then
      tol := coalesce((it.payload->>'tol')::numeric, 0);
      if abs((resp->>'value')::numeric - (it.payload->>'answer')::numeric) <= tol then frac := 1; end if;
    elsif it.kind in ('mc','bs') then
      if lower(btrim(resp->>'value')) = lower(btrim(it.payload->>'key')) then frac := 1; end if;
    elsif it.kind = 'match' then
      keyarr := it.payload->'keys'; arr := resp->'values'; tot := 0; got := 0;
      for i in 0..jsonb_array_length(keyarr)-1 loop
        tot := tot + 1;
        if arr is not null and (arr->>i) = (keyarr->>i) then got := got + 1; end if;
      end loop;
      if tot > 0 then frac := got/tot; end if;
    elsif it.kind = 'scaffold' then
      keyarr := it.payload->'answers'; arr := resp->'values'; tol := coalesce((it.payload->>'tol')::numeric, 0);
      tot := 0; got := 0;
      for i in 0..jsonb_array_length(keyarr)-1 loop
        tot := tot + 1;
        if arr is not null and arr->i is not null
           and abs((arr->>i)::numeric - (keyarr->>i)::numeric) <= tol then got := got + 1; end if;
      end loop;
      if tot > 0 then frac := got/tot; end if;
    else
      update public.attempt_answers set is_correct=null, checked_by='guru', checked_at=now()
       where attempt_id=a.id and item_key=it.item_key;
      continue;
    end if;
    item_score := it.weight * frac;
    raw := raw + item_score;
    update public.attempt_answers
       set is_correct = (frac = 1), score = item_score, checked_by='auto', checked_at=now()
     where attempt_id=a.id and item_key=it.item_key;
  end loop;

  final := case when maxw > 0 then round(raw/maxw*100) else 0 end;
  update public.attempts set status='graded', submitted_at = coalesce(submitted_at, now()) where id = a.id;

  select cm.class_id, c.academic_year_id into cls, yr
    from public.class_memberships cm join public.classes c on c.id = cm.class_id
   where cm.profile_id = a.profile_id and cm.left_at is null limit 1;

  if cls is null then
    return jsonb_build_object('ok', false, 'msg', 'Siswa belum terdaftar di kelas; nilai tidak dapat disimpan');
  end if;

  insert into public.gradebook_entries
    (school_id, academic_year_id, class_id, profile_id, entry_kind, assessment_id, score, max_score, source, created_by)
  values (asmt.school_id, yr, cls, a.profile_id, 'assessment', asmt.id, final, 100, 'auto', auth.uid())
  on conflict (assessment_id, profile_id)
    where entry_kind = 'assessment' and assessment_id is not null
  do update set score = excluded.score,
                max_score = excluded.max_score,
                updated_at = now();

  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (asmt.school_id, auth.uid(), 'score_attempt','attempts', a.id::text, jsonb_build_object('score',final));
  return jsonb_build_object('ok',true,'score',final,'raw',raw,'max',maxw);
end $$;

-- ----------------------------------------------------------------------------
-- 4. PROFIL — siswa tidak boleh mengubah kolom sensitif sendiri
--    + admin harus bisa memperbarui profil warga sekolah (approval akun)
-- ----------------------------------------------------------------------------
drop policy if exists prof_upd_admin on public.profiles;
create policy prof_upd_admin on public.profiles for update to authenticated
  using (public.app_is_admin() and school_id = public.app_school())
  with check (public.app_is_admin() and school_id = public.app_school());

create or replace function public.protect_profile_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service role / job server (tanpa auth.uid) dan admin boleh
  if auth.uid() is null or public.app_is_admin() then return new; end if;

  if old.id = auth.uid() then
    if new.username is distinct from old.username
       or new.settings is distinct from old.settings
       or new.status is distinct from old.status
       or new.must_change_password is distinct from old.must_change_password
       or new.legacy_username is distinct from old.legacy_username
       or new.legacy_password_hash is distinct from old.legacy_password_hash
       or new.role is distinct from old.role
       or new.school_id is distinct from old.school_id
    then
      raise exception 'Perubahan kolom ini memerlukan persetujuan admin';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_self_guard on public.profiles;
create trigger trg_profiles_self_guard
  before update on public.profiles
  for each row execute function public.protect_profile_self_update();

-- ----------------------------------------------------------------------------
-- 5. AKTIVITAS — event eksplisit + RPC v2 (v1 tetap kompatibel)
-- ----------------------------------------------------------------------------
alter table public.activity_logs
  add column if not exists event text not null default 'use'
    check (event in ('open','use','complete','submit'));

update public.activity_logs
   set event = 'submit'
 where kind = 'submit' and event = 'use';

create index if not exists ix_act_app_event_day
  on public.activity_logs(app_code, event, log_date);

create or replace function public.app_ingest_activity_v2(
  p_app text,
  p_section text,
  p_event text,
  p_duration int default 0,
  p_score numeric default null,
  p_meta jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.profiles; mn int; mx int; cap int; cnt int; d int; k text;
begin
  if p_event not in ('open','use','complete','submit') then
    return jsonb_build_object('ok', false, 'msg', 'event tidak dikenal');
  end if;

  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return jsonb_build_object('ok', false, 'msg', 'Sesi tidak valid'); end if;

  k := case when p_event in ('complete','submit') then 'submit' else 'section' end;

  if k = 'section' then
    mn  := coalesce((select (s.settings->'activity'->>'min_sec')::int from public.schools s where s.id = p.school_id), 30);
    mx  := coalesce((select (s.settings->'activity'->>'max_sec')::int from public.schools s where s.id = p.school_id), 150);
    cap := coalesce((select (s.settings->'activity'->>'max_per_day')::int from public.schools s where s.id = p.school_id), 3);
    d := greatest(coalesce(p_duration, 0), 0);
    if d < mn then return jsonb_build_object('ok', false, 'msg', 'di bawah minimum'); end if;
    d := least(d, mx);

    select count(*) into cnt from public.activity_logs
     where profile_id = p.id and app_code = p_app and section = p_section
       and event = p_event and log_date = (now() at time zone 'Asia/Jakarta')::date;

    if p_event = 'open' and cnt >= 1 then
      return jsonb_build_object('ok', true, 'skipped', true, 'msg', 'open sudah dicatat hari ini');
    end if;
    if p_event = 'use' and cnt >= cap then
      return jsonb_build_object('ok', false, 'msg', 'cap harian tercapai');
    end if;
  else
    d := greatest(coalesce(p_duration, 0), 0);
  end if;

  insert into public.activity_logs
    (school_id, profile_id, app_code, section, kind, event, duration_sec, score, meta)
  values
    (p.school_id, p.id, p_app, p_section, k, p_event, d, p_score, coalesce(p_meta, '{}'::jsonb));

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.app_ingest_activity(
  p_app text,
  p_section text,
  p_kind text,
  p_duration int,
  p_score numeric default null
) returns jsonb language sql security definer set search_path = public as $$
  select public.app_ingest_activity_v2(
    p_app, p_section,
    case when p_kind = 'submit' then 'complete' else 'use' end,
    p_duration, p_score, '{}'::jsonb
  );
$$;

revoke all on function public.app_ingest_activity_v2(text, text, text, int, numeric, jsonb) from public, anon;
revoke all on function public.app_ingest_activity(text, text, text, int, numeric) from public, anon;
grant execute on function public.app_ingest_activity_v2(text, text, text, int, numeric, jsonb) to authenticated;
grant execute on function public.app_ingest_activity(text, text, text, int, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. LINT FIXES — subquery `id` ambigu & pgcrypto di schema extensions
-- ----------------------------------------------------------------------------
create or replace function public.app_get_subjects()
returns table (
  id uuid,
  code text,
  name text,
  grade_level_id uuid,
  grade_level_label text
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where public.profiles.id = auth.uid();
  if p.id is null then return; end if;

  if p.role = 'admin' then
    return query
    select s.id, s.code, s.name, gl.id, gl.label
    from public.subjects s
    cross join public.grade_levels gl
    where s.school_id = p.school_id
    order by s.code, gl.rank;
  elsif p.role = 'guru' then
    return query
    select distinct s.id, s.code, s.name, gl.id, gl.label
    from public.teacher_assignments ta
    join public.subjects s on s.id = ta.subject_id
    join public.classes c on c.id = ta.class_id or ta.class_id is null
    join public.grade_levels gl on gl.id = c.grade_level_id
    where ta.teacher_id = p.id
      and ta.academic_year_id = (
        select public.academic_years.id
        from public.academic_years
        where school_id = p.school_id and is_active
        limit 1
      )
    order by s.code, gl.label;
  else
    return query
    select distinct s.id, s.code, s.name, gl.id, gl.label
    from public.class_memberships cm
    join public.classes c on c.id = cm.class_id
    join public.grade_levels gl on gl.id = c.grade_level_id
    join public.teacher_assignments ta on ta.class_id = c.id or ta.class_id is null
    join public.subjects s on s.id = ta.subject_id
    where cm.profile_id = p.id and cm.left_at is null
      and ta.academic_year_id = c.academic_year_id
    order by s.code, gl.label;
  end if;
end $$;

create or replace function public.app_verify_legacy_password(p_username text, p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select legacy_password_hash into h from public.profiles
   where username = p_username and school_id = public.app_school();
  if h is null then return false; end if;
  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id)
  values (public.app_school(), auth.uid(), 'legacy_pw_check','profiles',p_username);
  return h = encode(digest(p_password,'sha256'),'hex');
end $$;

revoke all on function public.app_get_subjects() from public, anon;
revoke all on function public.app_verify_legacy_password(text,text) from public, anon;
grant execute on function public.app_get_subjects() to authenticated;
grant execute on function public.app_verify_legacy_password(text,text) to authenticated;
