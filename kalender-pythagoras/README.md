# 📐 Kalender Pythagoras 2027

**Projek Pembuktian Teorema Pythagoras untuk Siswa SMP Kelas 8**

Koleksi 12 pembuktian Teorema Pythagoras yang disusun sebagai kalender tahunan 2027.
Setiap bulan menampilkan satu metode pembuktian berbeda, dibuat oleh 10 kelompok siswa
(±44 siswa) + 2 contoh dari guru.

---

##  Tujuan Projek

1. **Edukasi**: Siswa memahami Teorema Pythagoras melalui berbagai sudut pandang pembuktian.
2. **Kreativitas**: Siswa membuat karya manual (gambar/cetak di kertas A4/A3) + versi digital.
3. **Kolaborasi**: 10 kelompok mengerjakan 10 metode berbeda selama 10 bulan.
4. **Output Fisik**: 12 lembar A4 dijilid menjadi **Kalender Meja 2027** per kelas.

---

## 📅 Daftar 12 Pembuktian

| # | Bulan | Pembuktian | Pengampu | Status |
|---|-------|------------|----------|--------|
| 1 | Januari | Sel Terbang Pythagoras (3-4-5) | 👨‍🏫 Guru | ✅ |
| 2 | Februari | Perigal Klasik (3-4-5) | 👨‍ Guru | ✅ |
| 3 | Maret | Rearrangement 4 Segitiga (3-4-5) | 👥 Kel. 1 | ✅ |
| 4 | April | Perigal 4 Posisi a² (Gunting-Tempel) |  Kel. 2 | ✅ |
| 5 | Mei | Aljabar Murni dari (a+b)² | 👥 Kel. 3 | ✅ |
| 6 | Juni | Diseksi Einstein (3-4-5) | 👥 Kel. 4 | ✅ |
| 7 | Juli | Garis Tinggi & Segitiga Sebangun (6-8-10) | 👥 Kel. 5 | ✅ |
| 8 | Agustus | Diagram Tali Zhao Shuang / Bhaskara (5-12-13) | 👥 Kel. 6 | ✅ |
| 9 | September | Trapesium Garfield (8-15-17) | 👥 Kel. 7 | ✅ |
| 10 | Oktober | Euclid I.47 "Kincir Angin" (3-4-5) | 👥 Kel. 8 | ✅ |
| 11 | November | Lingkaran Dalam & Garis Singgung (5-12-13) | 👥 Kel. 9 | ✅ |
| 12 | Desember | Sintesis Dua Identitas Luas | 👥 Kel. 10 | ✅ |

**Status akhir: 12/12 selesai 🎉**

---

## 📁 Struktur Folder

```text
kalender-pythagoras/
├── index.html                      # Halaman utama + Kalender 2027
├── README.md                       # Dokumentasi ini
├── pages/
│   ├── bukti-01-januari.html       # Sel Terbang
│   ├── bukti-02-februari.html      # Perigal Klasik (engine v5.1)
│   ├── bukti-03-maret.html         # Rearrangement 4 Segitiga
│   ├── bukti-04-april.html         # Perigal 4 Posisi (statis)
│   ├── bukti-05-mei.html           # Aljabar Murni
│   ├── bukti-06-juni.html          # Diseksi Einstein
│   ├── bukti-07-juli.html          # Garis Tinggi & Sebangun
│   ├── bukti-08-agustus.html       # Zhao Shuang / Bhaskara
│   ├── bukti-09-september.html     # Trapesium Garfield
│   ├── bukti-10-oktober.html       # Euclid I.47
│   ├── bukti-11-november.html      # Lingkaran Dalam
│   └── bukti-12-desember.html      # Sintesis Dua Identitas
├── assets/
│   ├── css/
│   │   ├── main.css                # CSS global (header, nav, footer)
│   │   ├── kalender.css            # CSS grid kalender + kartu bulan
│   │   └── proof.css               # CSS halaman pembuktian + sheet A4
│   ├── js/
│   │   ├── kalender.js             # Data & render kalender
│   │   ├── calendar-template.js    # Render grid kalender bulanan 2027
│   │   ├── pdf-export.js           # Export PDF 1 halaman A4
│   │   ├── perigal-engine-v5.1.js  # Engine Perigal (DFS + verifier luas)
│   │   └── perigal-classic.js      # Engine Perigal klasik (tanpa solver)
│   └── images/
│       └── april/                  # Screenshot applet untuk April
│           ├── opsi1-awal.png
│           ├── opsi1-akhir.png
│           ├── opsi2-awal.png
│           ├── opsi2-akhir.png
│           ├── opsi3-awal.png
│           ├── opsi3-akhir.png
│           ├── opsi4-awal.png      # (menyusul)
│           └── opsi4-akhir.png     # (menyusul)
└── embeds/                         # (opsional) wrapper iframe
