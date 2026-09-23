/* =====================================================
   perigal-engine-new.js  v1.0
   Engine Perigal KLASIK (pusat) - deterministik
   Hanya untuk potongan melalui pusat b²
   ===================================================== */

function perigalClassic(a, b, viewW, viewH, pad) {
  pad = pad || 20;
  const c = Math.hypot(a, b);
  const h = { x: a / c, y: -b / c };
  const n = { x: b / c, y: a / c };

  const minX = -b, maxX = a + b, minY = -a, maxY = a + b;
  const u = Math.min((viewW - 2 * pad) / (maxX - minX), (viewH - 2 * pad) / (maxY - minY));
  const ox = pad + ((viewW - 2 * pad) - (maxX - minX) * u) / 2 - minX * u;
  const oy = pad + ((viewH - 2 * pad) - (maxY - minY) * u) / 2 + maxY * u;
  const S = (x, y) => ({ x: ox + x * u, y: oy - y * u });

  const B = { x: 0, y: 0 }, A = { x: a, y: 0 }, C = { x: 0, y: b };
  const sqA = [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a, y: -a }, { x: 0, y: -a }];
  const sqB = [{ x: -b, y: 0 }, { x: 0, y: 0 }, { x: 0, y: b }, { x: -b, y: b }];
  const sqC = [C, A, { x: A.x + n.x * c, y: A.y + n.y * c }, { x: C.x + n.x * c, y: C.y + n.y * c }];
  const Wc = { x: (C.x + sqC[2].x) / 2, y: (C.y + sqC[2].y) / 2 };
  const W = { x: Wc.x, y: Wc.y };
  const G = { x: -b / 2, y: b / 2 };

  /* ---------- Utilitas Geometri ---------- */
  function clip(poly, P, m, s) {
    const out = [], v = q => m.x * (q.x - P.x) + m.y * (q.y - P.y);
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], nxt = poly[(i + 1) % poly.length];
      const vc = v(cur), vn = v(nxt);
      const fc = vc === 0 || Math.sign(vc) === s;
      const fn = vn === 0 || Math.sign(vn) === s;
      if (fc) out.push(cur);
      if (fc !== fn) {
        const t = vc / (vc - vn);
        out.push({ x: cur.x + (nxt.x - cur.x) * t, y: cur.y + (nxt.y - cur.y) * t });
      }
    }
    return out;
  }

  function pip(poly, p, eps) {
    eps = eps || 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      const len = Math.hypot(xj - xi, yj - yi) || 1;
      const cr = (xj - xi) * (p.y - yi) - (yj - yi) * (p.x - xi);
      if (Math.abs(cr) / len <= eps &&
          p.x >= Math.min(xi, xj) - eps && p.x <= Math.max(xi, xj) + eps &&
          p.y >= Math.min(yi, yj) - eps && p.y <= Math.max(yi, yj) + eps) return true;
    }
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if ((yi > p.y) !== (yj > p.y) &&
          p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }

  function area(poly) {
    let s = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    return Math.abs(s / 2);
  }

  function centroid(poly) {
    let x = 0, y = 0;
    poly.forEach(p => { x += p.x; y += p.y; });
    return { x: x / poly.length, y: y / poly.length };
  }

  /* ---------- Potong b² jadi 4 irisan ---------- */
  const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const pieces = [];
  for (const [sH, sN] of signs) {
    let poly = clip(sqB.slice(), G, n, sN);
    poly = clip(poly, G, h, sH);
    if (poly.length < 3 || area(poly) < 1e-9) continue;
    const K = centroid(poly);
    const sx = Math.sign(K.x - G.x) || 1;
    const sy = Math.sign(K.y - G.y) || 1;
    pieces.push({
      poly,
      K,
      t: { x: W.x + (a / 2) * sx - K.x, y: W.y + (a / 2) * sy - K.y }
    });
  }

  /* ---------- Verifikasi ---------- */
  const inner = [
    { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
    { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y + a / 2 }
  ];
  const moved = pieces.map(pc => pc.poly.map(p => ({ x: p.x + pc.t.x, y: p.y + pc.t.y })));

  let ok = true;
  // Cek semua irisan di dalam c²
  for (const m of moved) {
    for (const p of m) {
      if (!pip(sqC, p, 1e-7)) { ok = false; break; }
    }
    if (!ok) break;
  }

  // Cek total luas = b²
  const totalArea = moved.reduce((s, m) => s + area(m), 0);
  if (Math.abs(totalArea - b * b) > 1e-6) ok = false;

  // Cek tidak overlap (sederhana: cek centroid tidak di irisan lain)
  if (ok) {
    for (let i = 0; i < moved.length && ok; i++) {
      const ci = centroid(moved[i]);
      for (let j = 0; j < moved.length && ok; j++) {
        if (i !== j && pip(moved[j], ci, 1e-6)) ok = false;
      }
    }
  }

  if (ok) console.log('✅ PERIGAL KLASIK OK (' + a + ',' + b + ')');
  else console.warn('⚠️ PERIGAL KLASIK GAGAL (' + a + ',' + b + ')');

  const tA = { x: W.x - a / 2, y: W.y + a / 2 };
  const map = poly => poly.map(P => S(P.x, P.y));

  return {
    a, b, c, u, S, valid: ok,
    tri: map([B, A, C]),
    sqA: map(sqA), sqB: map(sqB), sqC: map(sqC), inner: map(inner),
    pieces: pieces.map(pc => ({ poly: map(pc.poly), t: { x: pc.t.x * u, y: -pc.t.y * u } })),
    tA: { x: tA.x * u, y: -tA.y * u },
    cut1: [S(G.x - h.x * b * 2, G.y - h.y * b * 2), S(G.x + h.x * b * 2, G.y + h.y * b * 2)],
    cut2: [S(G.x - n.x * b * 2, G.y - n.y * b * 2), S(G.x + n.x * b * 2, G.y + n.y * b * 2)],
    labels: {
      a: S(a / 2, 0.6), b: S(-0.9, b / 2),
      c: S(a / 2 + n.x * 0.8, b / 2 + n.y * 0.8),
      b2: S(-b / 2, b / 2), a2: S(a / 2, -a / 2),
      c2: S(W.x + n.x * 1.2, W.y + n.y * 1.2)
    }
  };
}

window.perigalClassic = perigalClassic;
