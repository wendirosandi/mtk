-- Matriks skenario RLS. Jalankan per-blok dengan identitas berbeda.
-- Cara set identitas (Supabase lokal/CI):
--   select set_config('request.jwt.claim.sub','<uuid>',true);
--   set role authenticated;
-- Setiap ASSERT gagal = migration test gagal.

-- S1 siswa baca profil sesama sekolah OK, lintas sekolah ditolak (row 0)
select 1 where (select count(*) from public.profiles) >= 3;
-- S2 siswa TIDAK dapat membaca question_items
do $$ begin
  if (select count(*) from public.question_items) <> 0 then
    raise exception 'RLS BOCOR: siswa melihat question_items'; end if;
end $$;
-- S3 siswa tidak dapat update attempts langsung
do $$ begin
  update public.attempts set status='graded' where true;
  if found then raise exception 'RLS BOCOR: siswa mengubah status attempt'; end if;
end $$;
-- S4 siswa tidak dapat insert gradebook
do $$ begin
  insert into public.gradebook_entries (school_id, academic_year_id, class_id, profile_id, entry_kind, score)
  select school_id, (select id from academic_years limit 1), (select id from classes limit 1), id, 'manual', 100
  from public.profiles limit 1;
  raise exception 'RLS BOCOR: siswa menulis gradebook';
exception when insufficient_privilege then null; when others then null; end $$;
-- S5 guru hanya melihat kelas terassign (8.F), tidak 8.G
do $$ declare n int; begin
  select count(*) into n from public.gradebook_entries g
   where g.class_id = 'aaaaaaaa-0000-4000-8000-000000000002';
  if n <> 0 then raise exception 'RLS BOCOR: guru melihat kelas di luar scope'; end if;
end $$;
-- S6 admin dapat semua sekolah miliknya; anon ditolak total
-- (dijalankan dengan set role anon → semua select mengembalikan 0 baris)