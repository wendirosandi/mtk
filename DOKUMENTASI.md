# DOKUMENTASI LMS MTK

Dokumen ini adalah sumber utama untuk memahami arsitektur, kondisi, dan cara kerja LMS.
Dokumen kontrak teknis yang mengikat ada di [`docs/LMS_INTEGRATION_CONTRACT.md`](docs/LMS_INTEGRATION_CONTRACT.md).
Daftar modul ada di [`docs/MODULE_REGISTRY.md`](docs/MODULE_REGISTRY.md).
Rencana pengembangan ada di [`docs/ROADMAP.md`](docs/ROADMAP.md).
Panduan UI ada di [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md).

---

## 1. Ringkasan

LMS MTK adalah aplikasi web statis untuk SMP (fokus Matematika kelas 8) yang berjalan di
GitHub Pages dan memakai **Supabase** sebagai backend tunggal (Auth, PostgreSQL, RLS, RPC).

- **Produksi:** `https://wendirosandi.github.io/mtk/`
- **Repository:** `https://github.com/wendirosandi/mtk`
- **Supabase project ref:** `wotszlppzfvlsvrqxbgh` (region `ap-southeast-1`)
- **Tanpa build step:** HTML + JavaScript vanilla, library dari CDN.
- **Satu origin:** LMS, LKPD, ToolsMathPro, dan Kalender berada di origin yang sama.

---

## 2. Arsitektur

```
Browser (static SPA)
  index.html
    lib/config.js          → identitas aplikasi + fallback legacy
    src/lib/supabase.js    → klien Supabase + LMS.signIn/profileMeta
    src/lib/transport.js   → adapter aksi UI → Supabase (RPC/query)
    lib/router.js          → hash router + guard role
    lib/portal-api.js      → sesi, cache meta, toast, loader
    pages/*.js             → route + render + init

Supabase
  Auth (GoTrue)            → email sintetis username@<school>.<role>.lms
  PostgreSQL               → skema public (lihat §4)
  RLS                      → otorisasi sebenarnya
  RPC (security definer)   → operasi sensitif: attempt, scoring, activity, akun
```

**Prinsip:**

1. Frontend tidak dipercaya untuk otorisasi maupun skor.
2. Semua data inti di Supabase; tidak ada Google Sheets/GAS untuk fitur baru.
3. Modul eksternal tidak punya login sendiri; membaca sesi Supabase.
4. Tidak ada token di URL.

---

## 3. Peran & Autentikasi

| Peran | Prefix route | Akses |
|---|---|---|
| `siswa` | `siswa-*` | Mapel/materi, LKPD, nilai, aktivitas, profil |
| `guru` | `guru-*` | Kelas diampu, kurikulum, asesmen, bank soal, nilai, monitoring |
| `admin` | `admin-*` | Seluruh sekolah, pengguna, akademik, pengaturan, audit |

- Login memakai **username + password**. Email Supabase dibentuk oleh
  `LMS.loginId(username, role)` menjadi `username@<school-code>.<role>.lms`.
- `school-code` aktif saat ini: `PLACEHOLDER-SCHOOL` (lihat `lib/config.js`).
- Role diverifikasi ulang dari tabel `profiles` setelah login; role pada klaim JWT tidak dipercaya.
- Sesi disimpan Supabase di `localStorage` (persistSession). Modul di origin yang sama
  otomatis berbagi sesi.
- Guard UI hanya kenyamanan; keputusan akhir tetap RLS/RPC.

**Uji akun (staging):**

| Peran | Username | Catatan |
|---|---|---|
| siswa | `8-f-syakirah` | password uji diketahui tim |
| guru | `guru1` | **password belum tersedia** |
| guru uji | `guru.uji` | akun uji Fase 2, penugasan MTK 8.F (password dipegang tim) |
| admin | — | **belum ada akun uji** |

---

## 4. Skema Database (ringkas)

30 tabel di schema `public`:

- **Identitas & sekolah:** `schools`, `profiles`, `academic_years`, `grade_levels`,
  `classes`, `class_memberships`, `subjects`, `teacher_assignments`
- **Kurikulum:** `modules`, `topics`, `materials`
- **Asesmen:** `assessments`, `question_items`, `attempts`, `attempt_answers`,
  `gradebook_entries`, `performance_ratings`
- **Bank soal:** `question_pools`, `generator_templates`, `bank_items`,
  `kisi_kisi`, `attempt_items`
