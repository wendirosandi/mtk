-- ============================================================================
-- 0018_school_scope_rls.sql
-- Menutup kebocoran lintas sekolah pada RLS.
--
-- Masalah: banyak policy `for all` memakai `app_is_admin()` tanpa
-- `school_id = app_school()`. Karena policy FOR ALL juga berlaku untuk SELECT,
-- admin sekolah A dapat membaca/mengubah data sekolah B. Helper
-- app_can_manage_* dan app_teacher_subject* juga memberi bypass admin global.
--
-- Migrasi ini hanya mengubah policy/function. Tidak mengubah data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: bypass admin hanya untuk sekolahnya sendiri
-- ----------------------------------------------------------------------------
create or replace function public.app_teacher_subject(p_subject uuid, p_year uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (public.app_is_admin() and exists (
      select 1 from public.subjects s, public.academic_years y
      where s.id = p_subject and y.id = p_year
        and s.school_id = public.app_school()
        and y.school_id = public.app_school()
    ))
    or exists (
      select 1
      from public.teacher_assignments ta
      join public.subjects s on s.id = ta.subject_id
      join public.academic_years y on y.id = ta.academic_year_id
      where ta.teacher_id = auth.uid()
        and ta.subject_id = p_subject
        and ta.academic_year_id = p_year
        and s.school_id = public.app_school()
        and y.school_id = public.app_school()
    );
$$;

create or replace function public.app_teacher_subject_active(p_subject uuid, p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (public.app_is_admin() and p_school = public.app_school())
    or exists (
      select 1
      from public.teacher_assignments ta
      join public.academic_years y on y.id = ta.academic_year_id
      where ta.teacher_id = auth.uid()
        and ta.subject_id = p_subject
        and y.school_id = p_school
        and y.is_active
        and p_school = public.app_school()
    );
$$;

create or replace function public.app_guru_scope_assessment(p_assess uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.assessments a
    join public.teacher_assignments ta
      on ta.subject_id = a.subject_id and ta.academic_year_id = a.academic_year_id
    where a.id = p_assess
      and a.school_id = public.app_school()
      and ta.teacher_id = auth.uid()
      and (ta.class_id is null or public.app_can_see_class(ta.class_id))
  );
$$;

create or replace function public.app_can_manage_module(p_module uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (public.app_is_admin() and exists (
      select 1 from public.modules m
      where m.id = p_module and m.school_id = public.app_school()
    ))
    or exists (
      select 1
      from public.modules m
      join public.teacher_assignments ta on ta.subject_id = m.subject_id
      join public.academic_years y on y.id = ta.academic_year_id and y.is_active
      where m.id = p_module
        and m.school_id = public.app_school()
        and y.school_id = public.app_school()
        and ta.teacher_id = auth.uid()
    );
$$;

create or replace function public.app_can_manage_topic(p_topic uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (public.app_is_admin() and exists (
      select 1
      from public.topics t
      join public.modules m on m.id = t.module_id
      where t.id = p_topic and m.school_id = public.app_school()
    ))
    or exists (
      select 1
      from public.topics t
      join public.modules m on m.id = t.module_id
      join public.teacher_assignments ta on ta.subject_id = m.subject_id
      join public.academic_years y on y.id = ta.academic_year_id and y.is_active
      where t.id = p_topic
        and m.school_id = public.app_school()
        and y.school_id = public.app_school()
        and ta.teacher_id = auth.uid()
    );
$$;

create or replace function public.app_can_manage_assessment(p_assess uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (public.app_is_admin() and exists (
      select 1 from public.assessments a
      where a.id = p_assess and a.school_id = public.app_school()
    ))
    or exists (
      select 1
      from public.assessments a
      where a.id = p_assess
        and a.school_id = public.app_school()
        and public.app_guru_scope_assessment(a.id)
    );
$$;

-- ----------------------------------------------------------------------------
-- 2. Sekolah & profil
-- ----------------------------------------------------------------------------
drop policy if exists sch_sel on public.schools;
create policy sch_sel on public.schools for select to authenticated
  using (id = public.app_school());

drop policy if exists sch_upd on public.schools;
create policy sch_upd on public.schools for update to authenticated
  using (public.app_is_admin() and id = public.app_school())
  with check (public.app_is_admin() and id = public.app_school());

drop policy if exists prof_del_admin on public.profiles;
create policy prof_del_admin on public.profiles for delete to authenticated
  using (public.app_is_admin() and school_id = public.app_school());

-- ----------------------------------------------------------------------------
-- 3. Academic master
-- ----------------------------------------------------------------------------
drop policy if exists ay_wrt on public.academic_years;
create policy ay_wrt on public.academic_years for all to authenticated
  using (public.app_is_admin() and school_id = public.app_school())
  with check (public.app_is_admin() and school_id = public.app_school());

drop policy if exists gl_wrt on public.grade_levels;
create policy gl_wrt on public.grade_levels for all to authenticated
  using (public.app_is_admin() and school_id = public.app_school())
  with check (public.app_is_admin() and school_id = public.app_school());

drop policy if exists sb_wrt on public.subjects;
create policy sb_wrt on public.subjects for all to authenticated
  using (public.app_is_admin() and school_id = public.app_school())
  with check (public.app_is_admin() and school_id = public.app_school());

drop policy if exists cl_wrt on public.classes;
create policy cl_wrt on public.classes for all to authenticated
  using (public.app_is_admin() and school_id = public.app_school())
  with check (public.app_is_admin() and school_id = public.app_school());

drop policy if exists cm_wrt on public.class_memberships;
create policy cm_wrt on public.class_memberships for all to authenticated
  using (
    public.app_is_admin() and exists (
      select 1 from public.classes c
      where c.id = class_id and c.school_id = public.app_school()
    )
  )
  with check (
    public.app_is_admin() and exists (
      select 1 from public.classes c
      where c.id = class_id and c.school_id = public.app_school()
    )
  );

drop policy if exists ta_wrt on public.teacher_assignments;
create policy ta_wrt on public.teacher_assignments for all to authenticated
  using (public.app_is_admin() and school_id = public.app_school())
  with check (public.app_is_admin() and school_id = public.app_school());

-- ----------------------------------------------------------------------------
-- 4. Kurikulum, asesmen, bank soal
-- ----------------------------------------------------------------------------
drop policy if exists md_ins on public.modules;
create policy md_ins on public.modules for insert to authenticated
  with check (
    (public.app_is_admin() and school_id = public.app_school())
    or (
      public.app_is_guru()
      and school_id = public.app_school()
      and public.app_teacher_subject_active(subject_id, school_id)
    )
  );

drop policy if exists md_upd on public.modules;
create policy md_upd on public.modules for update to authenticated
  using (public.app_can_manage_module(id))
  with check (public.app_can_manage_module(id) and school_id = public.app_school());

drop policy if exists md_del on public.modules;
create policy md_del on public.modules for delete to authenticated
  using (public.app_is_admin() and school_id = public.app_school());

drop policy if exists as_ins on public.assessments;
create policy as_ins on public.assessments for insert to authenticated
  with check (
    (public.app_is_admin() and school_id = public.app_school())
    or (
      public.app_is_guru()
      and school_id = public.app_school()
      and public.app_teacher_subject(subject_id, academic_year_id)
    )
  );

drop policy if exists as_upd on public.assessments;
create policy as_upd on public.assessments for update to authenticated
  using (public.app_can_manage_assessment(id))
  with check (public.app_can_manage_assessment(id) and school_id = public.app_school());

drop policy if exists as_del on public.assessments;
create policy as_del on public.assessments for delete to authenticated
  using (public.app_is_admin() and school_id = public.app_school());

drop policy if exists qp_wrt on public.question_pools;
create policy qp_wrt on public.question_pools for all to authenticated
  using (public.app_is_guru() and school_id = public.app_school())
  with check (public.app_is_guru() and school_id = public.app_school());

drop policy if exists gt_wrt on public.generator_templates;
create policy gt_wrt on public.generator_templates for all to authenticated
  using (public.app_is_guru() and school_id = public.app_school())
  with check (public.app_is_guru() and school_id = public.app_school());

drop policy if exists bi_wrt on public.bank_items;
create policy bi_wrt on public.bank_items for all to authenticated
  using (public.app_is_guru() and school_id = public.app_school())
  with check (public.app_is_guru() and school_id = public.app_school());

drop policy if exists kk_wrt on public.kisi_kisi;
create policy kk_wrt on public.kisi_kisi for all to authenticated
  using (
    public.app_is_guru() and exists (
      select 1 from public.assessments a
      where a.id = assessment_id and a.school_id = public.app_school()
    )
  )
  with check (
    public.app_is_guru() and exists (
      select 1 from public.assessments a
      where a.id = assessment_id and a.school_id = public.app_school()
    )
  );

drop policy if exists ai_sel on public.attempt_items;
create policy ai_sel on public.attempt_items for select to authenticated
  using (
    public.app_is_guru() and exists (
      select 1
      from public.attempts at
      join public.assessments a on a.id = at.assessment_id
      where at.id = attempt_id and a.school_id = public.app_school()
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Nilai, aktivitas, percobaan, kategori
-- ----------------------------------------------------------------------------
drop policy if exists gb_sel on public.gradebook_entries;
create policy gb_sel on public.gradebook_entries for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.app_is_guru() and school_id = public.app_school()
        and public.app_can_see_class(class_id))
    or (public.app_is_admin() and school_id = public.app_school())
  );

drop policy if exists gb_ins on public.gradebook_entries;
create policy gb_ins on public.gradebook_entries for insert to authenticated
  with check (
    (public.app_is_admin() and school_id = public.app_school())
    or (
      public.app_is_guru()
      and school_id = public.app_school()
      and public.app_can_see_class(class_id)
      and (assessment_id is null or public.app_can_manage_assessment(assessment_id))
    )
  );

drop policy if exists gb_upd on public.gradebook_entries;
create policy gb_upd on public.gradebook_entries for update to authenticated
  using (
    (public.app_is_admin() and school_id = public.app_school())
    or (
      public.app_is_guru()
      and school_id = public.app_school()
      and public.app_can_see_class(class_id)
      and (assessment_id is null or public.app_can_manage_assessment(assessment_id))
    )
  )
  with check (
    (public.app_is_admin() and school_id = public.app_school())
    or (
      public.app_is_guru()
      and school_id = public.app_school()
      and public.app_can_see_class(class_id)
      and (assessment_id is null or public.app_can_manage_assessment(assessment_id))
    )
  );

drop policy if exists gb_del on public.gradebook_entries;
create policy gb_del on public.gradebook_entries for delete to authenticated
  using (public.app_is_admin() and school_id = public.app_school());

drop policy if exists al_sel on public.activity_logs;
create policy al_sel on public.activity_logs for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.app_is_guru() and school_id = public.app_school())
    or (public.app_is_admin() and school_id = public.app_school())
  );

drop policy if exists at_sel on public.attempts;
create policy at_sel on public.attempts for select to authenticated
  using (
    profile_id = auth.uid()
    or partner_id = auth.uid()
    or (public.app_is_guru() and public.app_guru_scope_assessment(assessment_id))
    or (
      public.app_is_admin() and exists (
        select 1 from public.assessments a
        where a.id = assessment_id and a.school_id = public.app_school()
      )
    )
  );

drop policy if exists at_del_admin on public.attempts;
create policy at_del_admin on public.attempts for delete to authenticated
  using (
    public.app_is_admin() and exists (
      select 1 from public.assessments a
      where a.id = assessment_id and a.school_id = public.app_school()
    )
  );

drop policy if exists ar_sel on public.account_requests;
create policy ar_sel on public.account_requests for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.app_is_guru() and school_id = public.app_school())
    or (public.app_is_admin() and school_id = public.app_school())
  );

drop policy if exists ar_upd on public.account_requests;
create policy ar_upd on public.account_requests for update to authenticated
  using (
    (public.app_is_guru() and school_id = public.app_school())
    or (public.app_is_admin() and school_id = public.app_school())
  )
  with check (
    (public.app_is_guru() and school_id = public.app_school())
    or (public.app_is_admin() and school_id = public.app_school())
  );

drop policy if exists sgc_sel on public.student_general_categories;
create policy sgc_sel on public.student_general_categories for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.app_is_admin() and school_id = public.app_school())
    or exists (
      select 1 from public.classes c
      where c.id = class_id and c.homeroom_id = auth.uid()
    )
  );

