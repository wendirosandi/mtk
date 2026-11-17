/* src/lib/import-schema.js
   Definisi 16 template CSV import data sekolah.
   Header HARUS sesuai skema database aktual (lihat docs/CSV_IMPORT_TEMPLATE.md).
   Tidak ada password/token di template mana pun. */
(function () {
  'use strict';

  function f(key, label, required, example, aliases, hint) {
    return { key: key, label: label, required: !!required, example: example == null ? '' : example,
             aliases: aliases || [], hint: hint || '' };
  }

  var TEMPLATES = {
    sekolah: {
      label: 'Sekolah', icon: 'fa-building', supported: true,
      description: 'Perbarui profil sekolah yang sedang aktif. Sekolah baru dibuat lewat bootstrap operator.',
      fields: [
        f('kode', 'Kode sekolah', true, 'SMPN2KAR', ['code'], 'Harus sama dengan kode sekolah admin.'),
        f('nama', 'Nama sekolah', false, 'SMPN 2 Karawang Barat', ['name']),
        f('kepala_sekolah', 'Kepala sekolah', false, 'Wendi Rosandi', ['headmaster']),
        f('alamat', 'Alamat', false, 'Jl. Contoh No. 1', ['address']),
        f('logo_url', 'URL logo', false, '', ['logo']),
        f('settings_json', 'Settings JSON', false, '{"semester_active":"Ganjil"}', ['settings'], 'Objek JSON valid atau kosong.')
      ]
    },
    tahun_pelajaran: {
      label: 'Tahun Pelajaran', icon: 'fa-calendar-days', supported: true,
      description: 'Tahun pelajaran beserta rentang tanggal dan status aktif.',
      fields: [
        f('label', 'Label tahun', true, '2026/2027', ['tahun', 'year']),
        f('mulai', 'Tanggal mulai', true, '2026-07-01', ['start'], 'Format YYYY-MM-DD.'),
        f('selesai', 'Tanggal selesai', true, '2027-06-30', ['end', 'akhir'], 'Harus setelah tanggal mulai.'),
        f('aktif', 'Aktif', false, 'true', ['active'], 'true/false. Maksimal satu tahun aktif per batch.')
      ]
    },
    kelas: {
      label: 'Kelas', icon: 'fa-door-open', supported: true,
      description: 'Kelas per tahun pelajaran dan tingkat.',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('tingkat_label', 'Tingkat', true, '8', ['tingkat', 'grade'], 'Mengacu label grade_levels (7/8/9).'),
        f('label', 'Nama kelas', true, '8.F', ['kelas', 'class'])
      ]
    },
    mata_pelajaran: {
      label: 'Mata Pelajaran', icon: 'fa-book', supported: true,
      description: 'Daftar mata pelajaran sekolah.',
      fields: [
        f('kode', 'Kode mapel', true, 'MTK', ['code']),
        f('nama', 'Nama mapel', true, 'Matematika', ['name'])
      ]
    },
    guru: {
      label: 'Akun Guru', icon: 'fa-chalkboard-user', supported: true,
      description: 'Akun guru. Password dibuat server dan ditampilkan sekali setelah commit.',
      fields: [
        f('username', 'Username', true, 'guru.ani', ['user'], 'Huruf kecil, angka, titik, garis bawah/strip (3–40).'),
        f('nama_lengkap', 'Nama lengkap', true, 'Ani Lestari', ['nama', 'full_name', 'name']),
        f('jenis_kelamin', 'Jenis kelamin', false, 'P', ['gender'], 'L atau P.'),
        f('status', 'Status', false, 'aktif', ['status_akun'], 'aktif atau nonaktif.')
      ]
    },
    siswa: {
      label: 'Akun Siswa', icon: 'fa-user-graduate', supported: true,
      description: 'Akun siswa. Password dibuat server dan ditampilkan sekali setelah commit.',
      fields: [
        f('username', 'Username', true, 'siswa.ahmad', ['user'], 'Huruf kecil, angka, titik, garis bawah/strip (3–40).'),
        f('nama_lengkap', 'Nama lengkap', true, 'Ahmad Fauzi', ['nama', 'full_name', 'name']),
        f('jenis_kelamin', 'Jenis kelamin', false, 'L', ['gender'], 'L atau P.'),
        f('status', 'Status', false, 'aktif', ['status_akun'], 'aktif atau nonaktif.')
      ]
    },
    wali_kelas: {
      label: 'Wali Kelas', icon: 'fa-house-user', supported: true,
      description: 'Menetapkan/mengganti wali kelas. Guru harus sudah ada.',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('kelas_label', 'Kelas', true, '8.F', ['kelas', 'class']),
        f('guru_username', 'Username guru', true, 'guru.ani', ['guru', 'username'])
      ]
    },
    penugasan_guru: {
      label: 'Penugasan Guru', icon: 'fa-link', supported: true,
      description: 'Guru pengampu mapel per tahun dan kelas. Kelas kosong berarti semua kelas.',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('guru_username', 'Username guru', true, 'guru.ani', ['guru', 'username']),
        f('mapel_kode', 'Kode mapel', true, 'MTK', ['mapel', 'subject']),
        f('kelas_label', 'Kelas', false, '8.F', ['kelas', 'class'], 'Kosongkan untuk semua kelas.')
      ]
    },
    keanggotaan_siswa: {
      label: 'Keanggotaan Siswa', icon: 'fa-users', supported: true,
      description: 'Masukkan siswa ke kelas pada tahun pelajaran tertentu.',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('kelas_label', 'Kelas', true, '8.F', ['kelas', 'class']),
        f('siswa_username', 'Username siswa', true, 'siswa.ahmad', ['siswa', 'username'])
      ]
    },
    kategori_siswa_umum: {
      label: 'Kategori Umum', icon: 'fa-tags', supported: true,
      description: 'Kategori umum siswa per tahun (kewenangan Walas, dijalankan Admin).',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('kelas_label', 'Kelas', true, '8.F', ['kelas', 'class']),
        f('siswa_username', 'Username siswa', true, 'siswa.ahmad', ['siswa', 'username']),
        f('kategori', 'Kategori', true, 'B', ['category'], 'A, B, atau C.')
      ]
    },
    kategori_siswa_mapel: {
      label: 'Kategori per Mapel', icon: 'fa-tags', supported: true,
      description: 'Kategori siswa per mata pelajaran (kewenangan Guru mapel, dijalankan Admin).',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('kelas_label', 'Kelas', true, '8.F', ['kelas', 'class']),
        f('siswa_username', 'Username siswa', true, 'siswa.ahmad', ['siswa', 'username']),
        f('mapel_kode', 'Kode mapel', true, 'MTK', ['mapel', 'subject']),
        f('kategori', 'Kategori', true, 'A', ['category'], 'A, B, atau C.')
      ]
    },
    modul_materi: {
      label: 'Modul & Materi', icon: 'fa-layer-group', supported: true,
      description: 'Modul, topik, dan materi. Modul/topik yang sama tidak diduplikasi.',
      fields: [
        f('mapel_kode', 'Kode mapel', true, 'MTK', ['mapel', 'subject']),
        f('tingkat_label', 'Tingkat', true, '7', ['tingkat', 'grade']),
        f('modul_judul', 'Judul modul', true, 'Bilangan', ['module']),
        f('modul_deskripsi', 'Deskripsi modul', false, 'Operasi bilangan', ['description']),
        f('modul_urutan', 'Urutan modul', false, '1', ['sort']),
        f('topik_judul', 'Judul topik', true, 'Bilangan Bulat', ['topic']),
        f('topik_urutan', 'Urutan topik', false, '1', ['topic_sort']),
        f('materi_jenis', 'Jenis materi', true, 'dokumen', ['kind'], 'dokumen|video|pdf|app|geogebra|lkpd_ref.'),
        f('materi_judul', 'Judul materi', true, 'Materi Bilangan Bulat', ['title']),
        f('materi_url', 'URL materi', false, 'https://contoh.invalid/materi', ['url']),
        f('materi_urutan', 'Urutan materi', false, '1', ['material_sort'])
      ]
    },
    asesmen: {
      label: 'Asesmen / LKPD', icon: 'fa-file-pen', supported: true,
      description: 'Metadata asesmen/LKPD. Prasyarat harus sudah ada; asesmen beku tidak diubah.',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('mapel_kode', 'Kode mapel', true, 'MTK', ['mapel', 'subject']),
        f('tingkat_label', 'Tingkat', false, '7', ['tingkat', 'grade'], 'Opsional; membantu menemukan modul bila judul modul sama antar tingkat.'),
        f('modul_judul', 'Judul modul', false, 'Bilangan', ['module']),
        f('topik_judul', 'Judul topik', false, 'Bilangan Bulat', ['topic']),
        f('kode', 'Kode asesmen', true, 'MTK-7-001', ['code']),
        f('judul', 'Judul asesmen', true, 'LKPD Bilangan Bulat', ['title']),
        f('jenis', 'Jenis', true, 'lkpd', ['kind'], 'lkpd|kuis|tugas|projek.'),
        f('status', 'Status', false, 'active', [], 'draft|active|exambro|inactive|locked|archived.'),
        f('semester', 'Semester', false, '1', [], '1 atau 2.'),
        f('kolaborasi', 'Mode kolaborasi', false, 'none', ['collab_mode'], 'none|optional|optional_fixed|required|required_fixed.'),
        f('pengiriman', 'Mode pengiriman', false, 'portal', ['delivery'], 'portal|exambro|direct.'),
        f('file_url', 'URL file', false, 'LKPD/MTK001.html', ['url']),
        f('prasyarat_kode', 'Kode prasyarat', false, '', ['prerequisite']),
        f('config_json', 'Config JSON', false, '{}', ['config']),
        f('published_at', 'Waktu terbit', false, '2026-07-15T08:00:00Z', ['published'], 'Wajib bila status active.')
      ]
    },
    soal_asesmen: {
      label: 'Soal Asesmen', icon: 'fa-circle-question', supported: true,
      description: 'Butir soal untuk asesmen/LKPD. Asesmen harus sudah ada; paket beku dilewati.',
      fields: [
        f('asesmen_kode', 'Kode asesmen', true, 'MTK-7-001', ['assessment']),
        f('item_key', 'Kunci item', true, 'k1.hyp', ['key']),
        f('jenis', 'Jenis soal', true, 'num', ['kind'], 'num|mc|bs|match|scaffold|text.'),
        f('kesulitan', 'Kesulitan', false, 'B', ['difficulty'], 'A, B, atau C.'),
        f('soal', 'Teks soal', true, 'Berapa sisi miring 3-4?', ['prompt']),
        f('kunci', 'Kunci jawaban', false, '5', ['answer']),
        f('pilihan', 'Pilihan', false, 'opsi_a|opsi_b', ['options'], 'Pisahkan dengan tanda |.'),
        f('keys', 'Kunci menjodohkan', false, '', ['match_keys'], 'Pisahkan dengan tanda |.'),
        f('answers', 'Jawaban scaffold', false, '', ['scaffold_answers'], 'Angka dipisah koma.'),
        f('weight', 'Bobot', false, '1', ['bobot']),
        f('urutan', 'Urutan', false, '1', ['sort'])
      ]
    },
    bank_soal: {
      label: 'Bank Soal', icon: 'fa-database', supported: true,
      description: 'Pool dan butir bank soal. Pool dibuat otomatis bila belum ada.',
      fields: [
        f('mapel_kode', 'Kode mapel', true, 'MTK', ['mapel', 'subject']),
        f('pool_judul', 'Judul pool', true, 'Bilangan Bulat', ['pool']),
        f('indikator', 'Indikator', false, 'Operasi penjumlahan', ['indicator']),
        f('jenis', 'Jenis soal', true, 'num', ['kind'], 'num|mc|bs|match|scaffold|text.'),
        f('kesulitan', 'Kesulitan', false, 'B', ['difficulty'], 'A, B, atau C.'),
        f('soal', 'Teks soal', true, 'Hasil 12 + 8 = ?', ['prompt']),
        f('kunci', 'Kunci jawaban', false, '20', ['answer']),
        f('pilihan', 'Pilihan', false, '', ['options'], 'Pisahkan dengan tanda |.'),
        f('keys', 'Kunci menjodohkan', false, '', ['match_keys'], 'Pisahkan dengan tanda |.'),
        f('answers', 'Jawaban scaffold', false, '', ['scaffold_answers'], 'Angka dipisah koma.'),
        f('status', 'Status', false, 'active', [], 'draft|active|archived.')
      ]
    },
    nilai_historis: {
      label: 'Nilai Historis', icon: 'fa-table-list', supported: true,
      description: 'Nilai lama per asesmen/siswa. Nilai otomatis (auto) tidak ditimpa.',
      fields: [
        f('tahun_label', 'Tahun pelajaran', true, '2026/2027', ['tahun', 'year']),
        f('kelas_label', 'Kelas', true, '8.F', ['kelas', 'class']),
        f('siswa_username', 'Username siswa', true, 'siswa.ahmad', ['siswa', 'username']),
        f('asesmen_kode', 'Kode asesmen', true, 'MTK-7-001', ['assessment']),
        f('skor', 'Skor', true, '85', ['score']),
        f('max_skor', 'Skor maksimum', false, '100', ['max_score'], 'Default 100.'),
        f('sumber', 'Sumber', false, 'impor', ['source'], 'impor atau manual.'),
        f('catatan', 'Catatan', false, 'Nilai semester ganjil', ['note'])
      ]
    }
  };

  var ORDER = [
    'sekolah', 'tahun_pelajaran', 'kelas', 'mata_pelajaran',
    'guru', 'siswa', 'wali_kelas', 'penugasan_guru', 'keanggotaan_siswa',
    'kategori_siswa_umum', 'kategori_siswa_mapel',
    'modul_materi', 'asesmen', 'soal_asesmen', 'bank_soal', 'nilai_historis'
  ];

  function get(kind) { return TEMPLATES[kind] || null; }
  function list() { return ORDER.map(function (k) { return Object.assign({ kind: k }, TEMPLATES[k]); }); }

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().trim()
      .replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function autoMap(kind, headers) {
    var def = get(kind);
    var mapping = {}, used = {}, missing = [];
    if (!def) return { mapping: mapping, missing: missing };
    var hs = (headers || []).map(function (h) { return { raw: h, n: norm(h) }; });
    def.fields.forEach(function (fd) {
      var candidates = [fd.key].concat(fd.aliases || []).map(norm);
      var hit = hs.filter(function (h) { return !used[h.raw] && candidates.indexOf(h.n) >= 0; })[0];
      if (hit) { mapping[fd.key] = hit.raw; used[hit.raw] = true; }
    });
    def.fields.forEach(function (fd) {
      if (fd.required && !mapping[fd.key]) missing.push(fd.key);
    });
    return { mapping: mapping, missing: missing };
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function templateCsv(kind) {
    var def = get(kind);
    if (!def) return '';
    var head = def.fields.map(function (fd) { return csvCell(fd.key); }).join(',');
    var sample = def.fields.map(function (fd) { return csvCell(fd.example); }).join(',');
    return head + '\r\n' + sample + '\r\n';
  }

  window.ImportSchema = {
    TEMPLATES: TEMPLATES,
    ORDER: ORDER,
    get: get,
    list: list,
    autoMap: autoMap,
    templateCsv: templateCsv,
    csvCell: csvCell
  };
})();