- **Kolaborasi & akses:** `collab_pairs`, `access_grants`
- **Aktivitas & komunikasi:** `activity_logs`, `notifications`, `notification_reads`,
  `audit_logs`
- **Operasional:** `account_requests`, `legacy_crosswalk`

Hierarki kurikulum:

```
subjects → modules → topics → materials
                            → assessments → question_items
                                          → attempts → attempt_answers
                                          → gradebook_entries
```

Nilai enum penting:

- `assessments.kind`: `lkpd | kuis | tugas | projek`
- `assessments.status`: `draft | active | exambro | inactive | locked | archived | deleted`
- `materials.kind`: `dokumen | video | app | geogebra | pdf | lkpd_ref`
- `gradebook_entries.source`: `auto | manual | legacy_pending | impor`
- `activity_logs.kind`: `section | submit`

---

## 5. Katalog RPC

| RPC | Fungsi |
|---|---|
| `app_get_subjects()` | mapel sesuai role |
| `app_get_modules(subject)` | modul per mapel/tingkat |
| `app_get_materials(module)` | materi + asesmen per topik |
| `app_get_assessments(topic)` | asesmen per topik |
| `app_access_check(code)` | gerbang status, kolaborasi, prasyarat, akses khusus |
| `app_start_attempt(code, partner, source)` | buat attempt |
| `app_save_answers(attempt, answers)` | simpan jawaban mentah |
| `app_score_attempt(attempt)` | penilaian server-side + gradebook |
| `app_submit_legacy(code, payload)` | simpan rekap LKPD lama |
| `app_ingest_activity(app, section, kind, duration, score)` | catat aktivitas |
| `app_get_student_progress()` | progres siswa |
| `app_get_student_gradebook()` | nilai siswa |
| `app_get_student_activity(limit)` | log aktivitas siswa |
| `app_build_package(assessment)` | susun paket dari bank soal |
| `app_get_package_items(assessment)` | baca paket tanpa kunci |
| `app_get_attempt_items(attempt)` | item snapshot per attempt |
| `app_request_account_change(kind, value, reason)` | permintaan ubah akun |
| `app_verify_legacy_password(user, pass)` | verifikasi hash lama (migrasi) |
| helper RLS | `app_profile`, `app_role`, `app_school`, `app_is_admin`, `app_is_guru`, `app_can_see_class`, `app_my_class_ids`, `app_teacher_class_ids`, `app_guru_scope_assessment` |

Aturan aktivitas (server): `section` minimal 30 detik, maksimal 150 detik, maksimal 3 log
per hari per (app, section). `submit` tidak dibatasi cap.

---

## 6. Alur Asesmen

```
app_access_check
  → app_start_attempt
  → app_save_answers (boleh berulang)
  → app_score_attempt (server menilai + menulis gradebook)
  → app_ingest_activity (section & submit)
```

- Kuis dapat dikunci oleh `prerequisite_assessment_id`.
- `collab_mode` wajib/opsional menentukan kebutuhan pasangan di `collab_pairs`.
- Siswa tidak boleh membaca `question_items` (kunci jawaban).

---

## 7. Integrasi Modul Eksternal

Modul seperti **ToolsMathPro** dan **Kalender Pythagoras**:

1. Berada di origin yang sama: `/mtk/toolsmathpro/`, `/mtk/kalender-pythagoras/`.
2. Wajib memuat `src/lib/supabase.js` dan memeriksa sesi.
3. Tanpa sesi → arahkan ke `index.html?next=<path-relatif>`; setelah login kembali ke modul.
4. Terdaftar di `materials` dengan `kind='app'` dan `url` modul.
5. Aktivitas dicatat via `app_ingest_activity` dengan kode unik:
   - `TOOLS-MATH`
   - `KALENDER-PYT`
6. Tidak membuat tabel pengguna atau login sendiri.
7. Tidak menaruh token di URL.

Status integrasi saat ini: **kode sudah dipasang** (gate sesi, profil, aktivitas,
`next=`), tetapi materi belum terdaftar di cloud (`0012` draft) dan belum diuji
dengan sesi nyata end-to-end. Lihat `docs/MODULE_REGISTRY.md`.

---

## 8. Konfigurasi

