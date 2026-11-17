# ADMIN DATA MANAGEMENT

**Status: rancangan halaman `admin-import`. Belum diimplementasikan.**

## 1. Kapabilitas Admin Saat Ini

| Halaman | Sudah ada | Belum ada |
|---|---|---|
| `admin-dash` | statistik, menu | — |
| `admin-pengguna` | daftar/filter, buat akun, reset, approval | bulk import, deaktivasi |
| `admin-sekolah` | profil, aktivitas, semester/TA | sekolah baru |
| `admin-akademik` | tahun, kelas, mapel, penugasan, walas | keanggotaan siswa, tingkat, bulk |
| `admin-monitoring` | aktivitas, audit | filter lanjutan |
| `admin-pengaturan` | feature flags, registry, AI health | import history |

Data akademik yang belum bisa diinput Admin lewat UI:
- keanggotaan siswa per kelas/tahun;
- tingkat (grade levels) — saat ini seed 7/8/9;
- kategori umum/mapel secara massal;
- modul/topik/materi, asesmen, soal, bank soal, nilai historis.

## 2. Halaman Baru: `admin-import`

Navigasi Admin: **Import Data** (icon upload).

### Wizard 6 langkah

1. **Pilih jenis data**
   - 16 template (lihat `CSV_IMPORT_TEMPLATE.md`).
   - Unduh template CSV (header + 1 baris contoh fiktif).
2. **Unggah CSV**
   - drag/drop, UTF-8, maks 2 MB / 2.000 baris.
   - parsing PapaParse; tampilkan jumlah baris.
3. **Mapping kolom**
   - auto-map header persis/alias; dropdown untuk koreksi.
   - kolom wajib bertanda; preview 5 baris.
4. **Validasi & Preview**
   - server `dry_run`; tampilkan tabel per baris:
     status (`valid/error/skip`), pesan, aksi (`insert/update/skip`).
   - ringkasan: total/valid/invalid/duplikat.
   - unduh error CSV.
5. **Konfirmasi**
   - ringkasan batch + peringatan; checkbox “saya sudah memeriksa”.
   - tombol **Import** aktif hanya jika tidak ada error fatal.
6. **Hasil**
   - jumlah berhasil/gagal/dilewati.
   - batch ID, tautan riwayat, unduh laporan.
   - untuk akun: daftar kredensial sementara **sekali** (tidak disimpan).

### Riwayat Import

Tabel `data_import_batches`:
- waktu, admin, jenis, file, status, jumlah, aksi (lihat detail/unduh error).
- RLS: admin sekolah sendiri.

## 3. Backend

### Edge Function `admin-import`

Aksi:
| Aksi | Fungsi |
|---|---|
| `validate` | parse rows, mapping, validasi referensi, simpan batch `validated` |
| `dry_run` | validasi + simulasi insert/update/skip, tanpa tulis |
| `commit` | konfirmasi batch, eksekusi |
| `history` | daftar batch |
| `batch` | detail baris + error |

Verifikasi:
- JWT valid;
- `profiles.role='admin'`;
- `school_id` dari profil;
- tolak cross-school.

### RPC SQL

- `app_import_commit(p_batch uuid)`:
  - `SECURITY DEFINER`; revoke dari anon/authenticated; hanya service role.
  - memproses `data_import_rows` secara terurut dalam satu transaksi.
  - upsert natural key; menulis `audit_logs`.
  - error → rollback seluruh batch.
- `app_import_validate` bisa di SQL untuk referensi kompleks; alternatif validasi
  di Edge Function dengan query service role.
- Akun tidak lewat RPC SQL (Auth Admin API); profile insert setelah Auth sukses.

### Tabel (draft 0017)

- `data_import_batches`
- `data_import_rows`
- index `(school_id, created_at)`, `(batch_id, row_no)`.
- RLS select admin; write hanya service role.
- Retensi: simpan minimal 1 tahun; hapus batch lama hanya dengan approval.

## 4. Aturan Mapping

- Alias umum:
  - `nama`/`nama_lengkap`/`full_name` → `full_name`
  - `tahun`/`tahun_pelajaran`/`year` → `tahun_label`
  - `kelas`/`class` → `kelas_label`
  - `mapel`/`mata_pelajaran`/`subject` → `mapel_kode`
  - `username`/`user` → `username`
- Kolom tidak dikenal → error mapping (bukan diabaikan diam-diam).
- Header wajib hilang → blokir sebelum upload.
- Mapping disimpan di batch untuk audit/reproducibility.

## 5. Kode Error Validasi (usulan)

| Kode | Arti |
|---|---|
| `REQUIRED` | kolom wajib kosong |
| `FORMAT` | format tanggal/angka/enum salah |
| `USERNAME` | pola/duplikat username |
| `SCHOOL_SCOPE` | referensi lintas sekolah |
| `REF_NOT_FOUND` | tahun/kelas/mapel/guru/siswa tidak ada |
| `DUPLICATE_FILE` | duplikat di file |
| `DUPLICATE_DB` | sudah ada; akan skip/update |
| `DEPENDENCY` | referensi belum diimpor |
| `ROLE` | role tidak diizinkan |
| `CATEGORY` | kategori bukan A/B/C |
| `SCORE_RANGE` | skor <0 atau >max |
| `FROZEN` | asesmen/soal terkunci |
| `NOT_AUTHORIZED` | admin bukan pemilik sekolah |

Pesan error harus menyebut nomor baris dan kolom.

## 6. Konfirmasi & Transaksi

- `dry_run` wajib; UI tidak boleh commit tanpa hasil validasi.
- Batch `validated` menyimpan hash file/rows agar konfirmasi tidak berubah.
- Commit ulang batch yang sama idempotent (status `committed`).
- Kegagalan akun: baris `failed`, batch `partial`; akun yang sudah dibuat
  dilaporkan; data akademik tidak ikut jika batch terpisah.
- Data akademik: rollback penuh pada error.

## 7. Hak Akses

| Aksi | Admin | Guru | Siswa |
|---|---|---|---|
| Unduh template | ✅ | ❌ | ❌ |
| Validasi/dry-run | ✅ sekolah sendiri | ❌ | ❌ |
| Commit | ✅ | ❌ | ❌ |
| Riwayat | ✅ sekolah sendiri | ❌ | ❌ |
| Melihat kredensial | ✅ sekali | ❌ | ❌ |

RLS dan Edge Function sama-sama memeriksa; UI bukan pengaman utama.

## 8. Kriteria Selesai (Tahap D)

- [ ] Semua 16 template dapat diunduh.
- [ ] Upload/preview/mapping/dry-run bekerja.
- [ ] Import 1 sekolah fiktif lengkap berhasil.
- [ ] Re-import idempotent (tanpa duplikat).
- [ ] Error per baris tampil + laporan.
- [ ] Batch history + audit.
- [ ] Akun baru login dan dipaksa ganti password.
- [ ] Kategori/nilai tidak saling menimpa.
- [ ] Cross-school ditolak.
- [ ] Tidak ada password di DB/log/repo.

## 9. Rencana File Implementasi (Tahap C)

```
pages/admin-import.js              wizard UI
src/lib/import-schema.js           header/template/alias/validasi client
src/lib/transport.js               aksi adminImport*
supabase/functions/admin-import/   Edge Function (validasi + orchestration)
supabase/functions/admin-users/    perluasan create_batch/deactivate
supabase/migrations/0017_import.sql batch/rows/RLS/RPC
tests/imports/                     fixture CSV fiktif + test
docs/*                             dokumen ini
```
