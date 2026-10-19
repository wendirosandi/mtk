# LMS INTEGRATION CONTRACT
## Standar Teknis Wajib untuk Semua Modul, Materi, dan Asesmen

Dokumen ini adalah **kontrak teknis** yang WAJIB diikuti oleh siapa pun (guru, developer, atau AI) yang membangun modul, materi, LKPD, kuis, atau fitur baru di dalam ekosistem LMS ini. Tujuannya: semua komponen terintegrasi konsisten, aman, dan tidak saling merusak.

---

## 1. Prinsip Inti (Tidak Bisa Ditawar)

1. **Satu sumber kebenaran:** Semua data inti (user, kelas, nilai, aktivitas) hidup di **Supabase PostgreSQL**. Tidak ada modul yang boleh menyimpan data inti di localStorage, Google Sheets, atau server sendiri.
2. **Autentikasi terpusat:** Semua modul memakai **Supabase Auth** via `src/lib/supabase.js`. DILARANG membuat sistem login sendiri.
3. **Keamanan via RLS:** Setiap tabel WAJIB punya Row Level Security. Frontend TIDAK PERNAH dipercaya untuk otorisasi; RLS yang memutuskan.
4. **Penilaian server-side:** Skor WAJIB dihitung di server (RPC `app_score_attempt`). Browser hanya mengirim jawaban mentah. DILARANG menghitung skor final di frontend lalu mengirimnya sebagai nilai.
5. **Aktivitas tercatat:** Semua interaksi belajar WAJIB dicatat via RPC `app_ingest_activity` dengan aturan validasi yang sudah ada.
6. **Tidak ada GAS:** DILARANG menambahkan ketergantungan baru ke Google Apps Script. Semua komunikasi via Supabase.

---

## 2. Arsitektur & Komponen

| Komponen | Lokasi | Tanggung Jawab |
|---|---|---|
| Frontend inti | `index.html`, `src/lib/*`, `uji/*` | Auth, navigasi, dashboard |
| Adapter Supabase | `src/lib/supabase.js`, `src/lib/transport.js` | Klien DB, helper login |
| Halaman LKPD | `LKPD/MTKxxxx.html` | UI pengerjaan per asesmen |
| Modul pendukung | `kalender-pythagoras/`, `toolsmathpro/`, dll | Konten interaktif (materi jenis app) |
| Database | Supabase PostgreSQL | Semua data inti |
| Migration | `supabase/migrations/000x_*.sql` | Evolusi skema (version-controlled) |

---

## 3. Skema Inti (Ringkas)

Hierarki pembelajaran:
```
schools → academic_years → classes → class_memberships (siswa)
                                   → teacher_assignments (guru)
subjects → modules → topics → materials (konten)
                            → assessments (LKPD/Kuis/Tugas/Projek)
                                   → question_items (bank soal)
                                   → attempts → attempt_answers
                                   → gradebook_entries (nilai)
activity_logs (semua aktivitas)
```

Kolom kunci `assessments`:
- `kind`: `'lkpd' | 'kuis' | 'tugas' | 'projek'`
- `topic_id`: materi tempat asesmen menempel
- `status`: `'draft' | 'active' | 'exambro' | 'inactive' | 'locked' | 'archived' | 'deleted'`
- `collab_mode`: `'none' | 'optional' | 'optional_fixed' | 'required' | 'required_fixed'`
- `prerequisite_assessment_id`: (SPESIFIKASI) FK ke asesmen yang harus selesai dulu (mis. Kuis → LKPD).

---

## 4. Kontrak Autentikasi & Identitas

- Login via `window.LMS.supabase.auth.signInWithPassword({ email, password })`.
- Email sintetis: `username@<school-code>.<role>.lms` (dibangun oleh `window.LMS.loginId(username, role)`).
- Profil dibaca dari tabel `profiles` (bukan dari JWT claim).
- Role: `'admin' | 'guru' | 'siswa'`. Semua query frontend WAJIB menghormati role via helper RLS.

---

## 5. Kontrak Navigasi (RPC yang Tersedia)

| RPC | Input | Output | Dipakai untuk |
|---|---|---|---|
| `app_get_subjects()` | – | daftar mapel per role | Dashboard |
| `app_get_modules(subject_id)` | uuid | daftar modul | Halaman Modul |
| `app_get_materials(module_id)` | uuid | materi + asesmen per topik | Halaman Materi |
| `app_get_assessments(topic_id)` | uuid | daftar asesmen per topik | (opsional) |
| `app_get_student_progress()` | – | progress per asesmen | Dashboard/Progress |
| `app_get_student_gradebook()` | – | nilai siswa | Halaman Nilai |
| `app_get_student_activity(limit)` | int | log aktivitas | Halaman Aktivitas |

Semua RPC ini `security invoker` dan otomatis tunduk RLS. Frontend cukup memanggil; tidak perlu filter manual.

---

## 6. Kontrak Asesmen & Alur Pengerjaan

### Jenis asesmen dan urutan tampil di UI Materi
Dalam satu `topic`, UI WAJIB menampilkan dengan urutan:
1. **Materi** (video/pdf/app/geogebra) — untuk belajar.
2. **LKPD** (`kind='lkpd'`) — eksplorasi terpandu.
3. **Kuis** (`kind='kuis'`) — asesmen, **terkunci** sampai LKPD prasyarat selesai.
4. Tugas/Projek (bila ada).

