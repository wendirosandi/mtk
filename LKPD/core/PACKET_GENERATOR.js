/**
 * PACKET_GENERATOR.js — Builder paket cetak deterministik (60 kombinasi)
 * Seed dari string "KODE|kelas|paket|kategori" → siswa & kunci selalu identik
 */
window.PACKET = (function() {
  'use strict';

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) { return function() { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const PICK = a => a[Math.floor(Math.random() * a.length)];
  const r6 = v => Math.round(v * 1e6) / 1e6;

  const K1_PAT = { A: ['M','S','U','U','S','U'], B: ['M','M','S','S','S','U'], C: ['M','M','M','S','S','U'] };

  function kodePaket(kelas, paket, kategori) {
    const k = kelas.replace('.', '');
    return `${CFG.KODE_PREFIX}-${k}-${paket}${kategori}`; // M005-8A-1A
  }

  // ===== BUILDER (dipakai mode siswa & kunci) =====
  function buildPaket(kelas, paket, kategori) {
    const seed = fnv1a(`${CFG.KODE_PREFIX}|${kelas}|${paket}|${kategori}`);
    const old = Math.random; Math.random = mulberry32(seed);
    const pkg = { kode: kodePaket(kelas, paket, kategori), kelas, paket, kategori };

    // --- Keg 1: 6 kartu + 4 B/S ---
    const pat = K1_PAT[kategori];
    const cards = pat.map(diff => PICK(DATA_POOL.m014.pool[diff]));
    const vals = cards.map(c => c.v);
    const minI = vals.indexOf(Math.min(...vals)), maxI = vals.indexOf(Math.max(...vals));
    const L = 'ABCDEF';
    const bsPool = [
      { txt: `Hasil Kartu ${L[minI]} paling kecil.`, ok: true },
      { txt: `Hasil Kartu ${L[maxI]} paling besar.`, ok: true },
      { txt: `Hasil Kartu ${L[minI]} paling besar.`, ok: false },
      { txt: `Hasil Kartu ${L[maxI]} paling kecil.`, ok: false }
    ];
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
      bsPool.push({ txt: `Hasil Kartu ${L[a]} > Kartu ${L[b]}.`, ok: vals[a] > vals[b] });
      bsPool.push({ txt: `Selisih Kartu ${L[a]} & ${L[b]} < 1.`, ok: Math.abs(vals[a] - vals[b]) < 1 });
    }
    pkg.k1 = { cards, bs: shuffleArr(bsPool).slice(0, 4) };

    // --- Keg 2: 1 seed F7 ---
    const k2pool = (DATA_POOL.K2 && DATA_POOL.K2.pool[kategori]) || DATA_POOL.m023.k2[kategori];
    pkg.k2 = { seed: PICK(k2pool) };

    // --- Kuis Q1-Q10 via GENERATORS ---
    const G = GENERATORS.registry;
    pkg.kuis = {
      q1: arr(() => G.genPangkatMC(diffOf(kategori)), 6),
      q2: arr(() => G.genAkarMC(diffOf(kategori)), 6),
      q3: arr(() => G.genBakuMC(diffOf(kategori)), 4),
      q4: G.genRumusBS(diffOf(kategori)),
      q5: G.genJenisSegitiga(diffOf(kategori)),
      q6: G.genGabungan('M'), q7: G.genGabungan('M'), q8: G.genGabungan('S'), q9: G.genGabungan('S'), q10: G.genGabungan('U')
    };

    Math.random = old;
    return pkg;
  }
  const diffOf = k => ({ A: 3, B: 2, C: 1 }[k] || 1);
  const arr = (fn, n) => { const r = []; for (let i = 0; i < n; i++) r.push(fn()); return r; };
  function shuffleArr(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

  return { buildPaket, kodePaket, fnv1a };
})();