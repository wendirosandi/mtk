# RENCANA IMPORT DATA SEKOLAH

**Status: IMPLEMENTASI TAHAP C SELESAI (lokal), belum diterapkan ke produksi.**

Dokumen ini menjadi acuan Tahap A–E untuk memasukkan data sekolah nyata melalui Admin LMS.

---

## 1. Ringkasan Audit

### Yang sudah tersedia

| Area | Kondisi |
|---|---|
| Skema | 34 tabel, migrasi `0001`–`0016` applied |
| Auth | Supabase Auth + email sintetis `username@<school>.<role>.lms` |
| Role | `admin`, `guru`, `siswa`; Walas = guru dengan `classes.homeroom_id` |
| Kategori | umum (Walas) + per mapel (Guru), RPC + history + audit |
| Admin UI | dashboard, pengguna (buat/reset), sekolah, akademik, monitoring, pengaturan |
| Guru UI | kelas, kurikulum, asesmen, bank soal, nilai, monitoring, walas, kategori |
| CI/QA | JS check, golden generator, Supabase lint |

### Gap utama untuk import

1. **Belum ada halaman Import Data / batch import.**
2. **Belum ada tabel staging/riwayat import.**
3. Admin hanya bisa membuat akun **satu per satu**; belum bulk.
4. Admin belum bisa mengelola **keanggotaan siswa** dan **tingkat** dari UI.
5. `admin-users` belum menetapkan `must_change_password`, belum idempotent, belum batch.
6. Admin tidak dapat membuat **sekolah baru** (tidak ada policy INSERT `schools`).
   Sekolah pertama + admin pertama harus dibuat via service/CLI (bootstrap).
7. `profiles.status` belum dipakai untuk memblokir login; deaktivasi akun harus
   melalui Auth Admin (ban) + status profil.
8. Belum ada template CSV dan validasi referensi.

### Relasi inti

```
schools
 ├─ academic_years ── classes ── class_memberships ── profiles(siswa)
 │                         └─ homeroom_id ── profiles(guru/Walas)
 ├─ grade_levels
 ├─ subjects
 │    └─ teacher_assignments ── profiles(guru) + classes + years
 └─ profiles
      ├─ student_general_categories (per year)
      ├─ student_subject_categories (per year+mapel)
      └─ gradebook_entries / attempts / activity_logs

subjects → modules → topics → materials
                         └→ assessments → question_items
                                      ├→ attempts → attempt_answers
                                      └→ gradebook_entries

question_pools → bank_items
assessments → kisi_kisi → paket (question_items)
```

Tidak perlu tabel duplikat untuk data inti. Yang perlu ditambahkan hanya tabel
**operasional import** (batch + baris) dan perluasan Edge Function/RPC.

---

## 2. Arsitektur Import

```
Admin browser
  └─ halaman admin-import
       ├─ unduh template CSV
       ├─ parse CSV (PapaParse)
       ├─ mapping kolom
       ├─ preview + validasi awal
       └─ invoke Edge Function `admin-import`
              ├─ verifikasi JWT + role admin + school_id
              ├─ validasi server-side
              ├─ dry-run → hasil per baris (tanpa tulis)
              └─ commit:
                    ├─ akun → Supabase Auth Admin API (service role)
                    └─ data akademik → RPC `app_import_commit` (satu transaksi)
```

### Prinsip

1. **Frontend tidak dipercaya**; validasi final di server.
2. **Tidak ada password di CSV**, repository, log, atau tabel.
3. **Idempotent**: natural key + `ON CONFLICT`/cek existing.
4. **Satu sekolah per admin**: `school_id` diambil dari profil admin, bukan dari CSV.
5. **Dry-run wajib** sebelum commit.
6. **Tidak menghapus histori**; akun dinonaktifkan, bukan dihapus.
7. **Batch ID** untuk audit dan laporan.

---

## 3. Tabel Operasional Import (draft migrasi 0017)

### `data_import_batches`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | batch ID |
| `school_id` | uuid | sekolah pemilik |
| `kind` | text | jenis template (`guru`, `siswa`, `kelas`, …) |
| `file_name` | text | nama file asli |
| `status` | text | `draft`, `validated`, `committing`, `committed`, `partial`, `failed` |
| `mapping` | jsonb | header CSV → kolom kanonik |
| `counts` | jsonb | total/valid/invalid/insert/update/skip/fail |
| `requested_by` | uuid | admin |
| `created_at` / `validated_at` / `committed_at` | timestamptz | waktu |
| `error` | text | kegagalan batch |

### `data_import_rows`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | baris |
| `batch_id` | uuid | FK batch |
| `row_no` | int | nomor baris CSV |
| `raw` | jsonb | isi CSV asli |
| `normalized` | jsonb | hasil mapping/validasi |
| `status` | text | `pending`, `valid`, `invalid`, `inserted`, `updated`, `skipped`, `failed` |
| `action` | text | `insert`, `update`, `skip`, `error` |
| `error` | text | pesan per baris |
| `target_table` / `target_id` | text/uuid | hasil commit |

