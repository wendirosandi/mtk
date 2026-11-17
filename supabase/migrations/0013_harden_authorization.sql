-- ============================================================================
-- 0013_harden_authorization.sql
-- Memperketat otorisasi tulis: guru hanya boleh mengelola konten pada mapel/
-- tahun yang diampu, dan hanya menilai asesmen dalam lingkupnya.
-- Wajib ditinjau sebelum diterapkan ke cloud.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper (SECURITY DEFINER agar tidak rekursi RLS)
-- ----------------------------------------------------------------------------
create or replace function public.app_teacher_subject(p_subject uuid, p_year uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin() or exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid()
      and ta.subject_id = p_subject
      and ta.academic_year_id = p_year
  );
$$;

create or replace function public.app_teacher_subject_active(p_subject uuid, p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin() or exists (
    select 1
    from public.teacher_assignments ta
    join public.academic_years y on y.id = ta.academic_year_id
    where ta.teacher_id = auth.uid()
      and ta.subject_id = p_subject
      and y.school_id = p_school
      and y.is_active
  );
$$;

create or replace function public.app_can_manage_module(p_module uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin() or exists (
    select 1
    from public.modules m
    join public.teacher_assignments ta on ta.subject_id = m.subject_id
    join public.academic_years y on y.id = ta.academic_year_id and y.is_active
    where m.id = p_module
      and m.school_id = public.app_school()
      and ta.teacher_id = auth.uid()
  );
$$;

create or replace function public.app_can_manage_topic(p_topic uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin() or exists (
    select 1
    from public.topics t
    join public.modules m on m.id = t.module_id
    join public.teacher_assignments ta on ta.subject_id = m.subject_id
    join public.academic_years y on y.id = ta.academic_year_id and y.is_active
    where t.id = p_topic
      and m.school_id = public.app_school()
      and ta.teacher_id = auth.uid()
  );
$$;

create or replace function public.app_can_manage_assessment(p_assess uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin() or exists (
    select 1 from public.assessments a
    where a.id = p_assess
      and a.school_id = public.app_school()
      and public.app_guru_scope_assessment(a.id)
  );
$$;

revoke all on function public.app_teacher_subject(uuid, uuid) from public, anon;
revoke all on function public.app_teacher_subject_active(uuid, uuid) from public, anon;
revoke all on function public.app_can_manage_module(uuid) from public, anon;
revoke all on function public.app_can_manage_topic(uuid) from public, anon;
revoke all on function public.app_can_manage_assessment(uuid) from public, anon;
grant execute on function public.app_teacher_subject(uuid, uuid) to authenticated;
grant execute on function public.app_teacher_subject_active(uuid, uuid) to authenticated;
grant execute on function public.app_can_manage_module(uuid) to authenticated;
grant execute on function public.app_can_manage_topic(uuid) to authenticated;
grant execute on function public.app_can_manage_assessment(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- MODULES
-- ----------------------------------------------------------------------------
drop policy if exists md_ins on public.modules;
drop policy if exists md_wrt on public.modules;
drop policy if exists md_upd on public.modules;

create policy md_ins on public.modules for insert to authenticated
  with check (
    public.app_is_admin()
    or (public.app_is_guru()
        and school_id = public.app_school()
        and public.app_teacher_subject_active(subject_id, school_id))
  );

create policy md_upd on public.modules for update to authenticated
  using (public.app_can_manage_module(id))
  with check (
    public.app_can_manage_module(id)
    and (public.app_is_admin() or public.app_teacher_subject_active(subject_id, school_id))
  );

-- ----------------------------------------------------------------------------
-- TOPICS
-- ----------------------------------------------------------------------------
drop policy if exists tp_wrt on public.topics;

create policy tp_ins on public.topics for insert to authenticated
  with check (public.app_can_manage_module(module_id));

create policy tp_upd on public.topics for update to authenticated
  using (public.app_can_manage_module(module_id))
  with check (public.app_can_manage_module(module_id));

create policy tp_del on public.topics for delete to authenticated
  using (public.app_can_manage_module(module_id));

-- ----------------------------------------------------------------------------
-- MATERIALS
-- ----------------------------------------------------------------------------
drop policy if exists mt_wrt on public.materials;

create policy mt_ins on public.materials for insert to authenticated
  with check (public.app_can_manage_topic(topic_id));

create policy mt_upd on public.materials for update to authenticated
  using (public.app_can_manage_topic(topic_id))
  with check (public.app_can_manage_topic(topic_id));

create policy mt_del on public.materials for delete to authenticated
  using (public.app_can_manage_topic(topic_id));

-- ----------------------------------------------------------------------------
-- ASSESSMENTS
-- ----------------------------------------------------------------------------
drop policy if exists as_ins on public.assessments;
drop policy if exists as_upd on public.assessments;

create policy as_ins on public.assessments for insert to authenticated
  with check (
    public.app_is_admin()
    or (public.app_is_guru()
        and school_id = public.app_school()
        and public.app_teacher_subject(subject_id, academic_year_id))
  );

create policy as_upd on public.assessments for update to authenticated
  using (public.app_can_manage_assessment(id))
  with check (
    public.app_can_manage_assessment(id)
    and (public.app_is_admin() or public.app_teacher_subject(subject_id, academic_year_id))
  );

-- ----------------------------------------------------------------------------
-- QUESTION ITEMS
-- ----------------------------------------------------------------------------
drop policy if exists qi_wrt on public.question_items;

create policy qi_ins on public.question_items for insert to authenticated
  with check (public.app_can_manage_assessment(assessment_id));

create policy qi_upd on public.question_items for update to authenticated
  using (public.app_can_manage_assessment(assessment_id))
  with check (public.app_can_manage_assessment(assessment_id));

create policy qi_del on public.question_items for delete to authenticated
  using (public.app_can_manage_assessment(assessment_id));

-- ----------------------------------------------------------------------------
-- GRADEBOOK (nilai manual harus dalam scope asesmen guru)
-- ----------------------------------------------------------------------------
drop policy if exists gb_ins on public.gradebook_entries;
drop policy if exists gb_upd on public.gradebook_entries;

create policy gb_ins on public.gradebook_entries for insert to authenticated
  with check (
    public.app_is_admin()
    or (public.app_is_guru()
        and public.app_can_see_class(class_id)
        and (assessment_id is null or public.app_can_manage_assessment(assessment_id)))
  );

create policy gb_upd on public.gradebook_entries for update to authenticated
  using (
    public.app_is_admin()
    or (public.app_is_guru()
        and public.app_can_see_class(class_id)
        and (assessment_id is null or public.app_can_manage_assessment(assessment_id)))
  )
  with check (
    public.app_is_admin()
    or (public.app_is_guru()
        and public.app_can_see_class(class_id)
        and (assessment_id is null or public.app_can_manage_assessment(assessment_id)))
  );
