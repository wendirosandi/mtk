# UI GUIDE LMS MTK

Panduan desain dan implementasi antarmuka. Tujuan: konsisten, modern, responsif,
mudah dipakai guru/siswa SMP, dan dapat dikerjakan AI agent tanpa menebak.

---

## 1. Prinsip

1. **Satu sistem, bukan per halaman.** Warna, jarak, tombol, dan tabel memakai komponen bersama.
2. **Mobile-first.** Semua halaman harus nyaman di 360 px.
3. **Jelas sebelum cantik.** Prioritas: keterbacaan, target sentuh, status yang terlihat.
4. **Aksesibel.** Bisa keyboard, punya label, kontras AA.
5. **Aman.** Semua data dari database di-escape sebelum dirender.

---

## 2. Design Tokens

### Warna

| Token | Nilai | Pemakaian |
|---|---|---|
| `--primary` | `#0f766e` | aksi utama, nav aktif |
| `--primary-600` | `#0d9488` | hover |
| `--primary-50` | `#f0fdfa` | latar lembut |
| `--accent` | `#f59e0b` | peringatan, sorotan |
| `--danger` | `#e11d48` | hapus, error |
| `--success` | `#16a34a` | selesai, benar |
| `--info` | `#0284c7` | tautan, info |
| `--bg` | `#f8fafc` | latar halaman |
| `--surface` | `#ffffff` | kartu |
| `--border` | `#e2e8f0` | garis |
| `--text` | `#0f172a` | teks utama |
| `--muted` | `#64748b` | teks sekunder |

Gunakan warna semantik, bukan warna acak per halaman. Jangan memakai lebih dari
satu warna aksen utama dalam satu layar.

### Tipografi

- Font: **Plus Jakarta Sans** (400, 600, 700, 800).
- Skala: 12 / 14 / 16 / 20 / 24 / 30 px.
- Judul halaman 24–30, judul kartu 16–20, body 14–16, meta 12.
- Line-height 1.5 untuk body.

### Bentuk & Jarak

- Radius: 12 (input/tombol), 16 (kartu), 24 (panel besar).
- Spacing: 4, 8, 12, 16, 24, 32.
- Shadow: `0 1px 2px rgba(15,23,42,.06)`, `0 8px 24px rgba(15,23,42,.08)`.
- Target sentuh minimum **44×44 px**.
- Lebar konten: 720 (form), 1024 (baca), 1200 (dashboard).

---

## 3. Layout

### Desktop (≥ 1024 px)

