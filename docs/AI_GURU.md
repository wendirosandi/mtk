# AI GURU & GENERATOR

Rancangan teknis fitur bantuan AI untuk Guru. **Status: fondasi (desain + skema + Edge
Function scaffold). Belum ada API key dan belum diaktifkan.**

---

## 1. Tujuan

Guru dapat menghasilkan **draft** Modul, Materi, LKPD, Kuis, dan Bank Soal dengan
parameter: mapel, tingkat, topik, indikator, jenis soal, kesulitan, jumlah, dan pool.

AI **tidak pernah** menerbitkan konten sendiri. Semua hasil masuk status `draft` dan
harus ditinjau guru sebelum `active`/`published`.

## 2. Non-Tujuan

- AI tidak menilai siswa dan tidak menulis `gradebook_entries`.
- AI tidak membaca data pribadi siswa.
- AI tidak menggantikan RLS/RPC; semua penulisan tetap lewat policy/RPC.
- Tidak ada API key di frontend atau repository.

---

## 3. Arsitektur

```
Guru (browser)
  └─ LMS.supabase.functions.invoke('ai-content')
        │  JWT guru/admin diverifikasi di Edge Function
        ▼
Edge Function (Deno)
  ├─ validasi role + rate limit + parameter
  ├─ panggil provider AI (key di Supabase Secrets)
  ├─ validasi JSON schema + moderasi
  ├─ simpan ai_jobs (status done/failed)
  └─ simpan hasil sebagai draft:
        bank_items(status='draft')
        assessments(status='draft') + question_items
        materials/modules (status via config/review)
```

Provider bersifat abstrak: OpenAI-compatible (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`).

---

## 4. Skema `ai_jobs` (draft migrasi 0015)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | PK |
| `school_id` | uuid | sekolah |
| `requested_by` | uuid | guru/admin |
| `kind` | text | `module`, `material`, `lkpd`, `kuis`, `bank` |
| `status` | text | `queued/running/done/failed/approved/rejected` |
| `params` | jsonb | parameter permintaan |
| `result` | jsonb | ringkasan hasil/draft ids |
| `provider` / `model` | text | jejak model |
| `tokens_in` / `tokens_out` | int | biaya |
| `error` | text | kegagalan |
| `created_at` / `finished_at` | timestamptz | waktu |

RLS: guru melihat job miliknya; admin melihat sekolah; tulis oleh service role
(Edge Function) dan insert permintaan oleh guru.

---

## 5. Kontrak Parameter

```json
{
  "kind": "bank",
  "subject_id": "uuid",
  "grade_level_id": "uuid",
  "topic": "Teorema Pythagoras",
  "indicator": "Menentukan sisi miring segitiga siku-siku",
  "difficulty": "B",
  "items": 5,
  "item_kind": "num",
  "pool_id": "uuid|null",
  "instructions": "Konteks benda nyata, angka bulat"
}
```

Validasi server: mapel/tingkat milik sekolah, jumlah 1–30, jenis dikenal, guru
mengampu mapel (migrasi 0013).

---

## 6. Kontrak Output per Jenis

### Bank Soal
```json
{
  "items": [
    {
      "prompt": "…",
      "kind": "num",
      "difficulty": "B",
      "indicator": "…",
      "payload": { "answer": 15, "tol": 0 },
      "explanation": "…"
    }
  ]
}
```

### LKPD/Kuis
```json
{
  "title": "…",
  "description": "…",
  "questions": [
    { "prompt": "…", "kind": "mc", "options": ["A","B","C","D"], "key": "B", "weight": 1 }
  ]
}
```

### Modul/Materi
```json
{
  "title": "…",
  "description": "…",
  "topics": [
    { "title": "…", "materials": [
      { "kind": "dokumen|video|pdf", "title": "…", "url": "…", "summary": "…" }
    ]}
  ]
}
```

Semua output wajib lolos JSON schema **sebelum** disimpan. Jika gagal → `ai_jobs.status='failed'`,
tidak ada penulisan draft.

---

## 7. Alur Review Guru

1. Guru mengisi wizard → `ai-content` (status `running`).
2. Hasil masuk draft; UI menampilkan pratinjau + jumlah token.
3. Guru **Edit** / **Tolak** / **Setujui**.
4. Setujui → status `active` (bank) atau `published_at` (asesmen).
5. Semua aksi tercatat di `audit_logs`.

Tidak ada auto-publish, tidak ada AI yang menulis nilai.

---

## 8. Keamanan

- `AI_API_KEY` hanya di Supabase Secrets.
- Edge Function memverifikasi JWT + role `guru/admin` dari tabel `profiles`.
- Rate limit per guru (mis. 20 job/jam) dan kuota harian sekolah.
- Prompt injection: instruksi sistem tetap; konten guru diperlakukan sebagai data.
- Output disanitasi: tidak boleh HTML mentah; tidak boleh berisi kunci jawaban di
  tempat yang terbaca siswa.
- Moderasi konten + penolakan topik di luar mapel.
- Audit biaya/token; alert jika melebihi ambang.

---

## 9. Biaya & Operasional

- Simpan `tokens_in/out` per job; hitung perkiraan biaya.
- Batas default: 30 item/permintaan, 20 permintaan/jam/guru.
- Timeout provider 30 detik; retry maksimal 1×.
- Fallback: jika AI gagal, guru tetap bisa membuat konten manual (UI yang ada).

---

## 10. Rollout

| Tahap | Isi |
|---|---|
| 1 | Migrasi `0015_ai_jobs`, Edge Function `ai-content` (tanpa key → 503) |
| 2 | Wizard bank soal + pratinjau draft |
| 3 | Wizard LKPD/Kuis + validasi schema |
| 4 | Wizard modul/materi |
| 5 | Kuota, biaya, audit, evaluasi kualitas |

**Definition of Done:** guru menghasilkan draft, mengedit, menyetujui; tidak ada konten
AI yang terbit otomatis; key tidak pernah terlihat di browser.

---

## 11. Status Implementasi Saat Ini

- `docs/AI_GURU.md` — selesai (dokumen ini).
- `supabase/migrations/0015_ai_jobs.sql` — **sudah diterapkan**.
- `supabase/functions/ai-content/index.ts` — **sudah di-deploy**; action `health`
  tersedia. Tanpa key → pesan “AI belum dikonfigurasi”, tidak menulis apa pun.
- UI `guru-ai` — wizard Bank Soal; memanggil Edge Function dan menampilkan draft.
- API key AI — belum dikonfigurasi.
- Wizard LKPD/Kuis/Modul — belum dibuat (menunggu key & review bank).
