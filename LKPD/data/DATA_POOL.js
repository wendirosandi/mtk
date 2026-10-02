/**
 * DATA_POOL.js — Pool soal per MATERI (bukan per kegiatan/kuis)
 * v2.0 — setiap materi punya kode (m011..m024), dipakai banyak LKPD
 */
window.DATA_POOL = {

  // ===== m011 BILANGAN BERPANGKAT =====
  m011: {
    judul: 'Bilangan Berpangkat',
    sumber: 'render', // generator mengisi saat audit/runtime
    pool: { M: [], S: [], U: [] },
    gen: ['genPangkatMC'],
    figure: null,
    penjelasan: 'a^m×a^n=a^(m+n); (a^m)^n=a^(m·n); a^m÷a^n=a^(m−n)'
  },

  // ===== m012 BENTUK BAKU =====
  m012: {
    judul: 'Bentuk Baku (Notasi Ilmiah)',
    sumber: 'render',
    pool: { M: [], S: [], U: [] },
    gen: ['genBakuMC'],
    figure: null,
    penjelasan: 'Bentuk baku a×10^n dengan 1≤a<10, n bilangan bulat'
  },

  // ===== m013 BENTUK AKAR =====
  m013: {
    judul: 'Bentuk Akar',
    sumber: 'pool',
    pool: {
      M: [
        { t: '4\\sqrt{2}+3\\sqrt{8}-5\\sqrt{16}', key: '10\\sqrt{2}-20', alts: ['10\\sqrt{2}-20'] },
        { t: '8\\sqrt{5}-4\\sqrt{5}+2\\sqrt{20}', key: '8\\sqrt{5}', alts: [] },
        { t: '\\sqrt{27}-\\sqrt{12}+\\sqrt{48}', key: '5\\sqrt{3}', alts: [] }
      ],
      S: [
        { t: '4\\sqrt{96}+3\\sqrt{24}-4\\sqrt{54}', key: '10\\sqrt{6}', alts: [] },
        { t: '3\\sqrt{8}\\times 5\\sqrt{6}', key: '60\\sqrt{3}', alts: [] }
      ],
      U: [
        { t: '\\frac{6\\sqrt{32}}{3\\sqrt{4}}', key: '4\\sqrt{2}', alts: [] },
        { t: '\\frac{3\\sqrt{5}\\times 5\\sqrt{10}}{3\\sqrt{2}}', key: '25', alts: [] }
      ]
    },
    gen: ['genAkarMC'],
    figure: null,
    penjelasan: 'Sederhanakan radikal, samakan radicand, lalu jumlahkan koefisien'
  },

  // ===== m014 RASIONALISASI (Kartu K1) =====
  m014: {
    judul: 'Rasionalisasi Penyebut',
    sumber: 'pool',
    pool: {
      M: [
        { t: '\\frac{6}{3\\sqrt{2}}', tpl: '\\sqrt{0}', k: [2], v: 1.414 },
        { t: '\\frac{9}{3\\sqrt{3}}', tpl: '\\sqrt{0}', k: [3], v: 1.732 },
        { t: '\\frac{10}{2\\sqrt{5}}', tpl: '\\sqrt{0}', k: [5], v: 2.236 },
        { t: '\\frac{14}{2\\sqrt{7}}', tpl: '\\sqrt{0}', k: [7], v: 2.646 },
        { t: '\\frac{8}{2\\sqrt{2}}', tpl: '{0}\\sqrt{1}', k: [2, 2], v: 2.828 },
        { t: '\\frac{12}{3\\sqrt{6}}', tpl: '\\frac{{0}\\sqrt{1}}{{2}}', k: [2, 6, 3], v: 1.633 }
      ],
      S: [
        { t: '\\frac{5}{2+\\sqrt{3}}', tpl: '{0}-{1}\\sqrt{2}', k: [10, 5, 3], v: 1.340 },
        { t: '\\frac{6}{3+\\sqrt{3}}', tpl: '{0}-{1}\\sqrt{2}', k: [3, 1, 3], v: 1.268 },
        { t: '\\frac{4}{\\sqrt{6}-2}', tpl: '{0}\\sqrt{1}+{2}', k: [2, 6, 4], v: 8.899 },
        { t: '\\frac{2}{3-\\sqrt{5}}', tpl: '\\frac{{0}+{1}\\sqrt{2}}{{3}}', k: [3, 1, 5, 2], v: 2.618 }
      ],
      U: [
        { t: '\\frac{6}{\\sqrt{3}+\\sqrt{2}}', tpl: '{0}\\sqrt{1}-{2}\\sqrt{3}', k: [6, 3, 6, 2], v: 1.902 },
        { t: '\\frac{4}{\\sqrt{7}-\\sqrt{3}}', tpl: '{0}\\sqrt{1}+{2}\\sqrt{3}', k: [1, 7, 1, 3], v: 4.378 },
        { t: '\\frac{8}{3\\sqrt{2}+\\sqrt{10}}', tpl: '{0}\\sqrt{1}-{2}\\sqrt{3}', k: [3, 2, 1, 10], v: 1.081 }
      ]
    },
    gen: ['genRasionalKartu'],
    figure: null,
    penjelasan: 'Kalikan pembilang & penyebut dengan sekawan penyebut'
  },
  // ===== K2: BUKIT & TEROWONGAN (F7) — dipakai MTK005 & PACKET_GENERATOR =====
  K2: {
    pool: {
      C: [[30, 25, 7], [20, 15, 9], [25, 17, 8]],
      B: [[30, 25, 7], [20, 15, 9], [25, 17, 8], [15, 13, 5], [40, 25, 7], [17, 10, 6]],
      A: [[30, 25, 7], [20, 15, 9], [25, 17, 8], [15, 13, 5], [40, 25, 7], [17, 10, 6],
          [3, 2.5, 0.7], [2.5, 1.7, 0.8], [1.5, 1.3, 0.5], [2, 1.5, 0.9]]
    }
  },
  // ===== m021 TEOREMA PYTHAGORAS (pembuktian) =====
  m021: { judul: 'Teorema Pythagoras (Pembuktian)', sumber: 'render', pool: { M: [], S: [], U: [] }, gen: ['genPythagorasDasar'], figure: 'Figure ABC', penjelasan: 'c²=a²+b² untuk siku-siku di C' },

  // ===== m021a VARIASI RUMUS =====
  m021a: {
    judul: 'Variasi Rumus Pythagoras',
    sumber: 'render',
    pool: { M: [], S: [], U: [] },
    gen: ['genRumusBS'],
    figure: 'Figure ABC',
    penjelasan: 'Turunan: a=√(c²−b²), b=√(c²−a²), c=√(a²+b²)'
  },

  // ===== m022 JENIS SEGITIGA =====
  m022: {
    judul: 'Jenis Segitiga',
    sumber: 'pool',
    pool: {
      M: [
        { s: [3, 4, 5], ans: 'siku' }, { s: [6, 8, 10], ans: 'siku' }, { s: [5, 12, 13], ans: 'siku' },
        { s: [4, 5, 6], ans: 'lancip' }, { s: [6, 7, 8], ans: 'lancip' },
        { s: [3, 4, 6], ans: 'tumpul' }, { s: [5, 6, 9], ans: 'tumpul' }
      ],
      S: [
        { s: [9, 12, 15], ans: 'siku' }, { s: [10, 12, 14], ans: 'lancip' }, { s: [8, 12, 17], ans: 'tumpul' }
      ],
      U: [
        { s: [2.4, 4.5, 5.1], ans: 'siku' }, { s: [4.5, 5.5, 6.5], ans: 'lancip' }, { s: [2, 3, 4.5], ans: 'tumpul' }
      ]
    },
    gen: ['genJenisSegitiga'],
    figure: null,
    penjelasan: 'Banding kuadrat sisi terpanjang dengan jumlah kuadrat dua sisi lain'
  },

  // ===== m022a JENIS SEGITIGA (B/S) — cabang =====
  m022a: { judul: 'Jenis Segitiga (Benar/Salah)', sumber: 'render', pool: { M: [], S: [], U: [] }, gen: ['genJenisBS'], figure: null, penjelasan: 'Varian B/S dari m022' },

  // ===== m023 PYTHAGORAS SEGITIGA GABUNGAN =====
  m023: {
    judul: 'Pythagoras Segitiga Gabungan',
    sumber: 'pool',
    pool: {
      M: [
        { fig: 'F1', seed: [12, 9, 15, 8, 17], labels: ['AC', 'AD'] },
        { fig: 'F2', seed: [8, 10, 5, 13, 6, 12, 6], labels: ['BE', 'BD', 'ED'] },
        { fig: 'F3', seed: [5, 13, 35, 12, 37], labels: ['v', 'x'] }
      ],
      S: [
        { fig: 'F1', seed: [3, 4, 5, 12, 13], labels: ['AC', 'AD'] },
        { fig: 'F4', seed: [12, 9, 15, 17, 8], labels: ['AC', 'CD'] },
        { fig: 'F5', seed: [5, 6, 4], labels: ['t', 'alas/2'] }
      ],
      U: [
        { fig: 'F1', seed: [1.2, 0.9, 1.5, 0.8, 1.7], labels: ['AC', 'AD'] },
        { fig: 'F5', seed: [1.3, 1.6, 1.2], labels: ['t', 'alas/2'] }
      ]
    },
    gen: ['genGabungan'],
    figure: ['F1', 'F2', 'F3', 'F4', 'F5'],
    penjelasan: 'Terapkan Pythagoras berantai pada segitiga gabungan'
  },

  // ===== m023a PYTHAGORAS PERSEGI =====
  m023a: { judul: 'Pythagoras Persegi', sumber: 'render', pool: { M: [], S: [], U: [] }, gen: ['genPersegi'], figure: 'Persegi', penjelasan: 'Diagonal persegi = s√2' },

  // ===== m024 SEGITIGA ISTIMEWA =====
  m024: { judul: 'Segitiga Istimewa', sumber: 'render', pool: { M: [], S: [], U: [] }, gen: ['genIstimewa'], figure: '30-60-90 / 45-45-90', penjelasan: 'Rasio 30-60-90 = 1:√3:2; 45-45-90 = 1:1:√2' },

  // ===== m015a/b PENERAPAN =====
  m015a: { judul: 'Penerapan Bentuk Pangkat', sumber: 'render', pool: { M: [], S: [], U: [] }, gen: ['genPenerapanPangkat'], figure: null, penjelasan: 'Soal cerita kontekstual pangkat' },
  m015b: { judul: 'Penerapan Bentuk Akar', sumber: 'render', pool: { M: [], S: [], U: [] }, gen: ['genPenerapanAkar'], figure: null, penjelasan: 'Soal cerita kontekstual akar' }
};