```
┌────────────────────────────────────────────┐
│ Topbar: brand · sekolah · notifikasi · user│
├──────────┬─────────────────────────────────┤
│ Sidebar  │ PageHeader                      │
│ 240 px   │ Konten (max 1200)               │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

### Mobile (< 1024 px)

- Topbar ringkas (brand + user).
- Bottom navigation 5 item; item kelima “Lainnya” membuka sheet.
- Tabel berubah menjadi daftar kartu.
- Aksi utama memakai tombol lebar penuh di bawah.

### Navigasi per role

| Role | Item utama |
|---|---|
| Admin | Dashboard, Pengguna, Akademik, Monitoring, Lainnya |
| Guru | Dashboard, Kelas, Asesmen, Nilai, Lainnya |
| Siswa | Beranda, Mapel, Nilai, Aktivitas, Profil |

Nav aktif ditandai warna primary + indikator, bukan hanya ikon.

---

## 4. Komponen Wajib

| Komponen | Perilaku |
|---|---|
| `PageHeader` | judul, deskripsi singkat, aksi kanan, breadcrumb opsional |
| `Card` | surface, border, radius 16, padding 16–24 |
| `Stat` | label, angka besar, tren/konteks |
| `Badge` | status: aktif/draft/terkunci/selesai/error |
| `Button` | varian primary, secondary, ghost, danger; state loading |
| `FormField` | label, hint, error, required |
| `DataTable` | header sticky, sort, filter, pagination, empty state |
| `EmptyState` | ikon, penjelasan, CTA |
| `Skeleton` | loading tanpa layout shift |
| `Modal/Drawer` | focus trap, ESC, klik luar, tombol tutup jelas |
| `Toast` | antrean, auto-dismiss, bisa ditutup |
| `Tabs` | untuk detail asesmen/materi |
| `Progress` | progres belajar, kelengkapan |

Semua komponen diletakkan di `src/ui/` dan dipakai lewat `window.UI`.

---

## 5. Pola Halaman

### Daftar (mapel, pengguna, asesmen)
Header + filter + tabel/kartu + pagination. Empty state dengan CTA sesuai role.

### Detail (materi, asesmen)
Header + metadata (badge status) + tabs (Ringkasan, Materi/Soal, Nilai, Aktivitas).
Aksi utama selalu terlihat.

### Form (buat modul/asesmen)
Satu kolom, label di atas, bantuan singkat, validasi inline, tombol simpan sticky di mobile.
Simpan sebagai draft adalah default.

### Dashboard
4 stat utama + 2 panel (antrean & aktivitas) + aksi cepat.

---

## 6. Status & Umpan Balik

| Kondisi | Tampilan |
|---|---|
| Memuat | skeleton, bukan spinner penuh layar |
| Kosong | EmptyState + penjelasan + CTA |
| Error | pesan spesifik + tombol “Coba lagi” |
| Sukses | toast singkat + perubahan terlihat |
| Sesi habis | arahkan ke login dengan `next`, tanpa kehilangan konteks |
| Terkunci | badge 🔒 + alasan (prasyarat/akses) |

Jangan menampilkan error mentah dari Supabase ke siswa.

---

## 7. Responsif & Tabel

- Breakpoint: 640 / 768 / 1024 / 1280.
- Tabel > 5 kolom: tampilkan kolom kunci di mobile, sisanya di detail.
- Gunakan `overflow-x-auto` hanya untuk tabel teknis (audit), bukan konten utama.
- Form: lebar penuh, maksimal 720 px.

---

## 8. Aksesibilitas (Checklist)

- [ ] Semua aksi memakai `<button>`/`<a>`, bukan `<div onclick>`.
- [ ] Setiap input punya `<label>` atau `aria-label`.
- [ ] Fokus terlihat (`:focus-visible`).
- [ ] Kontras teks ≥ 4.5:1.
- [ ] Modal: focus trap, ESC, `aria-modal`.
- [ ] Gambar dekoratif `alt=""`; ikon bermakna punya label.
- [ ] Pesan error terhubung ke field (`aria-describedby`).
- [ ] Tidak ada teks yang hanya dibedakan warna.

---

## 9. Keamanan Render

Wajib ada helper:

```js
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}
```

Aturan:

- Semua nilai dari database/user → `esc()` sebelum `innerHTML`.
- URL eksternal divalidasi (`http/https` atau path relatif), tolak `javascript:`.
- Jangan menyimpan token di DOM/URL.
- Jangan memakai `eval`/`new Function` untuk konten.

---

## 10. Gaya Bahasa

- Bahasa Indonesia, sapaan netral (“Anda” untuk guru/admin, “kamu” untuk siswa).
- Tombol = kata kerja: “Simpan”, “Terbitkan”, “Kerjakan”, “Kembali”.
- Hindari istilah teknis di UI siswa (RLS, RPC, attempt).
- Gunakan istilah konsisten: Mapel, Modul, Topik, Materi, LKPD, Kuis, Nilai, Aktivitas.

---

## 11. Tailwind & Aset

Saat ini Tailwind dimuat via CDN. Untuk sementara:

- Tambahkan konfigurasi token di `index.html` (`tailwind.config`).
- Style khusus di `assets/css/app.css`, bukan inline per halaman.
- Font Awesome boleh dipertahankan untuk ikon, tetapi gunakan satu gaya ikon.

Jangka menengah: pertimbangkan CSS build sederhana atau Tailwind terkompilasi agar
tidak bergantung CDN dan menghindari FOUC.

---

## 12. Definition of Done UI

- [ ] Mobile 360 px dan desktop 1280 px diuji.
- [ ] Keyboard-only dapat menyelesaikan alur utama.
- [ ] Tidak ada data user tanpa escaping.
- [ ] Loading, kosong, error, sukses tertangani.
- [ ] Memakai komponen bersama, bukan style baru.
- [ ] Tidak ada warna/ikon yang bertentangan dengan makna.
