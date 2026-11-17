# BOOTSTRAP SEKOLAH & ADMIN PERTAMA

**Status: prosedur siap. Belum dijalankan untuk sekolah nyata.**
Dokumen ini dipakai sekali saat onboarding sekolah baru. Setelah admin pertama
ada, data lain diimpor lewat halaman **Admin → Import Data**.

---

## 1. Prinsip

1. Sekolah baru + admin pertama **tidak** dibuat lewat CSV import.
2. Akun admin dibuat melalui **Supabase Auth Admin API** (service role),
   bukan insert langsung ke `auth.users` dari frontend.
3. Password sementara dibuat server, ditampilkan **sekali**, dan wajib diganti
   saat login pertama.
4. Service role key hanya di environment/CLI, **jangan** ditulis ke repo,
   dokumen, log, atau chat.
5. Satu admin hanya melihat satu sekolah (`profiles.school_id`).
6. Jangan mengubah `schools.code` setelah akun dibuat: kode itu dipakai untuk
   email sintetis `username@<kode>.<role>.lms`.

---

## 2. Keputusan Awal

Cloud saat ini masih memiliki sekolah uji berkode `PLACEHOLDER-SCHOOL`.
Pilih salah satu:

| Pilihan | Kapan dipakai | Catatan |
|---|---|---|
| **Sekolah baru** (disarankan) | Data lama hanya uji/fiktif | Sekolah uji tetap terpisah; bisa dihapus nanti dengan approval |
| Ubah sekolah lama | Sekolah lama memang sekolah nyata yang sama | Ganti kode/nama lewat service role sebelum ada akun nyata |

Jangan mencampur akun sekolah nyata ke sekolah uji.

---

## 3. Data yang Disiapkan

Siapkan tanpa password:

- Kode sekolah, mis. `SMPN2KAR` (huruf/angka/titik/garis, 3–40).
- Nama sekolah.
- Kepala sekolah (opsional).
- Alamat (opsional).
- Username admin pertama, mis. `admin.sekolah`.
- Nama lengkap admin.
- Jenis kelamin admin (`L`/`P`, opsional).

Password **tidak** disiapkan manual; skrip membuatnya.

---

## 4. Prosedur A — Skrip (disarankan)

Prasyarat: Node.js 18+, akses service role key proyek.

### 4.1 Dry-run

PowerShell:

```powershell
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # jangan commit
$env:BOOTSTRAP_SCHOOL_CODE="SMPN2KAR"
$env:BOOTSTRAP_SCHOOL_NAME="SMPN 2 Karawang Barat"
$env:BOOTSTRAP_SCHOOL_HEADMASTER="Nama Kepala Sekolah"
$env:BOOTSTRAP_SCHOOL_ADDRESS="Alamat sekolah"
$env:BOOTSTRAP_ADMIN_USERNAME="admin.sekolah"
$env:BOOTSTRAP_ADMIN_NAME="Nama Admin"
$env:BOOTSTRAP_ADMIN_GENDER="L"

node scripts/bootstrap-school.mjs --dry-run
```

Dry-run hanya membaca dan menampilkan rencana. Tidak menulis apa pun.

### 4.2 Jalankan

```powershell
node scripts/bootstrap-school.mjs
```

Yang dilakukan skrip:

1. Menolak jika kode sekolah/username sudah ada.
2. Membuat baris `schools`.
3. Membuat Auth user dengan email
   `username@<kode-sekolah>.<role>.lms` (di sini role `admin`).
4. Membuat baris `profiles` dengan `must_change_password=true`.
5. Menulis `audit_logs` (`bootstrap_school`).
6. Menampilkan password sementara **sekali**.
7. Jika profil gagal, Auth user dan sekolah baru dihapus (kompensasi).

### 4.3 Setelah skrip

1. Buka aplikasi → tab **Admin**.
2. Login dengan username + password sementara.
3. Ganti password (minimal 12 karakter).
4. Masuk ke **Import Data** dan lanjutkan urutan:
   `sekolah → tahun → kelas → mapel → guru/siswa → wali/penugasan →
   keanggotaan → kategori → modul/materi → asesmen/soal → bank soal → nilai`.

---

## 5. Prosedur B — Manual (fallback)

Gunakan hanya jika skrip tidak bisa dijalankan.

