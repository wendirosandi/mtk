-- ============================================================================
-- 0016_categories.sql
-- Kategori umum (Walas) + kategori per mata pelajaran (Guru mapel).
-- Tidak menghapus data lama; profiles.settings.kategori tetap sebagai fallback.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABEL
-- ----------------------------------------------------------------------------
create table public.student_general_categories (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  class_id         uuid not null references public.classes(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  category         text not null check (category in ('A','B','C')),
  updated_by       uuid references public.profiles(id) on delete set null,
  updated_at       timestamptz not null default now(),
  unique (profile_id, academic_year_id)
);
create index ix_sgc_class on public.student_general_categories(class_id, academic_year_id);
create index ix_sgc_profile on public.student_general_categories(profile_id);

create table public.student_subject_categories (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  class_id         uuid not null references public.classes(id) on delete cascade,
  subject_id       uuid not null references public.subjects(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  category         text not null check (category in ('A','B','C')),
  updated_by       uuid references public.profiles(id) on delete set null,
  updated_at       timestamptz not null default now(),
  unique (profile_id, subject_id, academic_year_id)
);
create index ix_ssc_class_subject on public.student_subject_categories(class_id, subject_id, academic_year_id);
create index ix_ssc_profile on public.student_subject_categories(profile_id);

create table public.category_history (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id),
  academic_year_id  uuid not null references public.academic_years(id),
  class_id          uuid references public.classes(id) on delete set null,
  profile_id        uuid references public.profiles(id) on delete set null,
  scope             text not null check (scope in ('general','subject')),
  subject_id        uuid references public.subjects(id) on delete set null,
  category          text not null check (category in ('A','B','C')),
  previous_category text check (previous_category is null or previous_category in ('A','B','C')),
  changed_by        uuid references public.profiles(id) on delete set null,
  changed_at        timestamptz not null default now(),
  source            text not null default 'admin'
                    check (source in ('walas','guru','admin','migration','import')),
  note              text,
  check ((scope = 'general' and subject_id is null) or (scope = 'subject' and subject_id is not null))
);
create index ix_cat_hist_profile on public.category_history(profile_id, changed_at desc);
create index ix_cat_hist_class on public.category_history(class_id, academic_year_id);

-- ----------------------------------------------------------------------------
-- 2. VALIDASI & AUDIT
-- ----------------------------------------------------------------------------
create or replace function public.validate_student_category() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles; c public.classes;
begin
  select * into p from public.profiles where id = new.profile_id;
  select * into c from public.classes where id = new.class_id;

  if p.id is null or p.role <> 'siswa' then
    raise exception 'Profil bukan siswa';
  end if;
  if p.school_id <> new.school_id then
    raise exception 'Siswa di luar sekolah';
  end if;
  if c.id is null or c.school_id <> new.school_id or c.academic_year_id <> new.academic_year_id then
    raise exception 'Kelas/tahun tidak sesuai';
  end if;
  if not exists (
    select 1 from public.class_memberships cm
    where cm.class_id = new.class_id and cm.profile_id = new.profile_id and cm.left_at is null
  ) then
    raise exception 'Siswa bukan anggota aktif kelas';
  end if;
  if tg_table_name = 'student_subject_categories' then
    if not exists (
      select 1 from public.subjects s
      where s.id = (to_jsonb(new)->>'subject_id')::uuid
        and s.school_id = new.school_id
    ) then
      raise exception 'Mapel di luar sekolah';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger trg_sgc_validate before insert or update on public.student_general_categories
  for each row execute function public.validate_student_category();
create trigger trg_ssc_validate before insert or update on public.student_subject_categories
  for each row execute function public.validate_student_category();

create or replace function public.validate_homeroom_teacher() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if new.homeroom_id is not null then
    select * into p from public.profiles where id = new.homeroom_id;
    if p.id is null or p.role <> 'guru' or p.school_id <> new.school_id then
      raise exception 'Wali kelas harus guru di sekolah yang sama';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_class_homeroom_validate on public.classes;
create trigger trg_class_homeroom_validate before insert or update on public.classes
  for each row execute function public.validate_homeroom_teacher();

create or replace function public.audit_homeroom_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.homeroom_id is not distinct from old.homeroom_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.homeroom_id is null then
    return new;
  end if;

  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (
    new.school_id, auth.uid(), 'assign_homeroom', 'classes', new.id::text,
    jsonb_build_object(
      'old', case when tg_op = 'UPDATE' then old.homeroom_id::text else null end,
      'new', new.homeroom_id::text
    )
  );
  return new;
end $$;

drop trigger if exists trg_class_homeroom_audit on public.classes;
create trigger trg_class_homeroom_audit after insert or update on public.classes
  for each row execute function public.audit_homeroom_change();

-- ----------------------------------------------------------------------------
-- 3. RLS (baca saja; penulisan hanya via RPC SECURITY DEFINER)
-- ----------------------------------------------------------------------------
alter table public.student_general_categories enable row level security;
alter table public.student_subject_categories enable row level security;
alter table public.category_history enable row level security;

create policy sgc_sel on public.student_general_categories for select to authenticated using (
  profile_id = auth.uid()
  or public.app_is_admin()
  or exists (
    select 1 from public.classes c
    where c.id = class_id and c.homeroom_id = auth.uid()
  )
);

create policy ssc_sel on public.student_subject_categories for select to authenticated using (
  profile_id = auth.uid()
  or public.app_is_admin()
  or exists (
    select 1 from public.classes c
    where c.id = class_id and c.homeroom_id = auth.uid()
  )
  or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.subject_id = student_subject_categories.subject_id
      and ta.academic_year_id = student_subject_categories.academic_year_id
      and (ta.class_id is null or ta.class_id = student_subject_categories.class_id)
  )
);

