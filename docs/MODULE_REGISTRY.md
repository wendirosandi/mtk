# MODULE REGISTRY

Daftar seluruh modul/aplikasi dalam ekosistem LMS MTK, status integrasi, dan kontraknya.
Wajib diperbarui setiap kali modul baru ditambahkan atau status integrasinya berubah.

Legenda status:

- **Integrated** — memakai Supabase Auth, terdaftar di `materials`, mencatat aktivitas.
- **Partial** — sudah di LMS tetapi belum lengkap kontraknya.
- **Standalone** — berjalan sendiri, belum terhubung LMS.
- **Legacy** — masih bergantung Google Apps Script.
- **Archive** — tidak dipakai untuk pembelajaran.

---

## 1. Daftar Modul

| Kode / App Code | Nama | Path | Jenis materi | Auth | Aktivitas | Status |
|---|---|---|---|---|---|---|
| `LMS-CORE` | LMS Shell (login, dashboard, nilai, profil) | `/index.html` | — | Supabase | — | **Integrated** |
| `MTK-8202` | LKPD Teorema Pythagoras | `/LKPD/MTK8202.html` | `lkpd` (asesmen) | Supabase | via RPC asesmen | **Integrated** |
| `MTK-8102` | LKPD lama MTK-001 | `/LKPD/MTK001.html` | `lkpd` (asesmen) | GAS | GAS | **Legacy** |
| `MTK-8103` | LKPD lama MTK-002 | `/LKPD/MTK002.html` | `lkpd` (asesmen) | GAS | GAS | **Legacy** |
| `MTK-8104` | LKPD lama MTK-003 | `/LKPD/MTK003.html` | `lkpd` (asesmen) | GAS | GAS | **Legacy** |
| `MTK-8203` | LKPD lama MTK-005 | `/LKPD/MTK005.html` | `lkpd` (asesmen) | GAS | GAS | **Legacy** |
| `MTK-8204` | LKPD lama MTK-8204 | `/LKPD/MTK8204.html` | `lkpd` (asesmen) | GAS | GAS | **Legacy** |
| `TOOLS-MATH` | ToolsMathPro (7 section interaktif) | `toolsmathpro/index.html` | `app` | Supabase | `open/use` | **Integrated** |
| `KALENDER-PYT` | Kalender Pythagoras 2027 | `kalender-pythagoras/index.html` | `app` | Supabase | `open/use` | **Integrated** |
| `BANK-SOAL` | Alat guru bank soal & kisi-kisi | `/LKPD/page/Bank_soal.html` | `app` (internal) | belum | — | **Standalone** |
| `RASIONAL-POLA` | Aplikasi rasionalisasi pecahan | `/LKPD/page/aplikasi_rasionalisasi_pecahan-POLA.html` | `app` (internal) | belum | — | **Standalone** |
| `MTK005-PRINT` | Versi cetak MTK-005 | `/LKPD/page/MTK005_print.html` | `pdf`/print | — | — | **Standalone** |
| `AQIQAH` | Manajemen undangan (non-mapel) | `/Aqiqah.html` | — | — | — | **Archive** |
| `PYT-MESIR` | LKPD simulasi Pythagoras lama | `/teorema_pythagoras.html` | `lkpd_ref` | — | — | **Archive** |

---

## 2. Kontrak Integrasi Modul Eksternal

Setiap modul baru wajib memenuhi 8 poin berikut:

1. **Satu origin** — berada di bawah `/mtk/` agar sesi Supabase dapat dibaca.
2. **Tanpa login sendiri** — muat `src/lib/supabase.js`, gunakan `LMS.supabase`.
3. **Gate sesi** — jika tidak ada sesi, redirect ke `index.html?next=<path-relatif>`.
4. **Verifikasi profil** — role dan hak akses diperiksa dari `profiles`/RLS.
5. **Terdaftar di `materials`** — `kind='app'`, `url` menunjuk halaman modul.
6. **Aktivitas** — `app_ingest_activity` dengan `p_app` = kode modul.
7. **Tanpa token di URL** — jangan pernah mengirim access token lewat query.
8. **Tidak menulis tabel inti langsung** — gunakan RPC yang tersedia.

