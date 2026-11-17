# TEMPLATE CSV IMPORT

**Status: template dan alur import sudah diimplementasikan.** Semua contoh memakai data fiktif. Jangan mencantumkan data pribadi/sebenarnya di repo.

## Konvensi

- Encoding **UTF-8**, pemisah koma, baris pertama header.
- Tanggal `YYYY-MM-DD`; boolean `true/false`; kategori `A/B/C`.
- Kolom relasi memakai **natural key** (username/kode/label), bukan UUID.
- Tidak ada kolom password/token.
- Baris kosong diabaikan; sel kosong = tidak diisi.
- Teks yang mengandung koma harus dikutip (`"..."`).

## Urutan import

`sekolah → tahun → kelas → mapel → guru → siswa → wali → penugasan →
keanggotaan → kategori umum → kategori mapel → modul/materi → asesmen →
soal asesmen → bank soal → nilai historis`.

---

## 1. `sekolah.csv`

Header:

```csv
kode,nama,kepala_sekolah,alamat,logo_url,settings_json
```

Contoh:

```csv
SMPN2KAR, SMPN 2 Karawang Barat, Wendi Rosandi, Jl. Contoh No. 1, , {"semester_active":"Ganjil","ta_active":"2026/2027"}
```

- Hanya **update** sekolah yang sudah ada (kode tidak boleh diubah).
- Sekolah baru + admin pertama dibuat via bootstrap service, bukan CSV.
- Natural key: `kode`.

## 2. `tahun_pelajaran.csv`

```csv
label,mulai,selesai,aktif
2026/2027,2026-07-01,2027-06-30,true
```

- Natural key: `label` (per sekolah).
- Hanya satu `aktif=true`; batch akan menolak lebih dari satu.

## 3. `kelas.csv`

```csv
tahun_label,tingkat_label,label
2026/2027,7,7.A
2026/2027,8,8.F
```

- `tingkat_label` harus `7`, `8`, atau `9` (grade_levels existing).
- Natural key: `(tahun_label, label)`.

## 4. `mata_pelajaran.csv`

```csv
kode,nama
MTK,Matematika
IPA,Ilmu Pengetahuan Alam
```

- Natural key: `kode`.

## 5. `guru.csv`

```csv
username,nama_lengkap,jenis_kelamin,status
guru.ani,Ani Lestari,P,aktif
guru.budi,Budi Santoso,L,aktif
```

- **Tanpa password.** Password awal dibuat server.
- `username` regex `^[a-z0-9._-]{3,40}$`.
- Natural key: `username` per sekolah.
- Re-import: perbarui nama/gender; tidak reset password.

## 6. `siswa.csv`

```csv
username,nama_lengkap,jenis_kelamin,status
siswa.ahmad,Ahmad Fauzi,L,aktif
siswa.sari,Sari Dewi,P,aktif
```

- Tidak ada kelas/kategori di file ini; lihat template 9–11.
- Tanpa password.

## 7. `wali_kelas.csv`

```csv
tahun_label,kelas_label,guru_username
2026/2027,7.A,guru.ani
```

- Guru harus role `guru` di sekolah yang sama.
- Natural key: `(tahun_label, kelas_label)`; mengganti wali mencatat audit.

## 8. `penugasan_guru.csv`

```csv
tahun_label,guru_username,mapel_kode,kelas_label
2026/2027,guru.ani,MTK,7.A
2026/2027,guru.budi,IPA,
```

- `kelas_label` kosong = semua kelas pada tahun tersebut.
- Natural key: `(subject, teacher, year, class)`.

## 9. `keanggotaan_siswa.csv`

```csv
tahun_label,kelas_label,siswa_username
2026/2027,7.A,siswa.ahmad
2026/2027,7.A,siswa.sari
```

- Natural key: `(class, student)`.
- Re-import tidak membuat anggota ganda.
- Perpindahan kelas: impor kelas baru + tandai `left_at` (fitur UI terpisah),
  jangan menghapus histori.

## 10. `kategori_siswa_umum.csv`

```csv
tahun_label,kelas_label,siswa_username,kategori
2026/2027,7.A,siswa.ahmad,B
```

- Hanya Walas/admin; import dijalankan admin.
- Menulis `student_general_categories` + `category_history` (`source=import`).
- Natural key: `(student, year)`.

## 11. `kategori_siswa_mapel.csv`

```csv
tahun_label,kelas_label,siswa_username,mapel_kode,kategori
2026/2027,7.A,siswa.ahmad,A
2026/2027,7.A,siswa.ahmad,C
```

- Baris kedua untuk mapel berbeda.
- Natural key: `(student, subject, year)`.
- Tidak mengubah kategori umum.

## 12. `modul_materi.csv`

```csv
mapel_kode,tingkat_label,modul_judul,modul_deskripsi,modul_urutan,topik_judul,topik_urutan,materi_jenis,materi_judul,materi_url,materi_urutan
MTK,7,Bilangan,Operasi bilangan,1,Bilangan Bulat,1,dokumen,Materi Bilangan Bulat,,1
MTK,7,Bilangan,Operasi bilangan,1,Bilangan Bulat,1,video,Video Bilangan,https://contoh.invalid/video,2
```