RLS: `admin` hanya dapat membaca batch sekolahnya; **tidak ada write policy**
untuk authenticated. Penulisan hanya lewat Edge Function service role.

---

## 4. Urutan Import (dependency-safe)

1. **Bootstrap** sekolah + admin pertama (service/CLI, di luar CSV; lihat `docs/BOOTSTRAP_SEKOLAH.md`).
2. `sekolah` — update profil sekolah yang sudah ada.
3. `tahun_pelajaran` — tahun + status aktif.
4. `kelas` — tahun + tingkat + label.
5. `mata_pelajaran` — kode + nama.
6. `guru` — akun auth + profil.
7. `siswa` — akun auth + profil.
8. `wali_kelas` — `classes.homeroom_id`.
9. `penugasan_guru` — subject + teacher + year + class.
10. `keanggotaan_siswa` — class + student.
11. `kategori_siswa_umum` — per year + class.
12. `kategori_siswa_mapel` — per year + subject.
13. `modul_materi` — module/topic/material.
14. `asesmen` — metadata asesmen.
15. `soal_asesmen` — question_items (tambahan wajib untuk LKPD).
16. `bank_soal` — pool + bank items.
17. `nilai_historis` — gradebook historis.

Setiap tahap hanya menerima referensi dari tahap sebelumnya atau data existing.
Jika referensi tidak ada → baris `invalid`, batch tidak boleh commit.

---

## 5. Validasi

### Format & wajib
- Header wajib, tipe data, enum, tanggal, UUID referensi.
- Username regex `^[a-z0-9._-]{3,40}$`, unik per sekolah.
- Role hanya `admin|guru|siswa` (akun baru: guru/siswa; admin dibuat eksplisit).
- Kategori A/B/C; gender L/P.
- Skor 0..max_score; nilai tidak boleh melebihi max.

### Relasi
- Tahun/kelas/mapel/guru/siswa harus satu sekolah dengan admin.
- Kelas harus milik tahun tersebut; tingkat harus ada.
- Wali harus guru; penugasan harus guru+mapel+tahun+kelas valid.
- Keanggotaan harus siswa; kategori harus anggota kelas tersebut.
- Modul harus mapel+tingkat; asesmen harus tahun+mapel (+modul/topik).
- Prasyarat harus kode asesmen yang ada (boleh di batch yang sama).
- Bank pool harus mapel yang sama; kisi harus asesmen valid.

### Duplikasi
- Duplikat di dalam file (username, kode kelas, kode asesmen, dll).
- Duplikat di database memakai natural key → `skip`/`update` sesuai jenis.
- Jangan membuat akun kedua untuk username/email yang sama.

### Aturan khusus
- **Akun**: tidak ada password di CSV; password dibuat server.
- **Nilai**: default tidak menimpa nilai `auto`; hanya `source=impor`/`manual` dengan opsi eksplisit.
- **Paket beku**: asesmen dengan `package_frozen_at` tidak boleh diubah soalnya.
- **Tahun aktif**: hanya satu; perubahan status aktif butuh konfirmasi.
- **Kategori**: perubahan dicatat di `category_history` dan `audit_logs`.

---

## 6. Transaksi & Kegagalan

| Data | Mekanisme |
|---|---|
| Data akademik (SQL) | Satu RPC `app_import_commit(batch_id)` per batch; error → rollback seluruh batch |
| Akun | Auth Admin API per akun; jika profil gagal → hapus auth user yang baru dibuat (compensating rollback) |
| Batch campuran akun + data | Dipisah: batch akun selesai → batch akademik; status `partial` jika sebagian |
| Retry | Baris `inserted/skipped` tidak diproses ulang; baris `failed` dapat diulang |
| Audit | `audit_logs` + `data_import_batches/rows`; tidak ada data historis dihapus |

Catatan: Supabase Auth dan PostgreSQL tidak berbagi satu transaksi. Karena itu
status batch harus eksplisit dan commit akun tidak boleh mengklaim atomik penuh.

---

## 7. Keamanan

- Service role hanya di Edge Function; tidak pernah ke browser.
- CSV tidak boleh berisi password/token.
- File dibatasi (mis. 2 MB / 2.000 baris); parsing di browser dan server.
- Escape HTML saat preview; jangan render CSV sebagai HTML.
- Tolak baris lintas sekolah.
- Rate limit per admin (mis. 10 batch/jam).
- Hash/log tidak menyimpan isi sensitif.
- Akun dinonaktifkan (Auth ban + `profiles.status='nonaktif'`), bukan dihapus.
- Reset password hanya lewat `admin-users`/`admin-import`, bukan CSV.

---

## 8. Dampak & Kompatibilitas

