-- jalankan SETELAH migration, di DB lokal/staging
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud)
values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','admin@placeholder-school.admin.lms','x',now(),'{}','{}',now(),now(),'','authenticated'),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','guru1@placeholder-school.guru.lms','x',now(),'{}','{}',now(),now(),'','authenticated'),
 ('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','8-f-syakirah@placeholder-school.siswa.lms','x',now(),'{}','{}',now(),now(),'','authenticated'),
 ('44444444-4444-4444-8444-444444444444','00000000-0000-0000-0000-000000000000','8-f-siswa2@placeholder-school.siswa.lms','x',now(),'{}','{}',now(),now(),'','authenticated'),
 ('55555555-5555-4555-8555-555555555555','00000000-0000-0000-0000-000000000000','8-g-siswa3@placeholder-school.siswa.lms','x',now(),'{}','{}',now(),now(),'','authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, school_id, role, username, full_name, settings)
select u.id, s.id, v.role, v.un, v.fn, v.st::jsonb
from (values
 ('11111111-1111-4111-8111-111111111111','admin','admin','Admin Sekolah','{}'),
 ('22222222-2222-4222-8222-222222222222','guru','guru1','GURU SATU','{"kategori":""}'),
 ('33333333-3333-4333-8333-333333333333','siswa','8-f-syakirah','SYAKIRAH','{"kategori":"A","kelas":"8.F"}'),
 ('44444444-4444-4444-8444-444444444444','siswa','8-f-siswa2','SISWA DUA','{"kategori":"B","kelas":"8.F"}'),
 ('55555555-5555-4555-8555-555555555555','siswa','8-g-siswa3','SISWA TIGA','{"kategori":"B","kelas":"8.G"}')
) v(id, role, un, fn, st)
join auth.users u on u.id = v.id::uuid
join public.schools s on s.code = 'PLACEHOLDER-SCHOOL'
on conflict (id) do nothing;

-- kelas 8.F & 8.G pada tahun aktif + membership + assignment guru1 (8.F saja)
insert into public.classes (id, school_id, academic_year_id, grade_level_id, label)
select 'aaaaaaaa-0000-4000-8000-000000000001', s.id, y.id, g.id, '8.F'
from public.schools s, public.academic_years y, public.grade_levels g
where s.code='PLACEHOLDER-SCHOOL' and y.is_active and g.rank=8
on conflict do nothing;
insert into public.classes (id, school_id, academic_year_id, grade_level_id, label)
select 'aaaaaaaa-0000-4000-8000-000000000002', s.id, y.id, g.id, '8.G'
from public.schools s, public.academic_years y, public.grade_levels g
where s.code='PLACEHOLDER-SCHOOL' and y.is_active and g.rank=8
on conflict do nothing;
insert into public.class_memberships (class_id, profile_id) values
 ('aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333'),
 ('aaaaaaaa-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444'),
 ('aaaaaaaa-0000-4000-8000-000000000002','55555555-5555-4555-8555-555555555555')
on conflict do nothing;
insert into public.teacher_assignments (school_id, subject_id, teacher_id, academic_year_id, class_id)
select s.id, sb.id, '22222222-2222-4222-8222-222222222222', y.id, 'aaaaaaaa-0000-4000-8000-000000000001'
from public.schools s, public.subjects sb, public.academic_years y
where s.code='PLACEHOLDER-SCHOOL' and sb.code='MTK' and y.is_active
on conflict do nothing;
-- asesmen uji + item
insert into public.assessments (id, school_id, code, legacy_code, subject_id, academic_year_id, semester, title, kind, status, collab_mode, delivery, file_url, published_at)
select 'bbbbbbbb-0000-4000-8000-000000000001', s.id, 'MTK-8202', 'MTK-004', sb.id, y.id, 2, 'Teorema Pythagoras', 'lkpd', 'active', 'required', 'exambro', 'LKPD/MTK004.html', now()
from public.schools s, public.subjects sb, public.academic_years y
where s.code='PLACEHOLDER-SCHOOL' and sb.code='MTK' and y.is_active
on conflict do nothing;
insert into public.question_items (assessment_id, item_key, kind, payload, weight, sort_order) values
 ('bbbbbbbb-0000-4000-8000-000000000001','k1.hyp','num','{"answer":15,"tol":0}',2,1),
 ('bbbbbbbb-0000-4000-8000-000000000001','k1.shape','mc','{"key":"segitiga_siku"}',1,2),
 ('bbbbbbbb-0000-4000-8000-000000000001','k2.types','match','{"keys":["Segitiga Siku-siku","Segitiga Lancip","Segitiga Tumpul"]}',3,3),
 ('bbbbbbbb-0000-4000-8000-000000000001','k1.steps','scaffold','{"answers":[9,12,15,81,144,225],"tol":0}',6,4)
on conflict do nothing;