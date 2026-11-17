-- ============================================================================
-- 0017_data_import.sql
-- Batch import Admin: staging + commit akademik inti (atomik).
-- Akun (guru/siswa) dibuat oleh Edge Function via Supabase Auth Admin API.
-- ============================================================================

create table public.data_import_batches (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id),
  kind          text not null,
  file_name     text,
  status        text not null default 'draft'
                check (status in ('draft','validated','committing','committed','partial','failed')),
  mapping       jsonb not null default '{}'::jsonb,
  counts        jsonb not null default '{}'::jsonb,
  requested_by  uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  validated_at  timestamptz,
  committed_at  timestamptz,
  error         text
);
create index ix_import_batches_school on public.data_import_batches(school_id, created_at desc);

create table public.data_import_rows (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.data_import_batches(id) on delete cascade,
  row_no        int not null,
  raw           jsonb not null default '{}'::jsonb,
  normalized    jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                check (status in ('pending','valid','invalid','committed','skipped','failed')),
  action        text check (action is null or action in ('insert','update','skip','error')),
  error         text,
  target_table  text,
  target_id     uuid,
  created_at    timestamptz not null default now(),
  unique (batch_id, row_no)
);
create index ix_import_rows_batch on public.data_import_rows(batch_id, row_no);

alter table public.data_import_batches enable row level security;
alter table public.data_import_rows enable row level security;

create policy dib_sel on public.data_import_batches for select to authenticated using (
  public.app_is_admin() and school_id = public.app_school()
);
create policy dir_sel on public.data_import_rows for select to authenticated using (
  exists (
    select 1 from public.data_import_batches b
    where b.id = batch_id and public.app_is_admin() and b.school_id = public.app_school()
  )
);
revoke all on public.data_import_batches from anon;
revoke all on public.data_import_rows from anon;
grant select on public.data_import_batches to authenticated;
grant select on public.data_import_rows to authenticated;

