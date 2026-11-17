// tests/imports/schema-check.mjs — validasi definisi template CSV import.
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import assert from "node:assert/strict";

const code = readFileSync(new URL("../../src/lib/import-schema.js", import.meta.url), "utf8");
const sandbox = { window: {} };
createContext(sandbox);
runInContext(code, sandbox);
const S = sandbox.window.ImportSchema;

assert.ok(S, "ImportSchema global harus tersedia");
assert.equal(S.list().length, 16, "harus ada 16 template");
assert.deepEqual(Array.from(S.ORDER), [  "sekolah", "tahun_pelajaran", "kelas", "mata_pelajaran",
  "guru", "siswa", "wali_kelas", "penugasan_guru", "keanggotaan_siswa",
  "kategori_siswa_umum", "kategori_siswa_mapel",
  "modul_materi", "asesmen", "soal_asesmen", "bank_soal", "nilai_historis"
]);

for (const t of S.list()) {
  assert.ok(t.fields.length > 0, t.kind + " harus punya kolom");
  const csv = S.templateCsv(t.kind);
  const lines = csv.trim().split(/\r?\n/);
  assert.equal(lines.length, 2, t.kind + " harus berisi header + 1 contoh");
  const headers = lines[0].split(",");
  assert.equal(headers.length, t.fields.length, t.kind + " jumlah header harus cocok");
  assert.ok(!/password|token|secret/i.test(lines[0]), t.kind + " tidak boleh memuat password/token");
  for (const required of t.fields.filter((f) => f.required)) {
    assert.ok(headers.includes(required.key), t.kind + " wajib punya kolom " + required.key);
  }
}

// autoMap: alias, huruf besar/kecil, spasi
const siswa = S.get("siswa");
const am = S.autoMap("siswa", ["Username", "Nama Lengkap", "Jenis Kelamin"]);
assert.equal(am.mapping.username, "Username");
assert.equal(am.mapping.nama_lengkap, "Nama Lengkap");
assert.equal(am.mapping.jenis_kelamin, "Jenis Kelamin");
assert.deepEqual(Array.from(am.missing), []);

// kolom wajib hilang terdeteksi
const miss = S.autoMap("kelas", ["tahun"]);
assert.ok(miss.missing.includes("label"));
assert.ok(miss.missing.includes("tingkat_label"));

// CSV quoting
assert.equal(S.csvCell('a,b'), '"a,b"');
assert.equal(S.csvCell('a"b'), '"a""b"');
assert.equal(S.csvCell("biasa"), "biasa");

// Semua template yang didokumentasikan harus aktif.
for (const kind of S.ORDER) {
  assert.equal(S.get(kind).supported, true, kind + " harus didukung");
}

console.log("Import schema: 16 template OK, alias & wajib OK, tanpa password/token.");

// Fixture fiktif harus cocok dengan header template.
const fixtures = {
  sekolah: "sekolah.csv", tahun_pelajaran: "tahun_pelajaran.csv", kelas: "kelas.csv",
  mata_pelajaran: "mata_pelajaran.csv", guru: "guru.csv", siswa: "siswa.csv",
  wali_kelas: "wali_kelas.csv", penugasan_guru: "penugasan_guru.csv",
  keanggotaan_siswa: "keanggotaan_siswa.csv", kategori_siswa_umum: "kategori_siswa_umum.csv",
  kategori_siswa_mapel: "kategori_siswa_mapel.csv"
};
for (const [kind, file] of Object.entries(fixtures)) {
  const csv = readFileSync(new URL("./fixtures/" + file, import.meta.url), "utf8");
  const headers = csv.trim().split(/\r?\n/)[0].split(",");
  const mapped = S.autoMap(kind, headers);
  assert.deepEqual(Array.from(mapped.missing), [], file + " kehilangan kolom wajib: " + mapped.missing.join(","));
  assert.ok(!/password|token|secret/i.test(csv), file + " tidak boleh memuat password/token");
}
console.log("Import fixtures: 11 CSV fiktif cocok dengan template.")

