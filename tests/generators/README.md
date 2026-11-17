# Generator Golden Test

Menguji determinisme generator LKPD. Golden file disimpan di `golden/`.

```bash
node tests/generators/harness.mjs          # verifikasi
node tests/generators/harness.mjs --update # regenerasi golden (review diff!)
```

Kasus yang diuji:

- `MTK-8202 / generateActivity1 / B`
- `MTK-8202 / generateActivity2 / A`
- `MTK-8104 / generateSoal / C`

Jika generator berubah dengan sengaja, jalankan `--update`, tinjau diff golden,
lalu commit. Jangan update golden hanya untuk membuat CI hijau.