-- ----------------------------------------------------------------------------
-- Commit akademik inti. Hanya service role (dipanggil Edge Function).
-- ----------------------------------------------------------------------------
create or replace function public.app_import_commit(p_batch uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.data_import_batches;
  r public.data_import_rows;
  v_id uuid; v_year uuid; v_class uuid; v_student uuid; v_teacher uuid;
  v_subject uuid; v_prev text; v_action text; v_count int;
  v_module uuid; v_topic uuid; v_grade uuid; v_assess uuid; v_frozen timestamptz;
  v_payload jsonb; v_options text[]; v_pool uuid; v_prereq uuid; v_gbid uuid;
  v_src text; v_num numeric; v_max numeric; v_kind_txt text;
  v_inserted int := 0; v_updated int := 0; v_skipped int := 0;
begin
  select * into b from public.data_import_batches where id = p_batch for update;
  if b.id is null then return jsonb_build_object('ok', false, 'msg', 'Batch tidak ditemukan'); end if;
  if b.status not in ('validated','committing') then
    return jsonb_build_object('ok', false, 'msg', 'Batch tidak siap commit');
  end if;

  if exists (
    select 1 from public.data_import_rows
    where batch_id = p_batch and status in ('invalid','failed')
  ) then
    return jsonb_build_object('ok', false, 'msg', 'Masih ada baris invalid/gagal');
  end if;

  -- agar trigger audit (homeroom) mencatat aktor admin yang meminta
  perform set_config('request.jwt.claim.sub', b.requested_by::text, true);
  update public.data_import_batches set status = 'committing' where id = p_batch;

  begin
    for r in
      select * from public.data_import_rows
      where batch_id = p_batch and status = 'valid'
      order by row_no
    loop
      v_action := 'skip'; v_id := null;

      if b.kind = 'sekolah' then
        update public.schools s
           set name = coalesce(nullif(r.normalized->>'name',''), s.name),
               headmaster = coalesce(nullif(r.normalized->>'headmaster',''), s.headmaster),
               address = coalesce(nullif(r.normalized->>'address',''), s.address),
               logo_url = coalesce(nullif(r.normalized->>'logo_url',''), s.logo_url),
               settings = case when nullif(r.normalized->>'settings_json','') is null
                               then s.settings
                               else (r.normalized->>'settings_json')::jsonb end
         where s.id = b.school_id and s.code = (r.normalized->>'kode');
        if not found then raise exception 'Kode sekolah tidak cocok dengan sekolah admin'; end if;
        v_action := 'update'; v_id := b.school_id;

      elsif b.kind = 'tahun_pelajaran' then
        if coalesce((r.normalized->>'aktif')::boolean, false) then
          update public.academic_years set is_active = false where school_id = b.school_id;
        end if;
        insert into public.academic_years (school_id, label, start_date, end_date, is_active)
        values (b.school_id, r.normalized->>'label',
                (r.normalized->>'mulai')::date, (r.normalized->>'selesai')::date,
                coalesce((r.normalized->>'aktif')::boolean, false))
        on conflict (school_id, label) do update
          set start_date = excluded.start_date,
              end_date = excluded.end_date,
              is_active = excluded.is_active
        returning id into v_id;
        v_action := 'update';

      elsif b.kind = 'kelas' then
        select id into v_year from public.academic_years
         where school_id = b.school_id and label = r.normalized->>'tahun_label';
        if v_year is null then raise exception 'Tahun tidak ditemukan: %', r.normalized->>'tahun_label'; end if;
        insert into public.classes (school_id, academic_year_id, grade_level_id, label)
        select b.school_id, v_year, g.id, r.normalized->>'label'
        from public.grade_levels g
        where g.school_id = b.school_id and g.label = r.normalized->>'tingkat_label'
        on conflict (academic_year_id, label) do update
          set grade_level_id = excluded.grade_level_id
        returning id into v_id;
        if v_id is null then raise exception 'Tingkat tidak ditemukan: %', r.normalized->>'tingkat_label'; end if;
        v_action := 'update';

      elsif b.kind = 'mata_pelajaran' then
        insert into public.subjects (school_id, code, name)
        values (b.school_id, upper(r.normalized->>'kode'), r.normalized->>'nama')
        on conflict (school_id, code) do update set name = excluded.name
        returning id into v_id;
        v_action := 'update';

      elsif b.kind = 'wali_kelas' then
        select id into v_year from public.academic_years
         where school_id = b.school_id and label = r.normalized->>'tahun_label';
        select id into v_class from public.classes
         where academic_year_id = v_year and label = r.normalized->>'kelas_label';
        select id into v_teacher from public.profiles
         where school_id = b.school_id and username = r.normalized->>'guru_username' and role = 'guru';
        if v_year is null or v_class is null then raise exception 'Kelas/tahun tidak ditemukan'; end if;
        if v_teacher is null then raise exception 'Guru tidak ditemukan: %', r.normalized->>'guru_username'; end if;
        update public.classes set homeroom_id = v_teacher where id = v_class;
        v_action := 'update'; v_id := v_class;

      elsif b.kind = 'penugasan_guru' then
        select id into v_year from public.academic_years
         where school_id = b.school_id and label = r.normalized->>'tahun_label';
        select id into v_teacher from public.profiles
         where school_id = b.school_id and username = r.normalized->>'guru_username' and role = 'guru';
        select id into v_subject from public.subjects
         where school_id = b.school_id and code = upper(r.normalized->>'mapel_kode');
        if r.normalized->>'kelas_label' <> '' then
          select id into v_class from public.classes
           where academic_year_id = v_year and label = r.normalized->>'kelas_label';
        else
          v_class := null;
        end if;
        if v_year is null or v_teacher is null or v_subject is null then
          raise exception 'Referensi penugasan tidak lengkap';
        end if;
        select id into v_id from public.teacher_assignments
         where subject_id = v_subject and teacher_id = v_teacher
           and academic_year_id = v_year and class_id is not distinct from v_class
         limit 1;
        if v_id is null then
          insert into public.teacher_assignments
            (school_id, subject_id, teacher_id, academic_year_id, class_id)
          values (b.school_id, v_subject, v_teacher, v_year, v_class)
          returning id into v_id;
          v_action := 'insert';
        else
          v_action := 'skip';
        end if;

      elsif b.kind = 'keanggotaan_siswa' then
        select id into v_year from public.academic_years
         where school_id = b.school_id and label = r.normalized->>'tahun_label';
        select id into v_class from public.classes
         where academic_year_id = v_year and label = r.normalized->>'kelas_label';
        select id into v_student from public.profiles
         where school_id = b.school_id and username = r.normalized->>'siswa_username' and role = 'siswa';
        if v_class is null or v_student is null then raise exception 'Kelas/siswa tidak ditemukan'; end if;
        insert into public.class_memberships (class_id, profile_id)
        values (v_class, v_student)
        on conflict (class_id, profile_id) do update set left_at = null
        returning class_id into v_id;
        v_action := 'update';

      elsif b.kind in ('kategori_siswa_umum','kategori_siswa_mapel') then
        select id into v_year from public.academic_years
         where school_id = b.school_id and label = r.normalized->>'tahun_label';
        select id into v_class from public.classes
         where academic_year_id = v_year and label = r.normalized->>'kelas_label';
        select id into v_student from public.profiles
         where school_id = b.school_id and username = r.normalized->>'siswa_username' and role = 'siswa';
        if v_class is null or v_student is null then raise exception 'Kelas/siswa tidak ditemukan'; end if;
        if r.normalized->>'kategori' not in ('A','B','C') then raise exception 'Kategori invalid'; end if;
        if not exists (select 1 from public.class_memberships
                       where class_id = v_class and profile_id = v_student and left_at is null) then
          raise exception 'Siswa bukan anggota kelas';
        end if;

        if b.kind = 'kategori_siswa_umum' then
          select category into v_prev from public.student_general_categories
           where profile_id = v_student and academic_year_id = v_year;
          insert into public.student_general_categories
            (school_id, academic_year_id, class_id, profile_id, category, updated_by)
          values (b.school_id, v_year, v_class, v_student, r.normalized->>'kategori', b.requested_by)
          on conflict (profile_id, academic_year_id) do update
            set category = excluded.category, class_id = excluded.class_id,
                updated_by = excluded.updated_by, updated_at = now()
          returning id into v_id;
          insert into public.category_history
            (school_id, academic_year_id, class_id, profile_id, scope, category,
             previous_category, changed_by, source, note)
          values (b.school_id, v_year, v_class, v_student, 'general',
                  r.normalized->>'kategori', v_prev, b.requested_by, 'import', 'Import Admin');
        else
          select id into v_subject from public.subjects
           where school_id = b.school_id and code = upper(r.normalized->>'mapel_kode');
          if v_subject is null then raise exception 'Mapel tidak ditemukan'; end if;
          select category into v_prev from public.student_subject_categories
           where profile_id = v_student and subject_id = v_subject and academic_year_id = v_year;
          insert into public.student_subject_categories
            (school_id, academic_year_id, class_id, subject_id, profile_id, category, updated_by)
          values (b.school_id, v_year, v_class, v_subject, v_student,
                  r.normalized->>'kategori', b.requested_by)
          on conflict (profile_id, subject_id, academic_year_id) do update
            set category = excluded.category, class_id = excluded.class_id,
                updated_by = excluded.updated_by, updated_at = now()
          returning id into v_id;
          insert into public.category_history
            (school_id, academic_year_id, class_id, profile_id, scope, subject_id,
             category, previous_category, changed_by, source, note)
          values (b.school_id, v_year, v_class, v_student, 'subject', v_subject,
                  r.normalized->>'kategori', v_prev, b.requested_by, 'import', 'Import Admin');
        end if;
        v_action := 'update';

      elsif b.kind = 'modul_materi' then
        select id into v_subject from public.subjects
         where school_id = b.school_id and code = upper(r.normalized->>'mapel_kode');
        select id into v_grade from public.grade_levels
         where school_id = b.school_id and label = r.normalized->>'tingkat_label';
        if v_subject is null or v_grade is null then
          raise exception 'Mapel/tingkat tidak ditemukan';
        end if;
        insert into public.modules (school_id, subject_id, grade_level_id, title, description, sort_order)
        values (b.school_id, v_subject, v_grade, r.normalized->>'modul_judul',
                nullif(r.normalized->>'modul_deskripsi',''),
                coalesce(nullif(r.normalized->>'modul_urutan','')::int, 0))
        on conflict (subject_id, grade_level_id, title) do update
          set description = coalesce(nullif(excluded.description,''), modules.description),
              sort_order = excluded.sort_order
        returning id into v_module;

        insert into public.topics (module_id, title, sort_order)
        values (v_module, r.normalized->>'topik_judul',
                coalesce(nullif(r.normalized->>'topik_urutan','')::int, 0))
        on conflict (module_id, title) do update
          set sort_order = excluded.sort_order
        returning id into v_topic;

        if r.normalized->>'materi_jenis' not in ('dokumen','video','app','geogebra','pdf','lkpd_ref') then
          raise exception 'Jenis materi tidak valid: %', r.normalized->>'materi_jenis';
        end if;
        select id into v_id from public.materials
         where topic_id = v_topic and title = r.normalized->>'materi_judul'
           and coalesce(url,'') = coalesce(nullif(r.normalized->>'materi_url',''),'')
         limit 1;
        if v_id is null then
          insert into public.materials (topic_id, kind, title, url, sort_order)
          values (v_topic, r.normalized->>'materi_jenis', r.normalized->>'materi_judul',
                  nullif(r.normalized->>'materi_url',''),
                  coalesce(nullif(r.normalized->>'materi_urutan','')::int, 0))
          returning id into v_id;
          v_action := 'insert';
        else
          update public.materials
             set kind = r.normalized->>'materi_jenis',
                 sort_order = coalesce(nullif(r.normalized->>'materi_urutan','')::int, 0)
           where id = v_id;
          v_action := 'update';
        end if;

      elsif b.kind = 'asesmen' then
        select id into v_year from public.academic_years
         where school_id = b.school_id and label = r.normalized->>'tahun_label';
        select id into v_subject from public.subjects
         where school_id = b.school_id and code = upper(r.normalized->>'mapel_kode');
        if v_year is null or v_subject is null then
          raise exception 'Tahun/mapel asesmen tidak ditemukan';
        end if;

        v_module := null; v_topic := null;
        if nullif(r.normalized->>'modul_judul','') is not null then
          if nullif(r.normalized->>'tingkat_label','') is not null then
            select id into v_grade from public.grade_levels
             where school_id = b.school_id and label = r.normalized->>'tingkat_label';
            if v_grade is null then raise exception 'Tingkat tidak ditemukan'; end if;
            select id into v_module from public.modules
             where subject_id = v_subject and grade_level_id = v_grade
               and title = r.normalized->>'modul_judul';
          else
            select id into v_module from public.modules
             where subject_id = v_subject and title = r.normalized->>'modul_judul'
             limit 1;
          end if;
          if v_module is null then raise exception 'Modul tidak ditemukan'; end if;
          if nullif(r.normalized->>'topik_judul','') is not null then
            select id into v_topic from public.topics
             where module_id = v_module and title = r.normalized->>'topik_judul';
            if v_topic is null then raise exception 'Topik tidak ditemukan'; end if;
          end if;
        end if;

        v_id := null; v_frozen := null;
        select id, package_frozen_at into v_id, v_frozen from public.assessments
         where school_id = b.school_id and code = upper(r.normalized->>'kode');
        if v_id is not null and v_frozen is not null then
          v_action := 'skip';
        else
          v_prereq := null;
          if nullif(r.normalized->>'prasyarat_kode','') is not null then
            select id into v_prereq from public.assessments
             where school_id = b.school_id and code = upper(r.normalized->>'prasyarat_kode');
            if v_prereq is null then raise exception 'Prasyarat tidak ditemukan'; end if;
          end if;
          if v_id is null then
            insert into public.assessments
              (school_id, code, subject_id, module_id, topic_id, academic_year_id,
               semester, title, kind, status, collab_mode, delivery, file_url,
               config, published_at, prerequisite_assessment_id, created_by)
            values
              (b.school_id, upper(r.normalized->>'kode'), v_subject, v_module, v_topic, v_year,
               nullif(r.normalized->>'semester','')::int, r.normalized->>'judul',
               coalesce(nullif(r.normalized->>'jenis',''),'lkpd')::public.assessment_kind,
               coalesce(nullif(r.normalized->>'status',''),'draft')::public.lkpd_status,
               coalesce(nullif(r.normalized->>'kolaborasi',''),'none')::public.collab_mode,
               coalesce(nullif(r.normalized->>'pengiriman',''),'portal')::public.delivery_mode,
               nullif(r.normalized->>'file_url',''),
               coalesce(nullif(r.normalized->>'config_json','')::jsonb,'{}'::jsonb),
               nullif(r.normalized->>'published_at','')::timestamptz,
               v_prereq, b.requested_by)
            returning id into v_id;
            v_action := 'insert';
          else
            update public.assessments
               set subject_id = v_subject, module_id = v_module, topic_id = v_topic,
                   academic_year_id = v_year,
                   semester = nullif(r.normalized->>'semester','')::int,
                   title = r.normalized->>'judul',
                   kind = coalesce(nullif(r.normalized->>'jenis',''),'lkpd')::public.assessment_kind,
                   status = coalesce(nullif(r.normalized->>'status',''),'draft')::public.lkpd_status,
                   collab_mode = coalesce(nullif(r.normalized->>'kolaborasi',''),'none')::public.collab_mode,
                   delivery = coalesce(nullif(r.normalized->>'pengiriman',''),'portal')::public.delivery_mode,
                   file_url = nullif(r.normalized->>'file_url',''),
                   config = coalesce(nullif(r.normalized->>'config_json','')::jsonb,'{}'::jsonb),
                   published_at = nullif(r.normalized->>'published_at','')::timestamptz,
                   prerequisite_assessment_id = v_prereq
             where id = v_id;
            v_action := 'update';
          end if;
        end if;

      elsif b.kind = 'soal_asesmen' then
        select id, package_frozen_at into v_assess, v_frozen from public.assessments
         where school_id = b.school_id and code = upper(r.normalized->>'asesmen_kode');
        if v_assess is null then raise exception 'Asesmen tidak ditemukan'; end if;
        if v_frozen is not null then
          v_action := 'skip';
        else
          v_kind_txt := r.normalized->>'jenis';
          v_payload := jsonb_build_object('prompt', r.normalized->>'soal');
          if v_kind_txt = 'num' then
            v_payload := v_payload || jsonb_build_object(
              'answer', (r.normalized->>'kunci')::numeric, 'tol', 0);
          elsif v_kind_txt in ('mc','bs') then
            v_payload := v_payload || jsonb_build_object('key', r.normalized->>'kunci');
            if nullif(r.normalized->>'pilihan','') is not null then
              select array_agg(trim(x)) into v_options
                from unnest(string_to_array(r.normalized->>'pilihan','|')) x
               where trim(x) <> '';
              v_payload := v_payload || jsonb_build_object('options', to_jsonb(v_options));
            end if;
          elsif v_kind_txt = 'match' then
            select array_agg(trim(x)) into v_options
              from unnest(regexp_split_to_array(r.normalized->>'keys','\s*[|,]\s*')) x
             where trim(x) <> '';
            v_payload := v_payload || jsonb_build_object('keys', to_jsonb(v_options));
          elsif v_kind_txt = 'scaffold' then
            v_payload := v_payload || jsonb_build_object(
              'answers', (select to_jsonb(array_agg(trim(x)::numeric))
                            from unnest(string_to_array(r.normalized->>'answers',',')) x
                           where trim(x) <> ''),
              'tol', 0);
          end if;
          select id into v_id from public.question_items
           where assessment_id = v_assess and item_key = r.normalized->>'item_key';
          if v_id is null then
            insert into public.question_items
              (assessment_id, item_key, kind, difficulty, payload, weight, sort_order)
            values
              (v_assess, r.normalized->>'item_key', v_kind_txt,
               nullif(r.normalized->>'kesulitan',''), v_payload,
               coalesce(nullif(r.normalized->>'weight','')::numeric, 1),
               coalesce(nullif(r.normalized->>'urutan','')::int, 0))
            returning id into v_id;
            v_action := 'insert';
          else
            update public.question_items
               set kind = v_kind_txt,
                   difficulty = nullif(r.normalized->>'kesulitan',''),
                   payload = v_payload,
                   weight = coalesce(nullif(r.normalized->>'weight','')::numeric, 1),
                   sort_order = coalesce(nullif(r.normalized->>'urutan','')::int, 0)
             where id = v_id;
            v_action := 'update';
          end if;
        end if;

      elsif b.kind = 'bank_soal' then
        select id into v_subject from public.subjects
         where school_id = b.school_id and code = upper(r.normalized->>'mapel_kode');
        if v_subject is null then raise exception 'Mapel bank soal tidak ditemukan'; end if;
        select id into v_pool from public.question_pools
         where school_id = b.school_id and subject_id = v_subject
           and title = r.normalized->>'pool_judul';
        if v_pool is null then
          insert into public.question_pools (school_id, subject_id, title, created_by)
          values (b.school_id, v_subject, r.normalized->>'pool_judul', b.requested_by)
          returning id into v_pool;
        end if;

        v_kind_txt := r.normalized->>'jenis';
        v_payload := jsonb_build_object('prompt', r.normalized->>'soal');
        if v_kind_txt = 'num' then
          v_payload := v_payload || jsonb_build_object(
            'answer', (r.normalized->>'kunci')::numeric, 'tol', 0);
        elsif v_kind_txt in ('mc','bs') then
          v_payload := v_payload || jsonb_build_object('key', r.normalized->>'kunci');
          if nullif(r.normalized->>'pilihan','') is not null then
            select array_agg(trim(x)) into v_options
              from unnest(string_to_array(r.normalized->>'pilihan','|')) x
             where trim(x) <> '';
            v_payload := v_payload || jsonb_build_object('options', to_jsonb(v_options));
          end if;
        elsif v_kind_txt = 'match' then
          select array_agg(trim(x)) into v_options
            from unnest(regexp_split_to_array(r.normalized->>'keys','\s*[|,]\s*')) x
           where trim(x) <> '';
          v_payload := v_payload || jsonb_build_object('keys', to_jsonb(v_options));
        elsif v_kind_txt = 'scaffold' then
          v_payload := v_payload || jsonb_build_object(
            'answers', (select to_jsonb(array_agg(trim(x)::numeric))
                          from unnest(string_to_array(r.normalized->>'answers',',')) x
                         where trim(x) <> ''),
            'tol', 0);
        end if;

        select id into v_id from public.bank_items
         where school_id = b.school_id and subject_id = v_subject
           and pool_id = v_pool
           and coalesce(indicator,'') = coalesce(nullif(r.normalized->>'indikator',''),'')
           and kind = v_kind_txt
           and payload->>'prompt' = r.normalized->>'soal'
         limit 1;
        if v_id is null then
          insert into public.bank_items
            (school_id, subject_id, pool_id, indicator, kind, difficulty, payload,
             status, created_by)
          values
            (b.school_id, v_subject, v_pool, nullif(r.normalized->>'indikator',''),
             v_kind_txt, nullif(r.normalized->>'kesulitan',''), v_payload,
             coalesce(nullif(r.normalized->>'status',''),'active'), b.requested_by)
          returning id into v_id;
          v_action := 'insert';
        else
          update public.bank_items
             set difficulty = nullif(r.normalized->>'kesulitan',''),
                 payload = v_payload,
                 status = coalesce(nullif(r.normalized->>'status',''),'active')
           where id = v_id;
          v_action := 'update';
        end if;

      elsif b.kind = 'nilai_historis' then
        select id into v_year from public.academic_years
         where school_id = b.school_id and label = r.normalized->>'tahun_label';
        select id into v_class from public.classes
         where academic_year_id = v_year and label = r.normalized->>'kelas_label';
        select id into v_student from public.profiles
         where school_id = b.school_id and username = r.normalized->>'siswa_username' and role = 'siswa';
        select id into v_assess from public.assessments
         where school_id = b.school_id and code = upper(r.normalized->>'asesmen_kode');
        if v_year is null or v_class is null or v_student is null or v_assess is null then
          raise exception 'Referensi nilai historis tidak lengkap';
        end if;
        if not exists (select 1 from public.class_memberships
                       where class_id = v_class and profile_id = v_student and left_at is null) then
          raise exception 'Siswa bukan anggota kelas';
        end if;
        v_num := (r.normalized->>'skor')::numeric;
        v_max := coalesce(nullif(r.normalized->>'max_skor','')::numeric, 100);
        if v_max <= 0 or v_num < 0 or v_num > v_max then
          raise exception 'Skor di luar rentang';
        end if;
        select id, source into v_gbid, v_src from public.gradebook_entries
         where assessment_id = v_assess and profile_id = v_student
           and entry_kind = 'assessment'
         limit 1;
        if v_gbid is not null then
          if v_src = 'auto' then
            v_action := 'skip'; v_id := v_gbid;
          else
            update public.gradebook_entries
               set score = v_num, max_score = v_max,
                   source = coalesce(nullif(r.normalized->>'sumber',''),'impor'),
                   note = nullif(r.normalized->>'catatan',''),
                   created_by = b.requested_by
             where id = v_gbid;
            v_action := 'update'; v_id := v_gbid;
          end if;
        else
          insert into public.gradebook_entries
            (school_id, academic_year_id, class_id, profile_id, entry_kind,
             assessment_id, score, max_score, source, note, created_by)
          values
            (b.school_id, v_year, v_class, v_student, 'assessment',
             v_assess, v_num, v_max,
             coalesce(nullif(r.normalized->>'sumber',''),'impor'),
             nullif(r.normalized->>'catatan',''), b.requested_by)
          returning id into v_id;
          v_action := 'insert';
        end if;

      else
        raise exception 'Jenis import belum diaktifkan: %', b.kind;
      end if;

      if v_action = 'insert' then v_inserted := v_inserted + 1;
      elsif v_action = 'update' then v_updated := v_updated + 1;
      else v_skipped := v_skipped + 1; end if;

      update public.data_import_rows
         set status = 'committed', action = v_action, target_id = v_id, error = null
       where id = r.id;
    end loop;

    select count(*) into v_count from public.data_import_rows where batch_id = p_batch;
    update public.data_import_batches
       set status = 'committed', committed_at = now(),
           counts = jsonb_build_object(
             'total', v_count, 'inserted', v_inserted,
             'updated', v_updated, 'skipped', v_skipped, 'failed', 0),
           error = null
     where id = p_batch;

    insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
    values (b.school_id, b.requested_by, 'import_commit', 'data_import_batches', p_batch::text,
            jsonb_build_object('kind', b.kind, 'inserted', v_inserted,
                               'updated', v_updated, 'skipped', v_skipped));

    return jsonb_build_object('ok', true, 'inserted', v_inserted,
                              'updated', v_updated, 'skipped', v_skipped, 'total', v_count);
  exception when others then
    update public.data_import_batches
       set status = 'failed', error = SQLERRM
     where id = p_batch;
    return jsonb_build_object('ok', false, 'msg', SQLERRM);
  end;
end $$;

revoke all on function public.app_import_commit(uuid) from public, anon, authenticated;
grant execute on function public.app_import_commit(uuid) to service_role;
