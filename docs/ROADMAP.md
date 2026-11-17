# ROADMAP LMS MTK

Rencana pengembangan bertahap. Setiap fase harus selesai dan diuji sebelum fase berikutnya.
Estimasi bersifat indikatif untuk satu pengembang + AI agent.

---

## Prinsip Urutan

1. **Stabilkan fondasi** — database reproducible, RLS benar, tidak ada kebocoran data.
2. **Selesaikan pengalaman Siswa** — dari login sampai menyelesaikan materi/LKPD.
3. **Berdayakan Guru** — kelola kurikulum, asesmen, nilai, monitoring.
4. **Lengkapi Admin** — operasional sekolah dan pengguna.
5. **Otomasi & AI** — setelah alur manual stabil.

Jangan membangun UI untuk fitur yang backend/RLS-nya belum benar.

---

## Fase 0 — Fondasi & Dokumentasi

**Tujuan:** repo dapat dijalankan ulang, aturan jelas, tidak ada utang kritis.

- [x] Audit fitur & peta halaman
- [x] `DOKUMENTASI.md`
- [x] `docs/MODULE_REGISTRY.md`
- [x] `docs/ROADMAP.md`
- [x] `docs/UI_GUIDE.md`
- [x] Perbaikan sintaks `0002_rls.sql` (file)
- [x] Perbaikan seed tanggal `0001_init.sql` (file)
- [x] Draft `0011_integrity_fixes.sql` (belum diterapkan)
- [x] Validasi lokal: `supabase db reset` + fixtures + `db lint` bersih
- [ ] Review & persetujuan migrasi 0011
- [ ] Terapkan 0011 ke cloud (sesi terpisah)
- [ ] `package.json` + skrip tes + seed akun uji
- [ ] CI: SQL lint + generator harness

**Kriteria selesai:** `supabase db reset` berhasil dari nol, fixtures jalan, tidak ada
policy rusak, dokumen sinkron.

---

## Fase 1 — Pengalaman Siswa & Integrasi Modul

**Tujuan:** siswa dapat belajar utuh dari satu LMS.

### Halaman
| Route | Isi |
|---|---|
| `siswa-mapel` | daftar mapel → modul → topik |
| `siswa-materi` | daftar materi + asesmen per topik, urut sesuai kontrak |
| `siswa-materi-view` | viewer materi (PDF/video/GeoGebra) + peluncur `app` |
| `siswa-kolab` | status/permintaan pasangan |

### Pekerjaan teknis
- [x] App shell + bottom nav + breadcrumb
- [x] Komponen bersama (`esc`, `Card`, `EmptyState`, `Badge`, `Skeleton`)
- [x] Halaman mapel/materi memakai RPC `app_get_*` (diuji dengan data stub)
- [ ] Prasyarat kuis ditampilkan (🔒 + pesan)
- [x] Integrasi ToolsMathPro: sesi, profil, aktivitas (kode; uji sesi nyata pending)
- [x] Integrasi Kalender: sesi, aktivitas, tombol kembali (kode; uji sesi nyata pending)
- [x] Registrasi `materials` untuk kedua modul (draft `0012`)
- [x] `next=` pada login + validasi same-origin (diuji)
- [x] Hapus input identitas manual ToolsMathPro (readonly + prefill)
- [ ] Perbaiki escaping HTML di halaman siswa lama (halaman baru sudah aman)

**Kriteria selesai:** siswa login → pilih mapel → buka materi → buka Tools/Kalender →
kembali → aktivitas tercatat; tanpa sesi selalu kembali ke login dengan `next` benar.

---

## Fase 2 — Guru MVP

### Halaman
| Route | Isi |
|---|---|
| `guru-dash` | statistik kelas, antrean penilaian, permintaan akun |
| `guru-kelas` | mapel/kelas yang diampu |
| `guru-kurikulum` | CRUD modul, topik, materi |
| `guru-asesmen` | daftar LKPD/kuis/tugas |
| `guru-asesmen-edit` | builder soal, prasyarat, kolaborasi |
| `guru-monitor` | attempt berjalan, flag, durasi |
| `guru-nilai` | matriks nilai, input manual, ekspor CSV |
| `guru-kolab` | approve/reject pasangan |
| `guru-permintaan` | approve/reject akun |
| `guru-bank` (MVP) | pool, bank soal, kisi-kisi |

### Pekerjaan teknis
- [x] CRUD kurikulum (modul/topik/materi) — `guru-kurikulum`, diuji buat/edit/hapus
- [x] Gradebook unik + input manual dengan audit (matriks `guru-rekap`)
- [x] Monitoring attempt (tanpa membocorkan kunci) — `guru-monitor`
- [x] Builder asesmen memakai `question_items` — `guru-asesmen` + `guru-asesmen-edit`
      (numerik, PG/BS, menjodohkan, bertahap, uraian; publish/arsip; prasyarat)
- [x] Role guru diuji dengan akun nyata (`guru.uji`)
- [x] Uji negatif: guru tidak bisa kelas di luar scope (RLS 8.F/8.G di lokal)
- [x] Dashboard guru + daftar kelas yang diampu (`guru-kelas`)
- [x] Kolaborasi siswa + approval guru (`siswa-kolab`, `guru-kolab`)
- [x] Kategori umum Walas + kategori per mapel Guru (`guru-walas`, `guru-kategori`, `0016`)