### Alur pengerjaan WAJIB (urutan RPC)
```
1. app_access_check(code)        → gerbang: status, kolaborasi, prasyarat, akses khusus
2. app_start_attempt(code, ...)  → buat attempts (status in_progress)
3. app_save_answers(attempt, {}) → simpan jawaban (bisa berulang selama in_progress)
4. app_score_attempt(attempt)    → nilai server-side, isi gradebook, status graded
5. app_ingest_activity(...)      → catat aktivitas section & submit
```

### Aturan Kolaborasi
- `collab_mode='required'` → siswa WAJIB punya pasangan approved sebelum `app_start_attempt` sukses.
- Pasangan disimpan di `collab_pairs`. Guru menyetujui/menolak.
- Nilai kolaborasi diduplikasi ke kedua anggota (ditangani server saat scoring, bila diimplementasikan).

### Aturan Prasyarat (SPESIFIKASI — migration 0005)
- Kuis dengan `prerequisite_assessment_id`指向 LKPD hanya bisa dibuka jika siswa punya `attempts` berstatus `submitted/graded` untuk LKPD tersebut.
- `app_access_check` mengembalikan `ok=false, alasan='prasyarat'` bila belum terpenuhi.
- UI WAJIB menampilkan ikon 🔒 dan pesan "Selesaikan LKPD terlebih dahulu" pada Kuis yang terkunci.

---

## 7. Kontrak Aktivitas (`app_ingest_activity`)

Signature: `app_ingest_activity(p_app, p_section, p_kind, p_duration, p_score)`
- `p_app`: kode modul/asesmen (mis. `'MTK-8202'`, `'TOOLS-MATH'`, `'KALENDER-PYT'`).
- `p_section`: bagian (mis. `'LKPD'`, `'KUIS'`, `'MATERI'`, `'VIDEO'`, `'APP'`).
- `p_kind`: `'section'` (membuka/mengerjakan) atau `'submit'` (menyelesaikan).
- `p_duration`: detik (integer ≥ 0).
- Aturan server (sudah aktif):
  - `kind='section'`: durasi < `min_sec` (30) ditolak; durasi > `max_sec` (150) dipotong; maks `max_per_day` (3) per (app, section, hari).
  - `kind='submit'`: tidak dibatasi cap harian (boleh berulang untuk riwayat).
- **Anti-spam:** Frontend WAJIB menghindari pencatatan ganda akibat re-render. Gunakan flag per sesi halaman (mis. variabel `loggedSection`) agar satu kunjungan hanya mencatat satu `section`.
- **Beda "dibuka" vs "selesai":** gunakan `kind='section'` saat membuka/mempelajari, `kind='submit'` saat benar-benar menyelesaikan/mengirim.

---

## 8. Kontrak Gradebook

- Nilai HANYA ditulis oleh server (RPC scoring) atau oleh guru via policy `gb_ins/gb_upd` (manual).
- Frontend siswa HANYA membaca (`gb_sel` untuk diri sendiri).
- `source`: `'auto'` (server), `'manual'` (guru), `'legacy_pending'` (menunggu scorer lama), `'impor'` (migrasi).
- Satu baris per (assessment, profile) untuk `entry_kind='assessment'` (dijaga unique index).

---

## 9. Kontrak Modul Eksternal (Materi jenis app)

Modul seperti `kalender-pythagoras/`, `toolsmathpro/`, atau modul mapel lain yang dibangun terpisah WAJIB:
1. **Tidak punya login sendiri.** Baca sesi dari `window.LMS.supabase` (load `src/lib/supabase.js`).
2. **Terdaftar di `materials`** dengan `kind='app'` (atau `'geogebra'`) dan `url` menunjuk ke halaman modul.
3. **Mencatat aktivitas** via `app_ingest_activity` dengan `p_app` = kode modul unik.
4. **Tidak menulis gradebook langsung.** Bila modul punya penilaian sendiri, kirim via RPC scoring atau serahkan ke guru untuk input manual.
5. **Mengikuti RLS.** Tidak boleh query tabel inti selain via RPC/helper yang sudah ada.

### Cara mendaftarkan modul baru
```sql
insert into public.materials (topic_id, kind, title, url, sort_order)
values (<topic_id>, 'app', 'Nama Modul', '/kalender-pythagoras/index.html', <n>);
```

---

## 10. Kontrak Keamanan (Checklist Wajib)

- [ ] Tidak ada secret / service_role key di frontend atau repo.
- [ ] Semua tabel baru punya RLS + policy sesuai role.
- [ ] Tidak ada query frontend yang bypass RLS (kecuali RPC `security definer` yang memang dirancang).
- [ ] Skor tidak pernah dipercaya dari klien.
- [ ] Input divalidasi di server (RPC) sebelum ditulis.
- [ ] Tidak ada `drop table` / `truncate` di migration tanpa backup & persetujuan.

---

## 11. Checklist Integrasi Modul Baru (untuk developer/AI)

1. Baca `DOKUMENTASI.md` dan file ini.
2. Tentukan `subject`, `grade_level`, `module`, `topic` tujuan (jangan buat duplikat).
3. Daftarkan konten di `materials` (atau asesmen di `assessments` + `question_items`).
4. Bila asesmen: ikuti alur RPC §6 dan format `question_items.kind` (`num|mc|bs|match|scaffold|text`).
5. Bila modul interaktif: ikuti §9.
6. Tambahkan pencatatan aktivitas (§7).
7. Uji RLS sebagai siswa & guru.
8. Update `docs/MODULE_REGISTRY.md`.

---

## 12. Referensi

- `DOKUMENTASI.md` — arsitektur & kondisi LMS.
- `docs/MODULE_REGISTRY.md` — daftar modul & status integrasi.
- `supabase/migrations/` — evolusi skema.