create policy cat_hist_sel on public.category_history for select to authenticated using (
  profile_id = auth.uid()
  or public.app_is_admin()
  or exists (
    select 1 from public.classes c
    where c.id = category_history.class_id and c.homeroom_id = auth.uid()
  )
  or (
    scope = 'subject' and exists (
      select 1 from public.teacher_assignments ta
      where ta.teacher_id = auth.uid()
        and ta.subject_id = category_history.subject_id
        and ta.academic_year_id = category_history.academic_year_id
        and (ta.class_id is null or ta.class_id = category_history.class_id)
    )
  )
);

revoke all on public.student_general_categories from anon;
revoke all on public.student_subject_categories from anon;
revoke all on public.category_history from anon;
grant select on public.student_general_categories to authenticated;
grant select on public.student_subject_categories to authenticated;
grant select on public.category_history to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC BACA
-- ----------------------------------------------------------------------------
create or replace function public.app_get_my_categories()
returns table (
  scope text,
  subject_id uuid,
  subject_code text,
  subject_name text,
  category text,
  updated_at timestamptz
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles; y uuid;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return; end if;
  select id into y from public.academic_years
   where school_id = p.school_id and is_active limit 1;

  return query
  select 'umum'::text, null::uuid, null::text, null::text, g.category, g.updated_at
  from (select 1) x
  left join public.student_general_categories g
    on g.profile_id = p.id and g.academic_year_id = y
  union all
  select 'mapel'::text, s.id, s.code, s.name, c.category, c.updated_at
  from public.subjects s
  left join public.student_subject_categories c
    on c.subject_id = s.id and c.profile_id = p.id and c.academic_year_id = y
  where s.school_id = p.school_id
  order by 1, 3;
end $$;

create or replace function public.app_get_class_general_categories(p_class uuid)
returns table (
  profile_id uuid,
  username text,
  full_name text,
  category text,
  updated_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare c public.classes;
begin
  select * into c from public.classes where id = p_class;
  if c.id is null or c.school_id <> public.app_school() then return; end if;
  if not (public.app_is_admin() or c.homeroom_id = auth.uid()) then
    raise exception 'Tidak berwenang';
  end if;

  return query
  select pr.id, pr.username, pr.full_name, g.category, g.updated_at
  from public.class_memberships cm
  join public.profiles pr on pr.id = cm.profile_id
  left join public.student_general_categories g
    on g.profile_id = cm.profile_id and g.academic_year_id = c.academic_year_id
  where cm.class_id = p_class and cm.left_at is null
  order by pr.full_name;
end $$;

create or replace function public.app_get_class_subject_categories(p_class uuid, p_subject uuid)
returns table (
  profile_id uuid,
  username text,
  full_name text,
  kategori_umum text,
  kategori_mapel text,
  updated_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare c public.classes;
begin
  select * into c from public.classes where id = p_class;
  if c.id is null or c.school_id <> public.app_school() then return; end if;
  if not (
    public.app_is_admin()
    or c.homeroom_id = auth.uid()
    or exists (
      select 1 from public.teacher_assignments ta
      where ta.teacher_id = auth.uid()
        and ta.subject_id = p_subject
        and ta.academic_year_id = c.academic_year_id
        and (ta.class_id is null or ta.class_id = c.id)
    )
  ) then
    raise exception 'Tidak berwenang';
  end if;

  return query
  select pr.id, pr.username, pr.full_name, g.category, s.category, coalesce(s.updated_at, g.updated_at)
  from public.class_memberships cm
  join public.profiles pr on pr.id = cm.profile_id
  left join public.student_general_categories g
    on g.profile_id = cm.profile_id and g.academic_year_id = c.academic_year_id
  left join public.student_subject_categories s
    on s.profile_id = cm.profile_id and s.subject_id = p_subject
       and s.academic_year_id = c.academic_year_id
  where cm.class_id = p_class and cm.left_at is null
  order by pr.full_name;
end $$;

create or replace function public.app_get_category_history(p_profile uuid, p_limit int default 50)
returns table (
  scope text,
  subject_code text,
  subject_name text,
  category text,
  previous_category text,
  changed_by_name text,
  changed_at timestamptz,
  source text,
  note text
) language plpgsql stable security invoker set search_path = public as $$
begin
  return query
  select h.scope, s.code, s.name, h.category, h.previous_category,
         pr.full_name, h.changed_at, h.source, h.note
  from public.category_history h
  left join public.subjects s on s.id = h.subject_id
  left join public.profiles pr on pr.id = h.changed_by
  where h.profile_id = p_profile
  order by h.changed_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end $$;

-- ----------------------------------------------------------------------------
-- 5. RPC TULIS (validasi + history + audit)
-- ----------------------------------------------------------------------------
create or replace function public.app_set_general_category(
  p_profile uuid,
  p_category text,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.profiles; c public.classes; y uuid; v_class uuid; prev text; src text;
begin
  if p_category not in ('A','B','C') then
    return jsonb_build_object('ok', false, 'msg', 'Kategori harus A, B, atau C');
  end if;

  select * into pr from public.profiles where id = p_profile;
  if pr.id is null or pr.role <> 'siswa' or pr.school_id <> public.app_school() then
    return jsonb_build_object('ok', false, 'msg', 'Siswa tidak ditemukan');
  end if;

  select cm.class_id, cl.academic_year_id into v_class, y
  from public.class_memberships cm
  join public.classes cl on cl.id = cm.class_id
  join public.academic_years ay on ay.id = cl.academic_year_id and ay.is_active
  where cm.profile_id = pr.id and cm.left_at is null
  limit 1;
  if v_class is null then
    return jsonb_build_object('ok', false, 'msg', 'Siswa belum memiliki kelas aktif');
  end if;
  select * into c from public.classes where id = v_class;

  if not (public.app_is_admin() or c.homeroom_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'msg', 'Hanya Walas kelas ini yang dapat mengubah');
  end if;

  select category into prev from public.student_general_categories
   where profile_id = pr.id and academic_year_id = y;
  src := case when public.app_is_admin() then 'admin' else 'walas' end;

  insert into public.student_general_categories
    (school_id, academic_year_id, class_id, profile_id, category, updated_by)
  values (pr.school_id, y, c.id, pr.id, p_category, auth.uid())
  on conflict (profile_id, academic_year_id) do update
    set category = excluded.category,
        class_id = excluded.class_id,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into public.category_history
    (school_id, academic_year_id, class_id, profile_id, scope, category, previous_category, changed_by, source, note)
  values (pr.school_id, y, c.id, pr.id, 'general', p_category, prev, auth.uid(), src, p_note);

  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (pr.school_id, auth.uid(), 'set_general_category', 'profiles', pr.id::text,
    jsonb_build_object('category', p_category, 'previous', prev, 'year', y, 'class', c.id));

  return jsonb_build_object('ok', true, 'category', p_category, 'previous', prev);
end $$;

create or replace function public.app_set_subject_category(
  p_profile uuid,
  p_subject uuid,
  p_category text,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.profiles; c public.classes; y uuid; v_class uuid; prev text; allowed boolean; src text;
begin
  if p_category not in ('A','B','C') then
    return jsonb_build_object('ok', false, 'msg', 'Kategori harus A, B, atau C');
  end if;

  select * into pr from public.profiles where id = p_profile;
  if pr.id is null or pr.role <> 'siswa' or pr.school_id <> public.app_school() then
    return jsonb_build_object('ok', false, 'msg', 'Siswa tidak ditemukan');
  end if;
  if not exists (select 1 from public.subjects s where s.id = p_subject and s.school_id = pr.school_id) then
    return jsonb_build_object('ok', false, 'msg', 'Mapel tidak ditemukan');
  end if;

  select cm.class_id, cl.academic_year_id into v_class, y
  from public.class_memberships cm
  join public.classes cl on cl.id = cm.class_id
  join public.academic_years ay on ay.id = cl.academic_year_id and ay.is_active
  where cm.profile_id = pr.id and cm.left_at is null
  limit 1;
  if v_class is null then
    return jsonb_build_object('ok', false, 'msg', 'Siswa belum memiliki kelas aktif');
  end if;
  select * into c from public.classes where id = v_class;

  allowed := public.app_is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.subject_id = p_subject
      and ta.academic_year_id = y
      and (ta.class_id is null or ta.class_id = c.id)
  );
  if not allowed then
    return jsonb_build_object('ok', false, 'msg', 'Anda tidak mengampu mapel/kelas ini');
  end if;

  select category into prev from public.student_subject_categories
   where profile_id = pr.id and subject_id = p_subject and academic_year_id = y;
  src := case when public.app_is_admin() then 'admin' else 'guru' end;

  insert into public.student_subject_categories
    (school_id, academic_year_id, class_id, subject_id, profile_id, category, updated_by)
  values (pr.school_id, y, c.id, p_subject, pr.id, p_category, auth.uid())
  on conflict (profile_id, subject_id, academic_year_id) do update
    set category = excluded.category,
        class_id = excluded.class_id,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into public.category_history
    (school_id, academic_year_id, class_id, profile_id, scope, subject_id, category, previous_category, changed_by, source, note)
  values (pr.school_id, y, c.id, pr.id, 'subject', p_subject, p_category, prev, auth.uid(), src, p_note);

  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (pr.school_id, auth.uid(), 'set_subject_category', 'profiles', pr.id::text,
    jsonb_build_object('subject', p_subject, 'category', p_category, 'previous', prev, 'year', y, 'class', c.id));

  return jsonb_build_object('ok', true, 'category', p_category, 'previous', prev);
end $$;

create or replace function public.app_assign_homeroom(p_class uuid, p_teacher uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.classes; t public.profiles;
begin
  if not public.app_is_admin() then
    return jsonb_build_object('ok', false, 'msg', 'Hanya admin yang dapat menetapkan Walas');
  end if;
  select * into c from public.classes where id = p_class and school_id = public.app_school();
  if c.id is null then return jsonb_build_object('ok', false, 'msg', 'Kelas tidak ditemukan'); end if;
  select * into t from public.profiles where id = p_teacher;
  if t.id is null or t.role <> 'guru' or t.school_id <> c.school_id then
    return jsonb_build_object('ok', false, 'msg', 'Walas harus guru di sekolah yang sama');
  end if;
  update public.classes set homeroom_id = p_teacher where id = p_class;
  return jsonb_build_object('ok', true);
end $$;

-- ----------------------------------------------------------------------------
-- 6. KATEGORI DI app_access_check (mapel -> umum -> legacy)
-- ----------------------------------------------------------------------------
create or replace function public.app_access_check(p_code text)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare a public.assessments; p public.profiles; pr public.collab_pairs; bl public.collab_pairs;
        g public.access_grants; solo boolean; out jsonb; v_year uuid;
        v_subject text; v_general text; v_legacy text;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return jsonb_build_object('ok',false,'msg','Sesi tidak valid'); end if;
  select * into a from public.assessments where code = p_code and school_id = p.school_id;
  if a.id is null or a.status in ('draft','deleted') then
    return jsonb_build_object('ok',false,'msg','Asesmen tidak tersedia'); end if;

  if a.status = 'locked' then
    select * into g from public.access_grants
     where assessment_id = a.id and profile_id = p.id
       and (valid_until is null or valid_until >= current_date);
    if g.id is null then
      return jsonb_build_object('ok',false,'alasan','dikunci','msg','Asesmen dikunci'); end if;
  end if;

  if a.prerequisite_assessment_id is not null then
    if not exists (
      select 1 from public.attempts t
      where t.assessment_id = a.prerequisite_assessment_id
        and t.profile_id = p.id
        and t.status in ('submitted','graded')
    ) then
      return jsonb_build_object('ok',false,'alasan','prasyarat',
        'msg','Selesaikan asesmen prasyarat terlebih dahulu.',
        'prerequisite_code',(select code from public.assessments where id=a.prerequisite_assessment_id));
    end if;
  end if;

  v_year := a.academic_year_id;
  select category into v_subject from public.student_subject_categories
   where profile_id = p.id and subject_id = a.subject_id and academic_year_id = v_year;
  select category into v_general from public.student_general_categories
   where profile_id = p.id and academic_year_id = v_year;
  v_legacy := case when p.settings->>'kategori' in ('A','B','C')
                   then p.settings->>'kategori' else null end;

  select * into pr from public.collab_pairs
   where owner_id = p.id and status='approved'
     and (assessment_id = a.id or assessment_id is null) order by created_at desc limit 1;
  select * into bl from public.collab_pairs
   where partner_id = p.id and status='approved'
     and (assessment_id = a.id or assessment_id is null) order by created_at desc limit 1;
  select exists(select 1 from public.collab_pairs c
     where c.owner_id = p.id and c.status='approved' and c.note='SOLO'
       and (c.assessment_id = a.id or c.assessment_id is null)) into solo;

  out := jsonb_build_object(
    'ok', true, 'username', p.username, 'nama', p.full_name,
    'kelas', coalesce((select c.label from public.class_memberships cm
                       join public.classes c on c.id=cm.class_id
                       where cm.profile_id=p.id and cm.left_at is null limit 1),''),
    'kategori', coalesce(v_subject, v_general, v_legacy, ''),
    'kategori_umum', coalesce(v_general, v_legacy, ''),
    'kategori_mapel', coalesce(v_subject, ''),
    'kategori_source', case when v_subject is not null then 'mapel'
                            when v_general is not null then 'umum'
                            when v_legacy is not null then 'legacy' else 'none' end,
    'target', a.file_url, 'kolaborasi', a.collab_mode,
    'readOnly', a.status='archived',
    'sudahSelesai', exists(select 1 from public.attempts t
                    where t.assessment_id=a.id and t.profile_id=p.id
                      and t.status in ('submitted','graded')),
    'semester', a.semester, 'mode','normal');

  if a.status='locked' then out := out || jsonb_build_object('mode','akses-khusus'); end if;
  if bl.id is not null then
    out := out || jsonb_build_object('mode','partner-blocked',
      'blockedBy', jsonb_build_object('nama1',(select full_name from public.profiles where id=bl.owner_id)));
  elsif pr.id is not null then
    out := out || jsonb_build_object(
      'mode', case when a.collab_mode in ('required_fixed','optional_fixed') then 'fix-pair' else 'owner-approved' end,
      'pair', jsonb_build_object(
        'username2',(select username from public.profiles where id=pr.partner_id),
        'nama2',(select full_name from public.profiles where id=pr.partner_id)));
  elsif a.collab_mode in ('required','required_fixed') then
    out := out || jsonb_build_object('mode',
      case when solo then 'owner-solo'
           when a.collab_mode='required' then 'wajib-pair' else 'fix-none' end,
      'soloAllowed', (a.collab_mode='optional_fixed'));
  elsif a.collab_mode in ('optional','optional_fixed') then
    out := out || jsonb_build_object('mode',
      case when a.collab_mode='optional' then 'open' else 'fix-none' end,
      'soloAllowed', true);
  end if;
  return out;
end $$;

-- ----------------------------------------------------------------------------
-- 7. PERMINTAAN AKUN: kategori tidak lagi dapat diminta siswa
-- ----------------------------------------------------------------------------
create or replace function public.app_request_account_change(
  p_kind text,
  p_value text,
  p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare p public.profiles; v text;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return jsonb_build_object('ok', false, 'msg', 'Sesi tidak valid'); end if;

  if p_kind = 'kategori' then
    return jsonb_build_object('ok', false,
      'msg', 'Kategori dikelola Walas (umum) atau Guru mapel; tidak dapat diminta sendiri.');
  end if;
  if p_kind <> 'username' then
    return jsonb_build_object('ok', false, 'msg', 'Jenis permintaan tidak dikenal');
  end if;

  v := btrim(coalesce(p_value, ''));
  if v = '' then return jsonb_build_object('ok', false, 'msg', 'Nilai baru wajib diisi'); end if;
  if v !~ '^[a-z0-9-]+$' then
    return jsonb_build_object('ok', false, 'msg', 'Username hanya boleh huruf kecil, angka, dan tanda hubung');
  end if;
  if exists (select 1 from public.account_requests
             where profile_id = p.id and kind = 'username' and status = 'pending') then
    return jsonb_build_object('ok', false, 'msg', 'Masih ada permintaan yang menunggu keputusan');
  end if;

  insert into public.account_requests
    (school_id, profile_id, kind, current_value, requested_value, reason)
  values (p.school_id, p.id, 'username', p.username, v, nullif(btrim(coalesce(p_reason, '')), ''));

  return jsonb_build_object('ok', true, 'msg', 'Permintaan terkirim', 'nilaiBaru', v);
end $$;

-- ----------------------------------------------------------------------------
-- 8. BACKFILL (tidak menghapus settings lama)
-- ----------------------------------------------------------------------------
with active as (
  select distinct on (p.id)
    p.id as profile_id, p.school_id, c.id as class_id, c.academic_year_id,
    (p.settings->>'kategori') as category
  from public.profiles p
  join public.class_memberships cm on cm.profile_id = p.id and cm.left_at is null
  join public.classes c on c.id = cm.class_id
  join public.academic_years y on y.id = c.academic_year_id and y.is_active
  where p.role = 'siswa'
    and (p.settings->>'kategori') in ('A','B','C')
  order by p.id, cm.joined_at desc
),
ins as (
  insert into public.student_general_categories
    (school_id, academic_year_id, class_id, profile_id, category, updated_by)
  select school_id, academic_year_id, class_id, profile_id, category, null
  from active
  on conflict (profile_id, academic_year_id) do nothing
  returning school_id, academic_year_id, class_id, profile_id, category
)
insert into public.category_history
  (school_id, academic_year_id, class_id, profile_id, scope, category, previous_category, changed_by, source, note)
select school_id, academic_year_id, class_id, profile_id, 'general', category, null, null,
       'migration', 'Backfill dari profiles.settings.kategori'
from ins;

-- ----------------------------------------------------------------------------
-- 9. GRANTS
-- ----------------------------------------------------------------------------
revoke all on function public.app_get_my_categories() from public, anon;
revoke all on function public.app_get_class_general_categories(uuid) from public, anon;
revoke all on function public.app_get_class_subject_categories(uuid, uuid) from public, anon;
revoke all on function public.app_get_category_history(uuid, int) from public, anon;
revoke all on function public.app_set_general_category(uuid, text, text) from public, anon;
revoke all on function public.app_set_subject_category(uuid, uuid, text, text) from public, anon;
revoke all on function public.app_assign_homeroom(uuid, uuid) from public, anon;

grant execute on function public.app_get_my_categories() to authenticated;
grant execute on function public.app_get_class_general_categories(uuid) to authenticated;
grant execute on function public.app_get_class_subject_categories(uuid, uuid) to authenticated;
grant execute on function public.app_get_category_history(uuid, int) to authenticated;
grant execute on function public.app_set_general_category(uuid, text, text) to authenticated;
grant execute on function public.app_set_subject_category(uuid, uuid, text, text) to authenticated;
grant execute on function public.app_assign_homeroom(uuid, uuid) to authenticated;