- `materi_jenis`: `dokumen|video|pdf|app|geogebra|lkpd_ref`.
- Natural key: `(mapel, tingkat, modul_judul)`, `(modul, topik_judul)`,
  `(topik, materi_judul, materi_url)`.
- Modul/topik yang sudah ada tidak diduplikasi.

## 13. `asesmen.csv`

```csv
tahun_label,mapel_kode,tingkat_label,modul_judul,topik_judul,kode,judul,jenis,status,semester,kolaborasi,pengiriman,file_url,prasyarat_kode,config_json,published_at
2026/2027,MTK,7,Bilangan,Bilangan Bulat,MTK-7-001,LKPD Bilangan Bulat,lkpd,active,1,none,portal,LKPD/MTK001.html,,{},2026-07-15T08:00:00Z
```

- `jenis`: `lkpd|kuis|tugas|projek`; `status`: `draft|active|exambro|inactive|locked|archived`.
- `kolaborasi`: `none|optional|optional_fixed|required|required_fixed`.
- `pengiriman`: `portal|exambro|direct`.
- `published_at` wajib bila `active`.
- `tingkat_label` opsional; dipakai untuk memilih modul bila judul modul sama di beberapa tingkat.
- Natural key: `kode` per sekolah.
- `modul_judul`/`topik_judul` opsional; jika diisi harus ada pada batch/existing.
- Asesmen yang sudah `package_frozen_at` dilewati (tidak diubah).

## 14. `soal_asesmen.csv` (tambahan wajib untuk LKPD)

```csv
asesmen_kode,item_key,jenis,kesulitan,soal,kunci,pilihan,keys,answers,weight,urutan
MTK-7-001,k1.hyp,num,B,Berapa sisi miring 3-4?,5,,,,1,1
MTK-7-001,k1.shape,mc,B,Segitiga dengan 3-4-5 adalah?,segitiga_siku_siku,segitiga_siku_siku|segitiga_lancip|segitiga_tumpul,,,1,2
```

- `jenis`: `num|mc|bs|match|scaffold|text`.
- `kunci` untuk num/mc/bs; `pilihan` pipe untuk mc/bs.
- `keys` pipe untuk match; `answers` koma untuk scaffold.
- `weight` khusus soal asesmen.
- Natural key: `(asesmen_kode, item_key)`.
- Asesmen frozen tidak boleh diubah.

## 15. `bank_soal.csv`

```csv
mapel_kode,pool_judul,indikator,jenis,kesulitan,soal,kunci,pilihan,keys,answers,status
MTK,Bilangan Bulat,Operasi penjumlahan,num,B,Hasil 12 + 8 = ?,20,,,,active
MTK,Bilangan Bulat,Konsep segitiga,mc,B,Jenis segitiga 3-4-5?,segitiga_siku_siku,segitiga_siku_siku|segitiga_lancip|segitiga_tumpul,,,active
```

- `pool_judul` dibuat otomatis bila belum ada (mapel harus sama).
- `status`: `draft|active|archived`.
- Natural key: `(mapel, pool, indikator, jenis, soal)`.
- Tanpa weight; bobot ada di kisi-kisi.

## 16. `nilai_historis.csv`

```csv
tahun_label,kelas_label,siswa_username,asesmen_kode,skor,max_skor,sumber,catatan
2026/2027,7.A,siswa.ahmad,MTK-7-001,85,100,impor,Nilai semester ganjil
```

- `sumber` hanya `impor` atau `manual`.
- Default **tidak menimpa** nilai `auto`; hanya dengan opsi eksplisit admin.
- Natural key: `(asesmen, siswa)`.
- Tidak menghapus nilai lain.

---

## Aturan Validasi Template

1. Semua referensi harus satu sekolah dengan admin.
2. Kolom relasi wajib cocok dengan data existing atau batch sebelumnya.
3. Duplikat dalam file → error; duplikat DB → `skip`/`update`.
4. Username tidak boleh membuat akun baru jika sudah ada.
5. Tidak ada password di semua template.
6. File maksimum: 2 MB / 2.000 baris (dapat dinaikkan hati-hati).
7. Baris error tidak menggagalkan baris valid lain pada dry-run, tetapi
   commit akademik bersifat **all-or-nothing** untuk batch yang sama.
8. Import konten mengikuti status entitas: asesmen/soal yang sudah beku
   dilewati; nilai `auto` tidak ditimpa nilai historis.
9. Modul/topik/materi, asesmen, soal, bank soal, dan nilai historis sudah aktif.
   Prasyarat asesmen harus sudah ada (DB atau baris sebelumnya dalam file).

## Catatan Relasi

- Tingkat `7/8/9` sudah di-seed di `grade_levels`; belum ada template/CRUD tingkat.
- `penugasan_guru` dengan `kelas_label` kosong berarti `class_id NULL`.
  PostgreSQL mengizinkan beberapa baris NULL pada unique constraint, sehingga
  import harus mengecek existing `(subject, teacher, year, class_id IS NULL)`
  secara eksplisit.
- Sekolah baru + admin pertama **bukan** lewat CSV; gunakan bootstrap service.
- `profiles.settings.kelas` bukan sumber resmi; keanggotaan memakai
  `class_memberships`.
- Kategori memakai tabel 0016, bukan `profiles.settings.kategori`.
