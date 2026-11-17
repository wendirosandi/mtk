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
- [ ] App shell + bottom nav + breadcrumb
- [ ] Komponen bersama (`esc`, `Card`, `EmptyState`, `Badge`, `Skeleton`)
- [ ] Halaman mapel/materi memakai RPC `app_get_*`
- [ ] Prasyarat kuis ditampilkan (🔒 + pesan)
- [ ] Integrasi ToolsMathPro: sesi, profil, aktivitas
- [ ] Integrasi Kalender: sesi, aktivitas, tombol kembali
- [ ] Registrasi `materials` untuk kedua modul
- [ ] `next=` pada login + validasi same-origin
- [ ] Hapus input identitas manual ToolsMathPro
- [ ] Perbaiki escaping HTML di halaman siswa

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
- [ ] CRUD dengan validasi server (RPC/trigger)
- [ ] Gradebook unik + input manual dengan audit
- [ ] Monitoring attempt (tanpa membocorkan kunci)
- [ ] Builder asesmen memakai `question_items`
- [ ] Role guru diuji dengan akun nyata
- [ ] Uji negatif: guru tidak bisa kelas di luar scope

**Kriteria selesai:** guru dapat membuat satu modul + satu LKPD + satu kuis, siswa
mengerjakan, nilai masuk, guru melihat dan mengoreksi.

---

## Fase 3 — Admin MVP

| Route | Isi |
|---|---|
| `admin-dash` | statistik sekolah, antrean, kesehatan data |
| `admin-sekolah` | profil sekolah, pengaturan aktivitas/semester |
| `admin-pengguna` | daftar/filter/impor/reset pengguna |
| `admin-akademik` | tahun pelajaran, tingkat, kelas, membership |
| `admin-mapel` | CRUD mata pelajaran |
| `admin-penugasan` | guru ↔ mapel ↔ kelas |
| `admin-monitoring` | aktivitas + audit log |
| `admin-permintaan` | review permintaan akun |
| `admin-pengaturan` | feature flags, registry modul |

**Catatan arsitektur:** pembuatan akun Auth **tidak bisa** dari browser dengan anon key.
Perlu Edge Function `admin-users` dengan service role + verifikasi admin.

**Kriteria selesai:** admin dapat menyiapkan tahun ajaran, kelas, guru, siswa, dan
penugasan tanpa SQL manual.

---

## Fase 4 — Bank Soal Lanjutan & AI Guru

- [ ] Pool, kisi-kisi, generator template (UI)
- [ ] Paket beku + snapshot attempt
- [ ] Wizard AI: modul/materi/LKPD/kuis/bank
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
