-- ============================================================================
-- 0008_fix_navigation_ambiguity.sql
-- Perbaikan bug 42P02: parameter OUT bernama `id` bentrok dengan kolom
-- `profiles.id` di klausa WHERE pada app_get_subjects & app_get_student_activity.
-- Solusi: kualifikasi nama tabel (public.profiles.id).
-- ============================================================================

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
      and ta.academic_year_id = (select public.academic_years.id from public.academic_years where school_id = p.school_id and is_active limit 1)
    order by s.code, gl.rank;
  else -- siswa
    return query
    select distinct s.id, s.code, s.name, gl.id, gl.label
    from public.class_memberships cm
    join public.classes c on c.id = cm.class_id
    join public.grade_levels gl on gl.id = c.grade_level_id
    join public.teacher_assignments ta on ta.class_id = c.id or ta.class_id is null
    join public.subjects s on s.id = ta.subject_id
    where cm.profile_id = p.id and cm.left_at is null
      and ta.academic_year_id = c.academic_year_id
    order by s.code, gl.rank;
  end if;
end $$;

create or replace function public.app_get_student_activity(p_limit int default 50)
returns table (
  id uuid,
  app_code text,
  section text,
  kind text,
  duration_sec int,
  score numeric,
  logged_at timestamptz
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where public.profiles.id = auth.uid();
  if p.id is null then return; end if;

  return query
  select al.id, al.app_code, al.section, al.kind, al.duration_sec, al.score, al.logged_at
  from public.activity_logs al
  where al.profile_id = p.id
  order by al.logged_at desc
  limit p_limit;
end $$;

revoke all on function public.app_get_subjects() from public, anon;
revoke all on function public.app_get_student_activity(int) from public, anon;
grant execute on function public.app_get_subjects() to authenticated;
grant execute on function public.app_get_student_activity(int) to authenticated;
