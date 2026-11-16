-- ============================================================================
-- 0010_fix_modules_assessments_ambiguity.sql
-- Melengkapi perbaikan 42P02 untuk dua RPC yang juga mengembalikan kolom `id`:
-- app_get_modules(uuid) dan app_get_assessments(uuid).
-- ============================================================================

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
  select * into p from public.profiles where public.profiles.id = auth.uid();
  if p.id is null then return; end if;

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
  select * into p from public.profiles where public.profiles.id = auth.uid();
  if p.id is null then return; end if;

  return query
  select a.id, a.code, a.title, a.kind::text, a.status::text, a.collab_mode::text, a.delivery::text, a.file_url, a.published_at
  from public.assessments a
  where a.topic_id = p_topic_id
    and (p.role <> 'siswa' or a.status in ('active','exambro'))
  order by a.title;
end $$;

revoke all on function public.app_get_modules(uuid) from public, anon;
revoke all on function public.app_get_assessments(uuid) from public, anon;
grant execute on function public.app_get_modules(uuid) to authenticated;
grant execute on function public.app_get_assessments(uuid) to authenticated;