| Lokasi | Isi | Catatan |
|---|---|---|
| `src/lib/supabase.js` | URL + anon key + `SCHOOL_CODE` | anon key memang publik; jangan pernah service_role |
| `lib/config.js` | identitas aplikasi, `SEKOLAH_KODE`, fallback legacy | `GS_URL` hanya kompatibilitas |
| `supabase/config.toml` | konfigurasi CLI, auth redirect | `site_url` masih root, perlu `/mtk` |
| `supabase/migrations/` | sumber kebenaran skema | jangan edit migrasi yang sudah applied tanpa migrasi korektif |

**Rahasia:** API key AI, service_role, dan DB password **tidak boleh** masuk repo.
Gunakan Supabase Secrets / environment CI.

---

## 9. Menjalankan Lokal

Prasyarat: Docker, Supabase CLI, Node.js (untuk harness generator).

```powershell
supabase start
supabase db reset          # memerlukan migrasi yang reproducible
# jalankan fixtures untuk akun uji
psql <connection-string> -f tests/rls/fixtures.sql

python -m http.server 8788 --bind 127.0.0.1
# buka http://127.0.0.1:8788/index.html
```

Catatan: `supabase db reset` **belum bisa diandalkan** sampai migrasi `0002` dan seed
`0001` diperbaiki (lihat §11).

---

## 10. Pengujian

| Jenis | Lokasi | Status |
|---|---|---|
| Generator golden test | `tests/generators/harness.mjs` | manual; golden belum di-commit |
| Skenario RLS | `tests/rls/rls_scenarios.sql` | manual, belum otomatis |
| Smoke test UI | `uji/*.html` | manual |
| E2E | — | belum ada |

Uji minimum sebelum rilis: login tiap role, akses mapel, buka LKPD, submit, nilai,
aktivitas, dan uji negatif RLS.

---

## 11. Masalah yang Diketahui

1. `0002_rls.sql` pernah rusak sintaks (policy `ad_ins` disisipkan di tengah `ad_sel`).
   Sudah diperbaiki di file dan lolos `db reset` lokal, **belum diterapkan ke cloud**.
2. Tidak ada unique index `(assessment_id, profile_id)` pada gradebook → risiko nilai ganda.
   Perbaikan ada di draft `0011` (dedupe + index + upsert scoring).
3. `prof_upd_self` mengizinkan siswa mengubah `settings`, `username`, dan `status` sendiri.
   Draft `0011` menambahkan trigger proteksi + policy update admin.
4. Seed `0001` memakai `date '{{TA_START}}'` yang tidak valid untuk instalasi baru.
   Sudah diganti tanggal konkret.
5. `config.toml` `site_url` belum menunjuk `/mtk`. Sudah diperbaiki di file.
6. Data user dimasukkan ke `innerHTML` tanpa escaping.
7. ToolsMathPro masih meminta identitas manual dan belum mencatat aktivitas ke Supabase.
8. Belum ada halaman Admin; dashboard Guru baru 2 halaman.
9. `docs/MODULE_REGISTRY.md` sebelumnya tidak ada (kini tersedia).
10. Belum ada CI dan akun uji guru/admin.
11. Policy `gb_ins/gb_upd` belum memeriksa `app_guru_scope_assessment(assessment_id)` — guru
    dapat menulis nilai manual untuk asesmen di luar mapelnya lewat API langsung.
12. Policy tulis `topics`/`materials` hanya memeriksa role guru, belum memeriksa sekolah/modul.
13. Policy tulis `question_items`/`assessments` juga belum memeriksa kepemilikan mapel guru;
    builder membatasi di UI, tetapi backend belum menegakkannya.

Draft `0011_integrity_fixes.sql` sudah **lolos `supabase db reset` + fixtures + `db lint` lokal**,
tetapi **belum diterapkan ke database cloud** dan menunggu persetujuan.

---

## 12. Konvensi Kontribusi

- Tanpa bundler; JavaScript harus jalan langsung di browser.
- Nama route: `admin-*`, `guru-*`, `siswa-*`; `init_` memakai underscore.
- Semua data dari database di-escape sebelum masuk `innerHTML`.
- Gunakan komponen bersama (`docs/UI_GUIDE.md`), bukan style baru per halaman.
- Perubahan skema = migrasi baru; jangan mengedit migrasi yang sudah applied.
- Fitur baru wajib: RLS, aktivitas, dan update `MODULE_REGISTRY`.
- Jangan commit kredensial atau artefak `supabase/.temp/`.