- `profiles.settings.kelas` tetap legacy; keanggotaan resmi di `class_memberships`.
- `profiles.settings.kategori` fallback; kategori resmi di tabel 0016.
- Gradebook unik (0011) mencegah duplikasi nilai.
- Kategori RPC/history tetap berlaku; import menulis dengan sumber `import`.
- Asesmen/soal mengikuti status draft/active/frozen.
- Tidak ada perubahan pada loginId/username sintetis.
- Sekolah baru: bootstrap service, bukan import CSV.

---

## 9. Rencana Pengujian

1. CSV fiktif 1 sekolah, 2 tahun, 3 kelas, 4 mapel, 6 guru, 30 siswa.
2. Urutan lengkap dari tahun → nilai.
3. Dry-run: 0 perubahan DB.
4. Commit: jumlah insert/update/skip/fail sesuai.
5. Re-import file yang sama: idempotent (0 duplikat).
6. Referensi hilang → baris invalid, commit ditolak.
7. Duplikat username/kode → skip/error yang jelas.
8. Lintas sekolah → ditolak.
9. Akun: password acak, `must_change_password`, login berhasil, reset.
10. Deaktivasi akun: login ditolak, histori tetap.
11. Kategori: umum/mapel tidak saling menimpa; history bertambah.
12. Nilai: tidak menimpa auto; nilai historis masuk.
13. Batch history & audit lengkap.
14. Tidak ada secret di response/log/repo.

---

## 10. Tahapan Implementasi

| Tahap | Isi | Status |
|---|---|---|
| A | Audit database/Admin | ✅ |
| B | Template CSV & alur import | ✅ |
| C | Migrasi 0017 + Edge Function + halaman admin-import | ✅ lokal, belum deploy |
| D | Uji data fiktif lokal/staging | ✅ lokal (lihat bagian 9) |
| E | Import produksi setelah approval | ⏳ |

## 11. Status Implementasi dan Hasil Uji (Lokal + Cloud)

Sudah dibuat:

| File | Isi |
|---|---|
| `supabase/migrations/0017_data_import.sql` | tabel batch/row, RLS select admin, RPC `app_import_commit` untuk 14 jenis data non-akun |
| `supabase/functions/admin-import/index.ts` | validasi, dry-run, commit, riwayat, akun via Auth Admin API |
| `supabase/functions/admin-users/index.ts` | create/reset/deactivate/reactivate + ganti password sendiri |
| `src/lib/import-schema.js` | 16 template, alias kolom, template CSV |
| `pages/admin-import.js` | wizard upload → mapping → validasi → konfirmasi → hasil/riwayat |
| `pages/ganti-password.js` | pemaksaan ganti password login pertama |
| `tests/imports/` | uji schema + 11 fixture CSV fiktif |

Hasil uji lokal (Supabase lokal + data fiktif):

- Migrasi `0001`–`0017` applied; `supabase db lint --local` tanpa error.
- Core: sekolah, tahun, kelas, mapel, wali, penugasan, keanggotaan, kategori berhasil; re-import tidak membuat duplikat.
- Konten: modul/materi, asesmen, soal, bank soal, nilai historis berhasil; re-import memperbarui tanpa duplikat.
- Nilai `auto` tidak ditimpa; asesmen/soal beku dilewati.
- Validasi menolak kode sekolah lain, referensi hilang, aktif tanpa `published_at`, skor di luar rentang, dan duplikat dalam file.
- Akun: password dibuat server, login berhasil, wajib ganti password, password lama ditolak, nonaktif memblokir login, reaktivasi berhasil, re-import tidak membuat akun kedua.
- UI: login admin → Import Data → pilih guru → upload → mapping otomatis → validasi → centang konfirmasi → commit → kredensial tampil sekali → riwayat batch muncul.

Sudah diterapkan ke cloud:

- Migrasi `0017` applied (`supabase migration list --linked`: 0001–0017).
- Edge Function `admin-import` dan `admin-users` aktif (`verify_jwt: true`).
- Smoke test cloud memakai admin sementara + data fiktif:
  validasi sekolah/guru berhasil, referensi hilang ditolak, commit batch
  invalid ditolak, riwayat/detail batch terbaca. **Tidak ada data akademik
  atau akun yang di-commit**; admin dan batch smoke langsung dibersihkan.

Belum dilakukan:

- Import data sekolah nyata belum dilakukan.
- Uji staging dengan volume data sekolah lengkap belum dilakukan.
- Rate limit, hash konfirmasi batch, dan E2E otomatis belum ada.
- Data Google Sheets lama masih perlu pemetaan terpisah.Lihat:
- `docs/CSV_IMPORT_TEMPLATE.md`
- `docs/ACCOUNT_PROVISIONING.md`
- `docs/ADMIN_DATA_MANAGEMENT.md`
- `docs/BOOTSTRAP_SEKOLAH.md`
