# RLS Test Manual

CI menjalankan `supabase db lint`; skenario RLS dijalankan manual di lokal/staging.

## Persiapan

```bash
supabase start
supabase db reset
# muat fixtures (akun admin/guru/siswa, kelas 8.F/8.G, asesmen)
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f tests/rls/fixtures.sql
```

Jalankan `tests/rls/rls_scenarios.sql` per blok dengan identitas yang sesuai
(`set_config('request.jwt.claim.sub', ...)` + `set role authenticated`).

## Skenario Kategori (0016)

Setelah fixtures, siapkan guru IPA dan penugasan IPA 8.F, lalu uji:

1. Admin `app_assign_homeroom(8.F, guru1)` → berhasil; bukan guru → ditolak.
2. Walas `app_set_general_category(siswa, 'A')` di kelasnya → berhasil.
3. Walas yang sama mencoba siswa kelas lain → ditolak.
4. Guru MTK `app_set_subject_category(siswa, MTK, 'B')` → berhasil.
5. Guru MTK mencoba IPA → ditolak; guru IPA mencoba MTK → ditolak.
6. Siswa `select` kategori sendiri → berhasil; `insert/update` langsung → RLS menolak.
7. Ubah general A→C; kategori mapel tetap B.
8. Buat tahun baru + kelas; baris/history tahun lama tetap ada.
9. Cek `category_history` dan `audit_logs` bertambah.

## UI Smoke

Manual setelah `python -m http.server 8788`:

- login `admin.uji` → Akademik → set walas;
- login `guru.uji` → Walas (ubah umum), Kategori (ubah MTK);
- login `8-f-syakirah` → Profil (read-only umum + mapel);
- Kalender subpage tanpa sesi → login → kembali ke halaman;
- ToolsMathPro → identitas otomatis, aktivitas tercatat.
