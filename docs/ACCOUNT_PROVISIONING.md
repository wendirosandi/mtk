# ACCOUNT PROVISIONING (ADMIN)

**Status: diimplementasikan dan sudah di-deploy ke cloud. Kredensial sekali-tampil, deaktivasi, dan ganti password wajib sudah aktif.**

## 1. Kondisi Saat Ini

- Login memakai **username + password**.
- Email Supabase dibentuk `LMS.loginId(username, role)`:
  `username@<school-code>.<role>.lms`.
- Akun Auth dibuat oleh Edge Function `admin-users` (service role) dan
  profilnya di tabel `profiles`.
- Admin dapat membuat akun satu per satu dan reset password di `admin-pengguna`.
- `profiles.must_change_password` ada, tetapi **belum dipaksa** oleh aplikasi.
- `profiles.status` ada, tetapi **belum memblokir login**.
- Penghapusan akun tidak tersedia; ini benar untuk menjaga histori.
- Sekolah pertama dan admin pertama **belum bisa** dibuat dari UI (tidak ada policy
  INSERT `schools`); harus bootstrap service/CLI.

## 2. Prinsip

1. **Tidak ada password di CSV**, repo, log, tabel profil, atau audit.
2. Akun hanya dibuat melalui **Supabase Auth Admin API** di backend tepercaya.
3. Password awal dibuat **server-side** dan hanya ditampilkan **sekali**.
4. Akun hasil import wajib mengganti password saat login pertama.
5. Re-import tidak membuat akun/password baru bila username/email sudah ada.
6. Akun tidak dihapus jika punya histori; gunakan status nonaktif + Auth ban.
7. Satu admin hanya untuk satu sekolah; `school_id` dari sesi, bukan CSV.

## 3. Bootstrap Sekolah & Admin Pertama

Karena admin tidak boleh membuat sekolah baru sendiri:

1. Operator platform menyiapkan `schools` + `profiles` admin pertama
   via SQL/service role (bukan frontend).
2. Admin pertama login dengan akun tersebut.
3. Data sekolah lain diimpor lewat UI Admin.

Alternatif jangka panjang: role `super_admin` platform + RPC khusus. **Belum**
dirancang di skema saat ini; jangan menambah role tanpa migrasi/RLS baru.

## 4. Alur Pembuatan Akun (single & batch)

```
Admin UI / Import
  → Edge Function (JWT admin + school check)
      → cek existing by username/email
      → buat password acak (12–16 char, crypto)
      → auth.admin.createUser({ email, password, email_confirm: true,
                                user_metadata: { must_change_password: true } })
      → insert profiles(role, username, full_name, gender, status,
                        must_change_password=true, settings={})
      → jika profil gagal: auth.admin.deleteUser(id) (kompensasi)
      → audit_logs
      → kembalikan kredensial sekali (tidak disimpan)
```

### Kontrak Edge Function (usulan)

`POST /functions/v1/admin-users`

```json
{ "action": "create", "username": "guru.ani", "full_name": "Ani Lestari",
  "role": "guru", "gender": "P" }
```

Respons:

```json
{ "ok": true, "id": "...", "email": "...", "temp_password": "..." }
```

`temp_password` **hanya** muncul sekali; jangan disimpan ke DB/log.
Aksi lain: `reset`, `deactivate`, `reactivate`, `create_batch`.

### Password awal

- Random 14 karakter, mengandung huruf besar/kecil/angka/simbol aman.
- Tidak dikirim lewat email (email sintetis tidak punya inbox).
- Admin menyerahkan secara aman / mengunduh file kredensial sekali.
- Setelah login: paksa ganti password; `must_change_password` diperiksa setelah
  profil dimuat dan sebelum route lain.
- Password minimum 8 (Auth), disarankan 12.

## 5. Idempotensi

Kunci:
- `profiles (school_id, username)` unik.
- Email Auth = `username@schoolcode.role.lms` (role menentukan namespace).
- Cek existing:
  1. profil berdasarkan username;
  2. Auth user berdasarkan email.
- Jika ada:
  - `update` nama/gender/status bila diminta;
  - **jangan** reset password;
  - status baris `skipped`/`updated`.
- Jika role berubah (mis. guru→siswa), jangan membuat akun baru; minta admin
  melakukan prosedur khusus (role change) + audit.

## 6. Reset Password

- Admin memilih user → Edge Function `reset`.
- Password baru dibuat server atau dimasukkan admin (min 8/12).
- Set `must_change_password=true`.
- Tidak mengubah profil/kelas/nilai.
- Audit `reset_password` (tanpa password).

## 7. Deaktivasi & Penghapusan

- **Jangan delete** user yang punya histori.
- Deaktivasi:
  - `profiles.status='nonaktif'`;
  - Auth Admin `updateUserById(id, { ban_duration: '...' })` atau
    `signOut` + ban;
  - login berikutnya ditolak.
- Reaktivasi: status `aktif`, cabut ban.
- Jika benar-benar harus menghapus akun tanpa histori: hapus Auth user
  (cascade profil), dengan audit dan konfirmasi.
- Histori kategori (`profile_id` set null), nilai, attempt, activity harus
  dipertahankan kebijakan FK; jangan hard delete profil yang punya nilai.

> Catatan: `profiles` saat ini `on delete cascade` dari `auth.users`; nilai/attempt
> juga cascade dari profil. Karena itu **hard delete akan menghapus histori**.
> Gunakan nonaktif, bukan delete.

## 8. Multi-Sekolah

- Edge Function mengambil `profiles.school_id` dari admin yang login.
- Tolak `school_id` berbeda di body/CSV.
- Email memakai `school.code`; kode sekolah harus konsisten.
- Admin tidak dapat melihat/mengubah user sekolah lain (RLS).

## 9. Audit & Kredensial

- Audit: `create_account`, `reset_password`, `deactivate_account`,
  `reactivate_account`, `import_accounts`.
- Jangan audit password/temp password.
- File kredensial admin: dibuat di browser dari respons, tidak disimpan server.
- Jika respons hilang, admin harus reset password (tidak ada recovery otomatis).

## 10. Pengujian

1. Buat guru/siswa baru → login berhasil dengan password sementara.
2. Login pertama → dipaksa ganti password.
3. Re-import username yang sama → tidak ada akun kedua.
4. Reset password → password lama gagal, baru berhasil.
5. Deaktivasi → login ditolak; nilai/histori tetap.
6. Reaktivasi → login kembali.
7. Role tidak bisa dieskalasi lewat import.
8. Admin sekolah A tidak bisa membuat akun sekolah B.
9. Tidak ada password di DB/log/response error.
10. Batch gagal di tengah → akun yang sudah dibuat dilaporkan/kompensasi.

## 11. Perubahan yang Diperlukan (Tahap C)

- [x] Perluas `admin-users`: `must_change_password`, `deactivate`, `reactivate`,
      `change_password`, validasi gender/status, audit.
- [x] Login flow: cek `status` + paksa ganti password.
- [x] Halaman admin-import memakai Edge Function ini untuk template guru/siswa.
- [x] Tabel batch/row (0017) untuk laporan akun.
- [x] Dokumentasi kredensial dan prosedur reset.

Catatan implementasi: password sementara dibuat server dan hanya dikembalikan
sekali pada respons commit; `change_password` memverifikasi password saat ini
sebelum mengganti dan menghapus flag wajib-ganti. Deaktivasi memakai ban Auth +
`profiles.status='nonaktif'`; tidak ada penghapusan akun/histori.
