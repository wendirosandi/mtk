-- 0004_navigation.sql — RPC untuk navigasi pembelajaran
-- Semua fungsi: security invoker, mematuhi RLS

-- 1. Daftar mata pelajaran (siswa: mapel di kelasnya, guru: mapel yang diajarkan, admin: semua)
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
  select * into p from public.profiles where id = auth.uid();
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
    where ta.teacher_id = p.id and ta.academic_year_id = (select id from public.academic_years where school_id = p.school_id and is_active limit 1)
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

-- 2. Daftar modul per mata pelajaran & tingkat
create or replace function public.app_get_modules(p_subject_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  sort_order int,
  topic_count bigint,
  material_count bigint,
  assessment_count bigint
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles; gl_id uuid;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return; end if;

  -- Ambil tingkat siswa (untuk siswa) atau semua tingkat (untuk guru/admin)
  if p.role = 'siswa' then
    select c.grade_level_id into gl_id
    from public.class_memberships cm
    join public.classes c on c.id = cm.class_id
    where cm.profile_id = p.id and cm.left_at is null
    limit 1;
  end if;

  return query
  select m.id, m.title, m.description, m.sort_order,
    (select count(*) from public.topics t where t.module_id = m.id) as topic_count,
    (select count(*) from public.materials mat join public.topics t on t.id = mat.topic_id where t.module_id = m.id) as material_count,
    (select count(*) from public.assessments a where a.module_id = m.id and a.status in ('active','exambro')) as assessment_count
  from public.modules m
  where m.subject_id = p_subject_id
    and (p.role <> 'siswa' or m.grade_level_id = gl_id)
  order by m.sort_order, m.title;
end $$;

-- 3. Daftar materi per modul (termasuk topik)
create or replace function public.app_get_materials(p_module_id uuid)
returns table (
  topic_id uuid,
  topic_title text,
  topic_sort_order int,
  material_id uuid,
  material_kind text,
  material_title text,
  material_url text,
  material_sort_order int,
  assessment_code text,
  assessment_title text,
  assessment_kind text,
  assessment_status text
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return; end if;

  return query
  select t.id as topic_id, t.title as topic_title, t.sort_order as topic_sort_order,
    mat.id as material_id, mat.kind as material_kind, mat.title as material_title,
    mat.url as material_url, mat.sort_order as material_sort_order,
    a.code as assessment_code, a.title as assessment_title, a.kind::text as assessment_kind, a.status::text as assessment_status
  from public.topics t
  left join public.materials mat on mat.topic_id = t.id
  left join public.assessments a on a.topic_id = t.id and (p.role <> 'siswa' or a.status in ('active','exambro','archived'))
  where t.module_id = p_module_id
  order by t.sort_order, mat.sort_order, a.title;
end $$;

-- 4. Daftar asesmen per topik (untuk siswa: hanya yang aktif)
create or replace function public.app_get_assessments(p_topic_id uuid)
returns table (
  id uuid,
  code text,
  title text,
  kind text,
  status text,
  collab_mode text,
  delivery text,
  file_url text,
  published_at timestamptz
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return; end if;

  return query
  select a.id, a.code, a.title, a.kind::text, a.status::text, a.collab_mode::text, a.delivery::text, a.file_url, a.published_at
  from public.assessments a
  where a.topic_id = p_topic_id
    and (p.role <> 'siswa' or a.status in ('active','exambro'))
  order by a.title;
end $$;

-- 5. Progress siswa (asesmen yang sudah dikerjakan)
create or replace function public.app_get_student_progress()
returns table (
  assessment_id uuid,
  assessment_code text,
  assessment_title text,
  attempt_count bigint,
  best_score numeric,
  last_attempt_at timestamptz,
  status text
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return; end if;

  return query
  select a.id, a.code, a.title,
    count(t.id) as attempt_count,
    max(g.score) as best_score,
    max(t.submitted_at) as last_attempt_at,
    case
      when max(t.status) = 'graded' then 'completed'
      when max(t.status) = 'submitted' then 'submitted'
      when count(t.id) > 0 then 'in_progress'
      else 'not_started'
    end as status
  from public.assessments a
  left join public.attempts t on t.assessment_id = a.id and t.profile_id = p.id
  left join public.gradebook_entries g on g.assessment_id = a.id and g.profile_id = p.id
  where a.school_id = p.school_id
    and a.status in ('active','exambro','archived')
  group by a.id, a.code, a.title
  order by a.title;
end $$;

-- 6. Gradebook siswa
create or replace function public.app_get_student_gradebook()
returns table (
  assessment_id uuid,
  assessment_code text,
  assessment_title text,
  score_kind text,
  score numeric,
  max_score numeric,
  letter text,
  source text,
  updated_at timestamptz
) language plpgsql stable security invoker set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return; end if;

  return query
  select g.assessment_id, a.code, a.title, g.score_kind::text, g.score, g.max_score, g.letter, g.source, g.updated_at
  from public.gradebook_entries g
  join public.assessments a on a.id = g.assessment_id
  where g.profile_id = p.id
  order by a.title, g.score_kind;
end $$;

-- 7. Aktivitas siswa
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
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return; end if;

  return query
  select al.id, al.app_code, al.section, al.kind, al.duration_sec, al.score, al.logged_at
  from public.activity_logs al
  where al.profile_id = p.id
  order by al.logged_at desc
  limit p_limit;
end $$;

-- Grants
revoke all on function public.app_get_subjects() from public, anon;
revoke all on function public.app_get_modules(uuid) from public, anon;
revoke all on function public.app_get_materials(uuid) from public, anon;
revoke all on function public.app_get_assessments(uuid) from public, anon;
revoke all on function public.app_get_student_progress() from public, anon;
revoke all on function public.app_get_student_gradebook() from public, anon;
revoke all on function public.app_get_student_activity(int) from public, anon;
grant execute on function public.app_get_subjects() to authenticated;
grant execute on function public.app_get_modules(uuid) to authenticated;
grant execute on function public.app_get_materials(uuid) to authenticated;
grant execute on function public.app_get_assessments(uuid) to authenticated;
grant execute on function public.app_get_student_progress() to authenticated;
grant execute on function public.app_get_student_gradebook() to authenticated;
grant execute on function public.app_get_student_activity(int) to authenticated;