### 5.1 Buat sekolah

Di SQL Editor (service role):

```sql
insert into public.schools (code, name, headmaster, address, settings)
values ('SMPN2KAR', 'SMPN 2 Karawang Barat', 'Nama Kepala Sekolah',
        'Alamat sekolah', '{}')
returning id, code;
```

### 5.2 Buat Auth user

Dashboard → **Authentication → Users → Add user**:

- Email: `admin.sekolah@smpn2kar.admin.lms`
- Password: buat acak panjang (minimal 12), **jangan simpan di repo**
- Auto-confirm: aktif

Catat UUID user yang dihasilkan.

### 5.3 Buat profil admin

```sql
insert into public.profiles
  (id, school_id, role, username, full_name, gender, status, must_change_password, settings)
values
  ('<uuid-auth-user>',
   (select id from public.schools where code = 'SMPN2KAR'),
   'admin', 'admin.sekolah', 'Nama Admin', 'L', 'aktif', true, '{}');
```

### 5.4 Audit

```sql
insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
values
  ((select id from public.schools where code = 'SMPN2KAR'),
   '<uuid-auth-user>', 'bootstrap_school', 'schools',
   (select id::text from public.schools where code = 'SMPN2KAR'),
   jsonb_build_object('code', 'SMPN2KAR', 'username', 'admin.sekolah'));
```

Jangan pernah menulis password ke SQL/audit/log.

---

## 6. Verifikasi

```sql
-- sekolah
select id, code, name from public.schools where code = 'SMPN2KAR';

-- admin dan sekolahnya
select p.username, p.full_name, p.role, p.status, p.must_change_password,
       s.code as sekolah
from public.profiles p
join public.schools s on s.id = p.school_id
where p.username = 'admin.sekolah';

-- tidak ada akun ganda
select school_id, username, count(*)
from public.profiles
where username = 'admin.sekolah'
group by school_id, username;
```

Checklist aplikasi:

- [ ] Login tab Admin berhasil.
- [ ] Dipaksa ganti password.
- [ ] Menu **Import Data** muncul.
- [ ] Unduh template berhasil.
- [ ] Admin tidak melihat data sekolah lain.
- [ ] `audit_logs` berisi `bootstrap_school`.

---

## 7. Rollback Aman

Jika bootstrap gagal **sebelum** ada data akademik:

1. Hapus Auth user admin baru (cascade profil).
2. Hapus sekolah baru **hanya jika** belum punya kelas/mapel/asesmen/nilai.
3. Jangan menghapus sekolah/akun yang sudah punya histori.

Periksa dulu:

```sql
select
 (select count(*) from public.classes where school_id = '<school-id>') as kelas,
 (select count(*) from public.subjects where school_id = '<school-id>') as mapel,
 (select count(*) from public.assessments where school_id = '<school-id>') as asesmen,
 (select count(*) from public.gradebook_entries where school_id = '<school-id>') as nilai;
```

Jika semua 0 dan hanya berisi akun uji, penghapusan boleh dilakukan dengan
persetujuan. Jika tidak, nonaktifkan akun (jangan hapus).

---

## 8. Keamanan

- Jangan pernah menaruh password di CSV import, `profiles`, repo, log, atau chat.
- Password sementara hanya tampil sekali; jika hilang, lakukan reset lewat
  **Admin → Pengguna → Reset**.
- Service role key hanya di environment sesi operator.
- Jika service role key sempat terekspos, rotasi key di dashboard Supabase.
- Jangan mengubah `schools.code` setelah akun dibuat, karena email login
  bergantung pada kode tersebut.
- Bootstrap berikutnya untuk sekolah lain memakai admin dan kode berbeda.

---

## 9. Setelah Bootstrap

1. Import `sekolah.csv` untuk melengkapi profil sekolah (kode harus sama).
2. Import tahun pelajaran, kelas, mapel.
3. Import akun guru dan siswa (password tampil sekali per batch).
4. Import wali kelas, penugasan guru, keanggotaan siswa.
5. Import kategori, modul/materi, asesmen/soal, bank soal, nilai historis.
6. Re-import file yang sama untuk memastikan tidak ada duplikat.
7. Baru setelah semua validasi bersih, pertimbangkan data produksi.