**Kriteria selesai:** guru dapat membuat satu modul + satu LKPD + satu kuis, siswa
mengerjakan, nilai masuk, guru melihat dan mengoreksi.

---

## Fase 3 — Admin MVP

| Route | Isi |
|---|---|
| `admin-dash` | statistik sekolah, antrean, kesehatan data | ✅ |
| `admin-sekolah` | profil sekolah, pengaturan aktivitas/semester | ✅ |
| `admin-pengguna` | daftar/filter pengguna + approval, buat akun, reset password | ✅ |
| `admin-akademik` | tahun pelajaran, kelas, mapel, penugasan guru | ✅ |
| `admin-mapel` | CRUD mata pelajaran | ✅ (di admin-akademik) |
| `admin-penugasan` | guru ↔ mapel ↔ kelas | ✅ (di admin-akademik) |
| `admin-monitoring` | aktivitas + audit log | ✅ |
| `admin-permintaan` | review permintaan akun | ✅ (di admin-pengguna) |
| `admin-pengaturan` | feature flags, registry modul, audit UI | ✅ (sebagian) |
| `admin-import` | import CSV sekolah, akun, akademik, konten, nilai | ✅ (lokal) |

**Catatan arsitektur:** pembuatan akun Auth memakai Edge Function
`supabase/functions/admin-users` (service role hanya di backend) + verifikasi role admin.

**Kriteria selesai:** admin dapat menyiapkan tahun ajaran, kelas, guru, siswa, dan
penugasan tanpa SQL manual.

---

## Fase 3.5 — Import Data Sekolah

- [x] Audit database/Admin dan rancangan import
- [x] Template CSV + alur validasi (`docs/CSV_IMPORT_TEMPLATE.md`)
- [x] Rancangan akun & kredensial (`docs/ACCOUNT_PROVISIONING.md`)
- [x] Migrasi `0017` batch/row import
- [x] Edge Function `admin-import` + perluasan `admin-users`
- [x] Halaman `admin-import` (upload, mapping, dry-run, commit, riwayat)
- [x] Uji data fiktif lokal
- [x] Deploy migrasi `0017` + Edge Function ke cloud
- [x] Prosedur bootstrap sekolah nyata + admin pertama (`docs/BOOTSTRAP_SEKOLAH.md`)
- [ ] Import produksi setelah approval

**Kriteria selesai:** satu sekolah fiktif lengkap dapat diimpor ulang secara
idempotent, akun dapat login, dan laporan batch tersedia.

---

## Fase 4 — Bank Soal Lanjutan & AI Guru

- [x] Pool, bank soal, kisi-kisi, dan susun paket (UI `guru-bank`)
- [x] Wizard AI bank (UI `guru-ai` + Edge Function scaffold; butuh `AI_API_KEY`)
- [ ] Generator template & paket per-siswa (snapshot attempt)
- [ ] Wizard AI: modul/materi/LKPD/kuis
- [x] Migrasi `0015_ai_jobs` diterapkan
- [ ] Validasi JSON schema + moderasi
- [ ] Draft → review → publish
- [ ] `ai_jobs` + audit biaya/token
- [ ] API key hanya di Supabase Secrets

**Kriteria selesai:** guru menghasilkan draft, mengedit, menyetujui; tidak ada konten
AI yang terbit otomatis.

---

## Fase 5 — Kualitas Berkelanjutan

- [ ] Playwright smoke test (login, mapel, LKPD, nilai)
- [ ] RLS test otomatis di CI
- [ ] Audit aksesibilitas (WCAG AA)
- [ ] Lighthouse performance
- [ ] Backup & prosedur rollback migrasi

---

## Peta Navigasi Target

### Admin
Dashboard · Sekolah · Pengguna · Akademik · Mapel · Penugasan · Kurikulum ·
Monitoring · Permintaan · Pengaturan

### Guru
Dashboard · Kelas Saya · Kurikulum · Asesmen · Bank Soal · Kolaborasi ·
Monitoring · Nilai · Aktivitas · Permintaan · Profil

### Siswa
Beranda · Mapel · Nilai & Tugas · Aktivitas · Profil

Desktop: sidebar. Mobile: bottom nav 5 item + “Lainnya”.

---

## Keputusan yang Menunggu Persetujuan

1. Terapkan `0011_integrity_fixes.sql` ke cloud?
2. Batas aktivitas baru (`open/use/complete`) — ubah cap atau tetap 30/150/3?
3. Apakah Kalender wajib login untuk semua pengunjung, atau boleh mode publik?
4. Akun guru/admin uji: dibuatkan atau Anda yang menyiapkan?
5. Prioritas setelah Fase 1: Guru atau Admin lebih dulu?

---

## Definition of Done (semua fase)

- RLS diuji positif & negatif.
- Tidak ada data sensitif di frontend.
- Aktivitas tercatat dan tidak duplikat.
- UI responsif di 360 px dan 1280 px.
- Dokumentasi + Module Registry diperbarui.
- Diff ditinjau sebelum commit/push.
