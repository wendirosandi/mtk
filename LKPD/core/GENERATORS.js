/**
 * GENERATORS.js — Registry generator per materi
 * Dipakai oleh: MTK005.html (runtime), Bank_soal.html (audit), print (cetak)
 */
window.GENERATORS = (function() {
  'use strict';
  const $ = s => document.querySelector(s);
  const R = window.LKPD_RENDER;
  const S = window.LKPD_SVG;
  const SC = window.LKPD_SCORING;
  const PICK = a => a[Math.floor(Math.random() * a.length)];
  const RI = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

  // ===== PENGECOH CERDAS untuk soal akar =====
  function smartAlts(key) {
    const out = [];
    const m = String(key).match(/^(\d+)\\sqrt\{(\d+)\}$/);   // bentuk c√r
    if (m) {
      const c = +m[1], r = +m[2];
      out.push((c + 2) + '\\sqrt{' + r + '}');
      if (c > 2) out.push((c - 2) + '\\sqrt{' + r + '}');
      out.push(c + '\\sqrt{' + (r + 1) + '}');
      out.push((c * 2) + '\\sqrt{' + r + '}');
    } else if (/\\sqrt/.test(key) && /[+-]/.test(key)) {      // binomial akar
      out.push(key.includes('-') ? key.replace('-', '+') : key.replace('+', '-'));
      out.push(key.replace(/(\d+)\\sqrt\{/, (mm, d) => (2 * +d) + '\\sqrt{'));
      out.push(key.replace(/\\sqrt\{(\d+)\}/, (mm, r) => '\\sqrt{' + (+r + 2) + '}'));
    } else {
      const n = +key;                                          // bilangan bulat
      if (!isNaN(n)) {
        out.push(String(n + 5), String(n * 2), n + '\\sqrt{2}', String(n - 5 > 0 ? n - 5 : n + 10));
      }
    }
    // unik & tidak sama dengan kunci
    const seen = [key], res = [];
    out.forEach(a => { if (a && a !== key && !seen.includes(a)) { seen.push(a); res.push(a); } });
    return res.slice(0, 3);
  }

  function buildMCFromPool(materi, diff, opts = {}) {
    const src = window.DATA_POOL[materi];
    const pool = (src && src.pool && src.pool[DK(diff)]) || [];
    if (!pool.length) return fallbackMC();
    const item = PICK(pool);

    // ambil alts valid, lengkapi dengan pengecoh cerdas bila kurang
    let alts = (item.alts || []).filter(a => a && a !== item.key);
    if (alts.length < 3) alts = alts.concat(smartAlts(item.key).slice(0, 3 - alts.length));

    const options = [{ val: item.key, correct: true }];
    alts.slice(0, 3).forEach(a => options.push({ val: a, correct: false }));
    while (options.length < 4) options.push({ val: item.key + '\\,', correct: false });
    return { type: 'mc', tex: item.t, options: shuffle(options), total: 1 };
  }

  const reg = {
    // m011 pangkat (render)
    genPangkatMC: d => {
      const p = PICK([2, 3, 5]); const e1 = RI(2, 4), e2 = RI(1, 3), e3 = RI(1, 4); const N = e1 * e2 + e3;
      const key = p + '^{' + N + '}';
      const alts = [p + '^{' + (N + 1) + '}', p + '^{' + (N - 1) + '}', p + '^{' + (N + 2) + '}'];
      return { type: 'mc', tex: '(' + p + '^{' + e1 + '})^{' + e2 + '}\\times ' + p + '^{' + e3 + '}', options: shuffle([{ val: key, correct: true }, ...alts.map(a => ({ val: a, correct: false }))]), total: 1 };
    },
    // m012 baku (render)
    genBakuMC: d => {
      const mant = RI(1, 9) + '.' + RI(10, 99); const n = RI(3, 7); const val = Math.round(parseFloat(mant) * Math.pow(10, n));
      const key = mant + '\\times 10^{' + n + '}';
      const alts = [(parseFloat(mant) * 10).toFixed(1) + '\\times 10^{' + (n - 1) + '}', (parseFloat(mant) / 10).toFixed(2) + '\\times 10^{' + (n + 1) + '}', parseFloat(mant).toFixed(1) + '\\times 10^{' + (n + 1) + '}'];
      return { type: 'mc', tex: String(val), options: shuffle([{ val: key, correct: true }, ...alts.map(a => ({ val: a, correct: false }))]), total: 1 };
    },
    // m013 akar
    genAkarMC: d => buildMCFromPool('m013', d),
    // m014 rasionalisasi kartu
    genRasionalKartu: d => {
      const pool = window.DATA_POOL.m014.pool[d] || [];
      if (!pool.length) return null;
      return { type: 'kartu', item: PICK(pool) };
    },
    // m021a variasi rumus BS
    genRumusBS: d => {
      const correct = { C: ['a²+b²=c²', 'c=√(a²+b²)'], B: ['a²+c²=b²', 'b=√(a²+c²)'], A: ['b²+c²=a²', 'a=√(b²+c²)'] };
      const verts = ['A', 'B', 'C']; const items = [];
      for (let i = 0; i < 10; i++) { const V = PICK(verts); const ok = i < 5; const F = ok ? PICK(correct[V]) : PICK(correct[PICK(verts.filter(x => x !== V))]); items.push({ V, F, ok }); }
      return { type: 'bs', items: shuffle(items), total: 10 };
    },
    // m022 jenis segitiga
    genJenisSegitiga: d => {
      const pool = window.DATA_POOL.m022.pool[d] || window.DATA_POOL.m022.pool.M;
      const rows = []; for (let i = 0; i < 10; i++) rows.push(PICK(pool));
      return { type: 't5', rows, total: 40 };
    },
    // m023 gabungan
    genGabungan: d => {
      const pool = window.DATA_POOL.m023.pool[d] || window.DATA_POOL.m023.pool.M;
      const item = PICK(pool);
      const svgFn = { F1: S.buildF1, F2: S.buildF2, F3: S.buildF3, F4: S.buildF4, F5: S.buildF4 }[item.fig];
      const svg = svgFn ? svgFn(...item.seed) : '';
      const questions = item.labels.map(l => ({ label: l, options: genOpts(l, item.seed) }));
      return { type: questions.length === 3 ? 'mc3' : 'mc2', svg, questions, total: questions.length };
    }
  };

  function genOpts(label, seed) {
    const base = seed[seed.length - 1];
    const correct = base;
    const alts = [base + 2, base - 2, base + 5];
    return shuffle([{ val: correct, correct: true }, ...alts.map(a => ({ val: a, correct: false }))]);
  }

  return { registry: reg, get: name => reg[name] || null };
})();