### Aktivitas yang dibedakan

| Event | Kapan | `p_kind` (v1) | `p_event` (v2) |
|---|---|---|---|
| Membuka aplikasi | setelah sesi valid + 30 detik | `section` | `open` |
| Menggunakan fitur | saat fitur dibuka/dipakai | `section` | `use` |
| Menyelesaikan aktivitas | saat selesai/ekspor/submit | `submit` | `complete` |

Catatan: `p_event` tersedia via migrasi `0011` yang sudah diterapkan.

---

## 3. Registrasi Materi (sudah diterapkan via `0012`)

Kedua modul akan didaftarkan pada topik **“Konsep Dasar & Tripel Pythagoras”**
(modul “Teorema Pythagoras”, mapel MTK, tingkat 8):

```sql
-- Contoh idempoten; jalankan hanya setelah disetujui
insert into public.materials (topic_id, kind, title, url, sort_order)
select t.id, 'app', 'ToolsMathPro', 'toolsmathpro/index.html', 10
from public.topics t
join public.modules m on m.id = t.module_id
join public.subjects s on s.id = m.subject_id
where s.code = 'MTK' and m.title = 'Teorema Pythagoras'
  and t.title = 'Konsep Dasar & Tripel Pythagoras'
  and not exists (
    select 1 from public.materials x
    where x.topic_id = t.id and x.url = 'toolsmathpro/index.html'
  );

insert into public.materials (topic_id, kind, title, url, sort_order)
select t.id, 'app', 'Kalender Pythagoras 2027', 'kalender-pythagoras/index.html', 11
from public.topics t
join public.modules m on m.id = t.module_id
join public.subjects s on s.id = m.subject_id
where s.code = 'MTK' and m.title = 'Teorema Pythagoras'
  and t.title = 'Konsep Dasar & Tripel Pythagoras'
  and not exists (
    select 1 from public.materials x
    where x.topic_id = t.id and x.url = 'kalender-pythagoras/index.html'
  );
```

Status integrasi: **Integrated** — materi terdaftar via `0012`, sesi Supabase,
aktivitas `open/use` aktif, dan input identitas manual disembunyikan (diisi profil).

---

## 4. Catatan per Modul

### ToolsMathPro
- 7 section: perkalian, pangkat, akar, bentuk akar, notasi baku, dll.
- Menyimpan tema dan log aktivitas di `localStorage`.
- Input nama/kelas sudah diisi otomatis dari profil dan disembunyikan.
- Rencana lanjutan: sinkronisasi log lokal ke Supabase (saat ini keduanya berjalan).

### Kalender Pythagoras
- 12 halaman pembuktian + halaman GeoGebra + ekspor PDF.
- Progres proyek disimpan di `localStorage` (`project-checklist.js`).
- Rencana: gate sesi, tombol kembali ke LMS, log aktivitas buka/PDF.

### Bank Soal (alat guru)
- Berjalan mandiri, data dari `DATA_POOL`/`BANK_SHEET`.
- Rencana jangka menengah: pindahkan ke halaman `guru-bank` berbasis tabel Supabase.

### LKPD Legacy
- Masih memanggil 3 endpoint Apps Script berbeda.
- Tidak boleh ditambah fitur baru; migrasikan ke Supabase sebelum dipakai luas.
- Skor legacy disimpan mentah via `app_submit_legacy`, bukan dipercaya dari klien.

---

## 5. Checklist Saat Menambah Modul

- [ ] Tentukan `subject`, `grade_level`, `module`, `topic`.
- [ ] Daftarkan `materials` dengan `kind` yang tepat.
- [ ] Muat `src/lib/supabase.js` + gate sesi.
- [ ] Gunakan `app_ingest_activity`.
- [ ] Uji sebagai siswa dan guru (RLS).
- [ ] Tambahkan baris di dokumen ini.
- [ ] Perbarui `docs/ROADMAP.md` bila mengubah prioritas.
