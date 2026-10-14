-- ============================================================================
-- 0002_rls.sql — Helper keamanan + RLS seluruh tabel
-- Prinsip: deny by default; scope = sekolah + (kelas/penugasan untuk guru).
-- ============================================================================

-- ---------- Helper (SECURITY DEFINER, stable, search_path terkunci) ----------
create or replace function public.app_profile() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;
create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select (p).role from (select public.app_profile() p) x;
$$;
create or replace function public.app_school() returns uuid
language sql stable security definer set search_path = public as $$
  select (p).school_id from (select public.app_profile() p) x;
$$;
create or replace function public.app_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false);
$$;
create or replace function public.app_is_guru() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('admin','guru'), false);
$$;
-- kelas tempat siswa terdaftar pada tahun aktif
create or replace function public.app_my_class_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cm.class_id
  from public.class_memberships cm
  join public.classes c on c.id = cm.class_id
  join public.academic_years y on y.id = c.academic_year_id
  where cm.profile_id = auth.uid() and y.is_active and cm.left_at is null;
$$;
-- kelas dalam lingkup pengajaran guru (assignment class null = semua kelas mapel/tahun)
create or replace function public.app_teacher_class_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id
  from public.teacher_assignments ta
  join public.classes c on c.academic_year_id = ta.academic_year_id
  where ta.teacher_id = auth.uid()
    and (ta.class_id is null or ta.class_id = c.id);
$$;
create or replace function public.app_can_see_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.app_role() = 'admin' then true
    when public.app_role() = 'guru'  then exists (select 1 from public.app_teacher_class_ids() t where t = p_class)
    when public.app_role() = 'siswa' then exists (select 1 from public.app_my_class_ids() t where t = p_class)
    else false end;
$$;
-- apakah guru boleh melihat asesmen (via penugasan mapel+tahun)
create or replace function public.app_guru_scope_assessment(p_assess uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments a
    join public.teacher_assignments ta
      on ta.subject_id = a.subject_id and ta.academic_year_id = a.academic_year_id
    where a.id = p_assess and ta.teacher_id = auth.uid()
      and (ta.class_id is null or public.app_can_see_class(ta.class_id))
  );
$$;

-- ---------- Aktifkan RLS ----------
do $$ declare t text;
begin
  foreach t in array array['schools','profiles','academic_years','grade_levels','classes',
    'class_memberships','subjects','teacher_assignments','modules','topics','materials',
    'assessments','question_items','attempts','attempt_answers','gradebook_entries',
    'performance_ratings','collab_pairs','access_grants','activity_logs','notifications',
    'notification_reads','audit_logs','legacy_crosswalk']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- ---------- schools ----------
create policy sch_sel on public.schools for select to authenticated
  using (id = public.app_school() or public.app_is_admin());
create policy sch_upd on public.schools for update to authenticated
  using (public.app_is_admin() and id = public.app_school()) with check (public.app_is_admin());

-- ---------- profiles ----------
create policy prof_sel on public.profiles for select to authenticated
  using (school_id = public.app_school());
create policy prof_upd_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy prof_ins_admin on public.profiles for insert to authenticated
  with check (public.app_is_admin() and school_id = public.app_school());
create policy prof_del_admin on public.profiles for delete to authenticated
  using (public.app_is_admin());

-- ---------- tahun/tingkat/mapel (baca semua warga sekolah; tulis admin) ----------
create policy ay_sel on public.academic_years for select to authenticated using (school_id = public.app_school());
create policy ay_wrt on public.academic_years for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy gl_sel on public.grade_levels for select to authenticated using (school_id = public.app_school());
create policy gl_wrt on public.grade_levels for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy sb_sel on public.subjects for select to authenticated using (school_id = public.app_school());
create policy sb_wrt on public.subjects for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

-- ---------- kelas & membership ----------
create policy cl_sel on public.classes for select to authenticated using (school_id = public.app_school());
create policy cl_wrt on public.classes for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy cm_sel on public.class_memberships for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.school_id = public.app_school()));
create policy cm_wrt on public.class_memberships for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy ta_sel on public.teacher_assignments for select to authenticated using (school_id = public.app_school());
create policy ta_wrt on public.teacher_assignments for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

-- ---------- modul/topik/materi (guru menulis, siswa membaca) ----------
create policy md_sel on public.modules for select to authenticated using (school_id = public.app_school());
create policy md_wrt on public.modules for insert to authenticated with check (public.app_is_guru() and school_id = public.app_school());
create policy md_upd on public.modules for update to authenticated using (public.app_is_guru());
create policy md_del on public.modules for delete to authenticated using (public.app_is_admin());
create policy tp_sel on public.topics for select to authenticated
  using (exists (select 1 from public.modules m where m.id = module_id and m.school_id = public.app_school()));
create policy tp_wrt on public.topics for all to authenticated using (public.app_is_guru()) with check (public.app_is_guru());
create policy mt_sel on public.materials for select to authenticated
  using (exists (select 1 from public.topics t join public.modules m on m.id = t.module_id
                 where t.id = topic_id and m.school_id = public.app_school()));
create policy mt_wrt on public.materials for all to authenticated using (public.app_is_guru()) with check (public.app_is_guru());

-- ---------- assessments ----------
create policy as_sel on public.assessments for select to authenticated using (
  school_id = public.app_school()
  and ( public.app_is_guru()
        or (status in ('active','exambro','inactive','locked','archived')) )
  and status <> 'deleted'
);
create policy as_ins on public.assessments for insert to authenticated
  with check (public.app_is_guru() and school_id = public.app_school());