drop policy if exists ssc_sel on public.student_subject_categories;
create policy ssc_sel on public.student_subject_categories for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.app_is_admin() and school_id = public.app_school())
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

drop policy if exists cat_hist_sel on public.category_history;
create policy cat_hist_sel on public.category_history for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.app_is_admin() and school_id = public.app_school())
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

-- ----------------------------------------------------------------------------
-- 6. Kolaborasi, rating, audit
-- ----------------------------------------------------------------------------
drop policy if exists cp_upd on public.collab_pairs;
create policy cp_upd on public.collab_pairs for update to authenticated
  using ((public.app_is_guru() and school_id = public.app_school()) or owner_id = auth.uid())
  with check ((public.app_is_guru() and school_id = public.app_school()) or owner_id = auth.uid());

drop policy if exists pr_upd on public.performance_ratings;
create policy pr_upd on public.performance_ratings for update to authenticated
  using (
    (rater = 'self' and profile_id = auth.uid())
    or (rater = 'teacher' and public.app_is_guru()
        and public.app_guru_scope_assessment(assessment_id))
  )
  with check (
    (rater = 'self' and profile_id = auth.uid())
    or (rater = 'teacher' and public.app_is_guru()
        and public.app_guru_scope_assessment(assessment_id))
  );

drop policy if exists ad_ins on public.audit_logs;
create policy ad_ins on public.audit_logs for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (school_id is null or school_id = public.app_school())
  );

-- Catatan: legacy_crosswalk tidak memiliki school_id (konfigurasi legacy
-- global), sehingga policy tulisnya tetap admin-global.
