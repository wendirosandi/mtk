-- ============================================================================
-- 0009_fix_subjects_order.sql
-- Perbaikan 42P10: SELECT DISTINCT tidak boleh ORDER BY kolom yang tidak ada
-- di select list (gl.rank). Urutkan dengan gl.label yang sudah dipilih.
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
      and ta.academic_year_id = (select id from public.academic_years where school_id = p.school_id and is_active limit 1)
    order by s.code, gl.label;
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
    order by s.code, gl.label;
  end if;
end $$;

revoke all on function public.app_get_subjects() from public, anon;
grant execute on function public.app_get_subjects() to authenticated;