create policy as_upd on public.assessments for update to authenticated
  using (public.app_is_guru() and school_id = public.app_school())
  with check (public.app_is_guru());
create policy as_del on public.assessments for delete to authenticated using (public.app_is_admin());

-- ---------- question_items : SISWA TIDAK BOLEH MEMBACA KUNCI ----------
create policy qi_sel on public.question_items for select to authenticated
  using (public.app_is_guru()
         and exists (select 1 from public.assessments a where a.id = assessment_id and a.school_id = public.app_school()));
create policy qi_wrt on public.question_items for all to authenticated
  using (public.app_is_guru()) with check (public.app_is_guru());

-- ---------- attempts ----------
create policy at_sel on public.attempts for select to authenticated using (
  profile_id = auth.uid()
  or partner_id = auth.uid()
  or (public.app_is_guru() and public.app_guru_scope_assessment(assessment_id))
);
create policy at_ins on public.attempts for insert to authenticated
  with check (profile_id = auth.uid());
-- TIDAK ADA policy update/delete langsung: transisi hanya via RPC (0003).
create policy at_del_admin on public.attempts for delete to authenticated using (public.app_is_admin());

-- ---------- attempt_answers ----------
create policy aa_sel on public.attempt_answers for select to authenticated using (
  exists (select 1 from public.attempts a where a.id = attempt_id
          and (a.profile_id = auth.uid() or a.partner_id = auth.uid()
               or (public.app_is_guru() and public.app_guru_scope_assessment(a.assessment_id))))
);
-- insert/update hanya via RPC SECURITY DEFINER (tidak ada policy tulis).

-- ---------- gradebook ----------
create policy gb_sel on public.gradebook_entries for select to authenticated using (
  profile_id = auth.uid()
  or (public.app_is_guru() and public.app_can_see_class(class_id))
  or public.app_is_admin()
);
create policy gb_ins on public.gradebook_entries for insert to authenticated
  with check ((public.app_is_guru() and public.app_can_see_class(class_id)) or public.app_is_admin());
create policy gb_upd on public.gradebook_entries for update to authenticated
  using ((public.app_is_guru() and public.app_can_see_class(class_id)) or public.app_is_admin())
  with check ((public.app_is_guru() and public.app_can_see_class(class_id)) or public.app_is_admin());
create policy gb_del on public.gradebook_entries for delete to authenticated using (public.app_is_admin());

-- ---------- performance_ratings ----------
create policy pr_sel on public.performance_ratings for select to authenticated using (
  profile_id = auth.uid()
  or exists (select 1 from public.attempts a where a.assessment_id = assessment_id
             and (a.profile_id = auth.uid() or a.partner_id = auth.uid()))
  or (public.app_is_guru() and public.app_guru_scope_assessment(assessment_id))
);
create policy pr_ins on public.performance_ratings for insert to authenticated with check (
  (rater = 'self'   and profile_id = auth.uid() and dimension in ('diri','lkpd'))
  or (rater = 'teacher' and public.app_is_guru() and public.app_guru_scope_assessment(assessment_id))
);
create policy pr_upd on public.performance_ratings for update to authenticated using (
  (rater = 'self' and profile_id = auth.uid())
  or (rater = 'teacher' and public.app_is_guru())
);

-- ---------- collab_pairs ----------
create policy cp_sel on public.collab_pairs for select to authenticated using (
  owner_id = auth.uid() or partner_id = auth.uid()
  or (public.app_is_guru() and school_id = public.app_school())
);
create policy cp_ins on public.collab_pairs for insert to authenticated with check (
  school_id = public.app_school()
  and (owner_id = auth.uid() or public.app_is_guru())
);
create policy cp_upd on public.collab_pairs for update to authenticated using (
  public.app_is_guru() or owner_id = auth.uid()
) with check (public.app_is_guru() or owner_id = auth.uid());

-- ---------- access_grants ----------
create policy ag_sel on public.access_grants for select to authenticated using (
  profile_id = auth.uid() or (public.app_is_guru() and school_id = public.app_school())
);
create policy ag_wrt on public.access_grants for all to authenticated
  using (public.app_is_guru() and school_id = public.app_school())
  with check (public.app_is_guru() and school_id = public.app_school());

-- ---------- activity_logs (tulis hanya via RPC) ----------
create policy al_sel on public.activity_logs for select to authenticated using (
  profile_id = auth.uid()
  or (public.app_is_guru() and school_id = public.app_school())
  or public.app_is_admin()
);

-- ---------- notifications ----------
create policy nt_sel on public.notifications for select to authenticated using (
  school_id = public.app_school()
  and ( audience = 'school'
     or (audience = 'role'   and audience_ref = public.app_role()::text)
     or (audience = 'user'   and audience_ref = auth.uid()::text)
     or (audience = 'class'  and audience_ref::uuid in (select public.app_my_class_ids())) )
);
create policy nt_ins on public.notifications for insert to authenticated
  with check (public.app_is_guru() and school_id = public.app_school());
create policy nr_sel on public.notification_reads for select to authenticated using (profile_id = auth.uid());
create policy nr_wrt on public.notification_reads for insert to authenticated with check (profile_id = auth.uid());

-- ---------- audit & crosswalk ----------
create policy ad_sel on public.audit_logs for select to authenticated
  using (public.app_is_guru() and (school_id = public.app_school() or school_id is null));
create policy lc_sel on public.legacy_crosswalk for select to authenticated using (true);
create policy lc_wrt on public.legacy_crosswalk for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- ---------- cabut hak publik ----------
revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;