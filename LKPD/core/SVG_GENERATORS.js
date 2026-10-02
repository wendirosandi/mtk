/**
 * SVG_GENERATORS.js — Generate SVG geometris (segitiga, poligon, label)
 * Bagian dari arsitektur LKPD v2.0 (shell tipis + modul core)
 */

window.LKPD_SVG = (function() {
  'use strict';

  const r6 = v => Math.round(v * 1e6) / 1e6;
  const fmtN = v => String(r6(v));

  // ===== FIT POINTS ke viewBox =====
  function fitPts(pts, W = 320, H = 200, pad = 34) {
    if (!pts || pts.length === 0) return (x, y) => [W / 2, H / 2];
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const minx = Math.min(...xs);
    const maxx = Math.max(...xs);
    const miny = Math.min(...ys);
    const maxy = Math.max(...ys);
    const bw = Math.max(maxx - minx, 1e-6);
    const bh = Math.max(maxy - miny, 1e-6);
    const s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
    const tx = (W - bw * s) / 2 - minx * s;
    const ty = (H - bh * s) / 2 - miny * s;
    return (x, y) => [r6(x * s + tx), r6(y * s + ty)];
  }

  // ===== TANDA SIKU-SIKU (right-angle mark) =====
  function raMark(V, P, Q, u = 1) {
    const d1 = [P[0] - V[0], P[1] - V[1]];
    const d2 = [Q[0] - V[0], Q[1] - V[1]];
    const n1 = Math.hypot(d1[0], d1[1]);
    const n2 = Math.hypot(d2[0], d2[1]);
    if (n1 === 0 || n2 === 0) return [];
    const a = [d1[0] / n1 * u, d1[1] / n1 * u];
    const b = [d2[0] / n2 * u, d2[1] / n2 * u];
    return [
      [V[0] + a[0], V[1] + a[1]],
      [V[0] + a[0] + b[0], V[1] + a[1] + b[1]],
      [V[0] + b[0], V[1] + b[1]]
    ];
  }

  // ===== MIDPOINT =====
  function mid(P, Q, ox = 0, oy = 0) {
    return [(P[0] + Q[0]) / 2 + ox, (P[1] + Q[1]) / 2 + oy];
  }

  // ===== SVG BUILD (generic) =====
  function svgBuild(sh) {
    const pts = [];
    (sh.lines || []).forEach(l => {
      pts.push([l.p[0], l.p[1]], [l.p[2], l.p[3]]);
    });
    (sh.polys || []).forEach(pl => {
      pl.pts.forEach(p => pts.push(p));
    });
    (sh.marks || []).forEach(m => {
      m.forEach(p => pts.push(p));
    });
    (sh.dots || []).forEach(d => {
      pts.push([d.x, d.y]);
    });
    const T = fitPts(pts);
    let out = '';
    
    // Poligon
    (sh.polys || []).forEach(pl => {
      const points = pl.pts.map(p => T(p[0], p[1]).join(',')).join(' ');
      out += `<polygon points="${points}" fill="${pl.fill || 'rgba(13,148,136,.08)'}" stroke="${pl.stroke || '#cbd5e1'}" stroke-width="1.5"/>`;
    });
    
    // Garis
    (sh.lines || []).forEach(l => {
      const [x1, y1] = T(l.p[0], l.p[1]);
      const [x2, y2] = T(l.p[2], l.p[3]);
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${l.stroke || '#0f766e'}" stroke-width="${l.w || 3}" ${l.dash ? 'stroke-dasharray="4,4"' : ''}/>`;
    });
    
    // Tanda (marks)
    (sh.marks || []).forEach(m => {
      const points = m.map(p => T(p[0], p[1]).join(',')).join(' ');
      out += `<polyline points="${points}" fill="none" stroke="#64748b" stroke-width="1.5"/>`;
    });
    
    // Titik (dots)
    (sh.dots || []).forEach(d => {
      const [cx, cy] = T(d.x, d.y);
      out += `<circle cx="${cx}" cy="${cy}" r="5" fill="${d.c || '#0f766e'}"/>`;
    });
    
    // Label
    (sh.labels || []).forEach(l => {
      const [x, y] = T(l.x, l.y);
      const X = x + (l.ox || 0);
      const Y = y + (l.oy || 0);
      out += `<text x="${X}" y="${Y}" font-size="${l.size || 10}" font-weight="bold" fill="${l.c || '#0f172a'}" text-anchor="${l.anchor || 'middle'}">${l.t}</text>`;
    });
    
    return `<svg width="320" height="200" viewBox="0 0 320 200">${out}</svg>`;
  }

  // ===== KELUARGA FIGURE F (segitiga gabungan) =====
  
  // F7: Bukit & Terowongan (template tetap, ukuran bervariasi)
  function buildF7(ea, ed, od) {
    const eo = Math.sqrt(ed * ed - od * od);
    const ao = Math.sqrt(ea * ea - eo * eo);
    const ad = ao + od;
    const A = [0, 0];
    const O = [ao, 0];
    const D = [ad, 0];
    const E = [ao, -eo];
    
    return svgBuild({
      lines: [
        { p: [...A, ...D], stroke: '#334155', w: 2.5 },
        { p: [...O, ...E], stroke: '#e11d48', w: 2.5, dash: 1 },
        { p: [...A, ...E], stroke: '#0284c7', w: 2.5 },
        { p: [...E, ...D], stroke: '#0284c7', w: 2.5 }
      ],
      polys: [{ pts: [A, E, D] }],
      marks: [raMark(O, E, D, Math.min(eo, od) * 0.1)],
      dots: [
        { x: A[0], y: A[1] },
        { x: O[0], y: O[1] },
        { x: D[0], y: D[1] },
        { x: E[0], y: E[1] }
      ],
      labels: [
        { x: ao * 0.45, y: -eo / 2, t: fmtN(ea) + ' m', c: '#0284c7' },
        { x: (ao + ad) / 2, y: -eo / 2, t: fmtN(ed) + ' m', c: '#0284c7' },
        { x: (ao + ad) / 2, y: 2.5, t: fmtN(od) + ' m', c: '#0284c7' },
        { x: ao - 1.5, y: -eo / 2, t: 'EO', c: '#64748b' },
        { x: A[0] - 1, y: A[1] + 3, t: 'A' },
        { x: O[0], y: O[1] + 3, t: 'O' },
        { x: D[0] + 1, y: D[1] + 3, t: 'D' },
        { x: E[0], y: E[1] - 2, t: 'E' }
      ]
    });
  }

  // F1: Rantai 2 segitiga (siku di B, lalu di C)
  function buildF1(ab, bc, ac, cd, ad) {
    const ux = -bc / ac;
    const uy = -ab / ac;
    const px = -uy;
    const py = ux;
    const dx = bc + px * cd;
    const dy = py * cd;
    
    return svgBuild({
      lines: [
        { p: [0, 0, 0, -ab] },
        { p: [0, 0, bc, 0] },
        { p: [0, -ab, bc, 0] },
        { p: [bc, 0, dx, dy] },
        { p: [0, -ab, dx, dy], dash: 1, stroke: '#e11d48', w: 2.5 }
      ],
      polys: [{ pts: [[0, 0], [0, -ab], [bc, 0]] }],
      marks: [
        raMark([0, 0], [0, -ab], [bc, 0], Math.min(ab, bc) * 0.15),
        raMark([bc, 0], [0, -ab], [dx, dy], cd * 0.18)
      ],
      dots: [
        { x: 0, y: -ab },
        { x: 0, y: 0 },
        { x: bc, y: 0 },
        { x: dx, y: dy, c: '#e11d48' }
      ],
      labels: [
        { x: 0, y: -ab / 2, t: fmtN(ab), c: '#0284c7', ox: -16 },
        { x: bc / 2, y: 0, t: fmtN(bc), c: '#0284c7', oy: 14 },
        { x: (bc + dx) / 2, y: dy / 2, t: fmtN(cd), c: '#0284c7', ox: 12 },
        { x: 0, y: -ab, t: 'A', ox: -8, oy: -6 },
        { x: 0, y: 0, t: 'B', ox: -8, oy: 12 },
        { x: bc, y: 0, t: 'C', ox: 2, oy: 12 },
        { x: dx, y: dy, t: 'D', ox: 10 }
      ]
    });
  }

  // F2: Selisih 2 segitiga (B,E,D segaris)
  function buildF2(ae, ab, dc, bc, be, bd, ed) {
    return svgBuild({
      lines: [
        { p: [0, 0, bd, 0], stroke: '#334155', w: 2.5 },
        { p: [be, 0, be, -ae] },
        { p: [bd, 0, bd, -dc] },
        { p: [be, -ae, 0, 0], stroke: '#0284c7', w: 2.5 },
        { p: [bd, -dc, 0, 0], stroke: '#0284c7', w: 2.5 }
      ],
      marks: [
        raMark([be, 0], [0, 0], [be, -ae], Math.min(ae, be) * 0.15),
        raMark([bd, 0], [0, 0], [bd, -dc], Math.min(dc, bd) * 0.15)
      ],
      dots: [
        { x: 0, y: 0 },
        { x: be, y: 0 },
        { x: bd, y: 0 },
        { x: be, y: -ae },
        { x: bd, y: -dc }
      ],
      labels: [
        { x: be / 2, y: 0, t: fmtN(be), c: '#0284c7', oy: 14 },
        { x: (be + bd) / 2, y: 0, t: fmtN(ed), c: '#e11d48', oy: 14 },
        { x: be, y: -ae / 2, t: fmtN(ae), c: '#0284c7', ox: 10 },
        { x: bd, y: -dc / 2, t: fmtN(dc), c: '#0284c7', ox: 10 },
        { x: 0, y: 0, t: 'B', ox: -8, oy: 12 },
        { x: be, y: 0, t: 'E', oy: 26 },
        { x: bd, y: 0, t: 'D', ox: 8, oy: 26 },
        { x: be, y: -ae, t: 'A', ox: -8, oy: -6 },
        { x: bd, y: -dc, t: 'C', ox: 8, oy: -6 }
      ]
    });
  }

  // F3: Dua segitiga berbagi sisi tegak
  function buildF3(t, m, a, v, x) {
    return svgBuild({
      lines: [
        { p: [0, 0, t, 0] },
        { p: [t, 0, t, v], dash: 1, stroke: '#64748b', w: 2 },
        { p: [t, v, t + a, v] },
        { p: [0, 0, t, v], stroke: '#0284c7', w: 2.5 },
        { p: [t, 0, t + a, v], stroke: '#e11d48', w: 2.5, dash: 1 }
      ],
      marks: [
        raMark([t, 0], [0, 0], [t, v], Math.min(t, v) * 0.2),
        raMark([t, v], [t, 0], [t + a, v], Math.min(v, a) * 0.15)
      ],
      dots: [
        { x: 0, y: 0 },
        { x: t, y: 0 },
        { x: t, y: v },
        { x: t + a, y: v, c: '#e11d48' }
      ],
      labels: [
        { x: t / 2, y: 0, t: fmtN(t), c: '#0284c7', oy: -8 },
        { x: t, y: v / 2, t: 'v', c: '#64748b', ox: -10 },
        { x: t / 2, y: v / 2, t: fmtN(m), c: '#0284c7', ox: -12 },
        { x: t + a / 2, y: v, t: fmtN(a), c: '#0284c7', oy: 14 },
        { x: 0, y: 0, t: 'L', ox: -8, oy: 12 },
        { x: t, y: 0, t: 'T', ox: 6, oy: 12 },
        { x: t, y: v, t: 'M', ox: -8, oy: 12 },
        { x: t + a, y: v, t: 'R', ox: 10, oy: 10 }
      ]
    });
  }

  // F4: Segitiga sama kaki
  function buildF4(sl, b, t) {
    return svgBuild({
      lines: [
        { p: [0, 0, b, 0] },
        { p: [0, 0, b / 2, -t] },
        { p: [b / 2, -t, b, 0] },
        { p: [b / 2, -t, b / 2, 0], dash: 1, stroke: '#64748b', w: 2 }
      ],
      polys: [{ pts: [[0, 0], [b, 0], [b / 2, -t]] }],
      marks: [raMark([b / 2, 0], [0, 0], [b / 2, -t], Math.min(b / 2, t) * 0.15)],
      dots: [
        { x: 0, y: 0 },
        { x: b, y: 0 },
        { x: b / 2, y: -t }
      ],
      labels: [
        { x: b * 0.25, y: -t / 2, t: fmtN(sl), c: '#0284c7', ox: -14 },
        { x: b * 0.75, y: -t / 2, t: fmtN(sl), c: '#0284c7', ox: 14 },
        { x: b / 2, y: 0, t: fmtN(b), c: '#0284c7', oy: 14 },
        { x: 0, y: 0, t: 'A', ox: -8, oy: 12 },
        { x: b, y: 0, t: 'B', ox: 8, oy: 12 },
        { x: b / 2, y: -t, t: 'P', oy: -8 }
      ]
    });
  }

  // ===== PUBLIC API =====
  return {
    r6,
    fmtN,
    fitPts,
    raMark,
    mid,
    svgBuild,
    buildF7,
    buildF1,
    buildF2,
    buildF3,
    buildF4
  };
})();