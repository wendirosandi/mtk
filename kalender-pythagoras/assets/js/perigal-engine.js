/* =====================================================
   perigal-engine.js  v8.2
   - Verifier EKSAK: luas irisan (tanpa grid sampling)
   - Rantai solusi: analitik preset → DFS(P cfg) → DFS(klasik) → outline
   - DIJAMIN mengembalikan objek lengkap (tidak pernah crash)
   ===================================================== */
function perigalPresets(a, b) {
    const m = 0.12 * Math.min(a, b - a);
    return {
        0: { xO: (a - b) / 2, yM: (a + b) / 2, label: '⊕ Pusat' },
        1: { xO: a - b + m, yM: a + m, label: '1: O− M−' },
        2: { xO: a - b + m, yM: b - m, label: '2: O− M+' },
        3: { xO: -m,        yM: b - m, label: '3: O+ M+' },
        4: { xO: -m,        yM: a + m, label: '4: O+ M−' }
    };
}
window.perigalPresets = perigalPresets;

function perigalGeometry(a, b, cfg, viewW, viewH, pad) {
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
    const Opp = sqC[2];
    const Wc = { x: (C.x + Opp.x) / 2, y: (C.y + Opp.y) / 2 };
    const Gc = { x: -b / 2, y: b / 2 };
    const ring = c * c - a * a;
    const tol = 1e-6 * ring;

    /* ---------- util ---------- */
    function clip(poly, P, m, s) {
        const out = [], v = q => m.x * (q.x - P.x) + m.y * (q.y - P.y);
        for (let i = 0; i < poly.length; i++) {
            const cur = poly[i], nxt = poly[(i + 1) % poly.length];
            const vc = v(cur), vn = v(nxt);
            const fc = vc === 0 || Math.sign(vc) === s, fn = vn === 0 || Math.sign(vn) === s;
            if (fc) out.push(cur);
            if (fc !== fn) { const t = vc / (vc - vn);
                out.push({ x: cur.x + (nxt.x - cur.x) * t, y: cur.y + (nxt.y - cur.y) * t }); }
        }
        return out;
    }
    function pip(poly, p, eps) {
        eps = eps || 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            const len = Math.hypot(xj - xi, yj - yi) || 1;
            const cr = (xj - xi) * (p.y - yi) - (yj - yi) * (p.x - xi);
            if (Math.abs(cr) / len <= eps && p.x >= Math.min(xi, xj) - eps &&
                p.x <= Math.max(xi, xj) + eps && p.y >= Math.min(yi, yj) - eps &&
                p.y <= Math.max(yi, yj) + eps) return true;
        }
        let ins = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) ins = !ins;
        }
        return ins;
    }
    function area(poly) { let s = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
            s += poly[j].x * poly[i].y - poly[i].x * poly[j].y; return s / 2; }
    function centroid(poly) { let x = 0, y = 0;
        poly.forEach(p => { x += p.x; y += p.y; }); return { x: x / poly.length, y: y / poly.length }; }
    function clipHalf(poly, P, m, s) {
        const out = [], f = q => (m.x * (q.x - P.x) + m.y * (q.y - P.y)) * s;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const cur = poly[i], prev = poly[j];
            const fc = f(cur), fp = f(prev);
            if (fc >= 0) out.push(cur);
            if ((fc > 0) !== (fp > 0)) { const t = fp / (fp - fc);
                out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t }); }
        }
        return out;
    }
    function interArea(Ap, Bp) {
        let out = Ap.slice(); const cb = centroid(Bp);
        for (let i = 0, j = Bp.length - 1; i < Bp.length && out.length; j = i++) {
            const P = Bp[j], Q = Bp[i];
            const m = { x: -(Q.y - P.y), y: Q.x - P.x };
            const s = (m.x * (cb.x - P.x) + m.y * (cb.y - P.y)) > 0 ? 1 : -1;
            out = clipHalf(out, P, m, s);
        }
        return out.length ? Math.abs(area(out)) : 0;
    }
    const cross = (v, w) => v.x * w.y - v.y * w.x;
    const innerOf = W => [
        { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
        { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y + a / 2 }];

    /* ---------- verifier EKSAK (tanpa grid) ---------- */
    function okCombo(moved, inner) {
        let sum = 0;
        for (const m of moved) {
            for (const p of m) if (!pip(sqC, p, 1e-7 * c)) return false;
            if (interArea(m, inner) > tol) return false;
            sum += Math.abs(area(m));
        }
        for (let i = 0; i < moved.length; i++)
            for (let j = i + 1; j < moved.length; j++)
                if (interArea(moved[i], moved[j]) > tol) return false;
        return Math.abs(sum - ring) <= tol * 8;
    }

    function buildPieces(P) {
        const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
        const pieces = [];
        for (const [sH, sN] of signs) {
            let poly = clip(sqB.slice(), P, n, sN);
            poly = clip(poly, P, h, sH);
            if (poly.length < 3 || Math.abs(area(poly)) < 1e-9) return null;
            const K = sqB.find(P2 => pip(poly, P2, 1e-6 * b));
            if (!K) return null;
            let cx = 0, cy = 0; poly.forEach(p => { cx += p.x; cy += p.y; });
            cx /= poly.length; cy /= poly.length;
            pieces.push({ poly, K, konst: { x: (a / 2) * (Math.sign(cx - K.x) || 1) - K.x,
                                            y: (a / 2) * (Math.sign(cy - K.y) || 1) - K.y } });
        }
        return pieces;
    }

    /* DFS 256 kombinasi K→sudut-inner dengan W tetap */
    function dfsFixedW(pieces, W) {
        const inner = innerOf(W), Qs = inner;
        let sol = null;
        (function rec(i, ts, moved) {
            if (sol) return;
            if (i === pieces.length) { if (okCombo(moved, inner)) sol = ts.slice(); return; }
            for (let q = 0; q < 4; q++) {
                const t = { x: Qs[q].x - pieces[i].K.x, y: Qs[q].y - pieces[i].K.y };
                const m = pieces[i].poly.map(p => ({ x: p.x + t.x, y: p.y + t.y }));
                ts.push(t); moved.push(m);
                rec(i + 1, ts, moved);
                ts.pop(); moved.pop();
                if (sol) return;
            }
        })(0, [], []);
        return sol ? { W, inner, ts: sol } : null;
    }

    /* Analitik: W dari kesejajaran garis potong */
    function analyticPreset(pieces, P) {
        const pairings = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
        const par = (v, w) => Math.abs(cross(v, w)) < 1e-9;
        const d = (i, j) => ({ x: pieces[i].konst.x - pieces[j].konst.x,
                               y: pieces[i].konst.y - pieces[j].konst.y });
        for (const hp of pairings) for (const np of pairings) {
            if (!par(d(hp[0][0], hp[0][1]), h) || !par(d(hp[1][0], hp[1][1]), h)) continue;
            if (!par(d(np[0][0], np[0][1]), n) || !par(d(np[1][0], np[1][1]), n)) continue;
            for (const hB of [C, Opp]) for (const nB of [C, A]) {
                const i = hp[0][0], k = np[0][0];
                const r1 = cross({ x: hB.x - P.x - pieces[i].konst.x, y: hB.y - P.y - pieces[i].konst.y }, h);
                const r2 = cross({ x: nB.x - P.x - pieces[k].konst.x, y: nB.y - P.y - pieces[k].konst.y }, n);
                const W = { x: -n.x * r1 + h.x * r2, y: -n.y * r1 + h.y * r2 };
                const inner = innerOf(W);
                const moved = pieces.map(pc => pc.poly.map(p =>
                    ({ x: p.x + W.x + pc.konst.x, y: p.y + W.y + pc.konst.y })));
                if (okCombo(moved, inner))
                    return { W, inner, ts: moved && pieces.map(pc =>
                        ({ x: W.x + pc.konst.x, y: W.y + pc.konst.y })) };
            }
        }
        return null;
    }

    /* ---------- rantai solusi ---------- */
    const Pcfg = (() => { const s = -(cfg.xO * n.y + n.x * cfg.yM);
        return { x: cfg.xO + s * h.x, y: s * h.y }; })();
    let pieces = buildPieces(Pcfg);
    let sol = pieces && (analyticPreset(pieces, Pcfg) || dfsFixedW(pieces, Wc));
    let mode = sol ? (cfg.xO === Gc.x && cfg.yM === Gc.y ? 'pusat' : 'preset') : null;
    if (!sol) { pieces = buildPieces(Gc); sol = pieces && dfsFixedW(pieces, Wc); mode = 'klasik'; }

    const map = poly => poly.map(P2 => S(P2.x, P2.y));
    const baseOut = extra => Object.assign({
        a, b, c, u, S,
        tri: map([B, A, C]), sqA: map(sqA), sqB: map(sqB), sqC: map(sqC),
        labels: {
            a: S(a / 2, 0.6), b: S(-0.9, b / 2),
            c: S(a / 2 + n.x * 0.8, b / 2 + n.y * 0.8),
            b2: S(-b / 2, b / 2), a2: S(a / 2, -a / 2), c2: S(Wc.x + n.x * 1.2, Wc.y + n.y * 1.2)
        }
    }, extra);

    if (!sol) {   /* jalur outline: objek lengkap, pieces kosong → halaman aman */
        console.warn('⚠️ Perigal: konfigurasi tanpa solusi → mode outline (' + a + ',' + b + ')');
        return baseOut({ valid: false, degraded: true, pieces: [], inner: map(innerOf(Wc)),
            tA: { x: 0, y: 0 }, W: Wc, P: Pcfg,
            cut1: [S(Pcfg.x - h.x * b * 2, Pcfg.y - h.y * b * 2), S(Pcfg.x + h.x * b * 2, Pcfg.y + h.y * b * 2)],
            cut2: [S(Pcfg.x - n.x * b * 2, Pcfg.y - n.y * b * 2), S(Pcfg.x + n.x * b * 2, Pcfg.y + n.y * b * 2)],
            G: S(Pcfg.x, Pcfg.y), Ws: S(Wc.x, Wc.y) });
    }

    const { W, inner, ts } = sol;
    pieces.forEach((pc, i) => pc.t = ts[i]);
    console.log('✅ TILING EKSAK (' + mode + ') Perigal ' + a + ',' + b +
                ' | W′=' + W.x.toFixed(2) + ',' + W.y.toFixed(2));
    return baseOut({
        valid: true, degraded: false, mode, W, P: Pcfg,
        inner: map(inner),
        pieces: pieces.map(pc => ({ poly: map(pc.poly), t: { x: pc.t.x * u, y: -pc.t.y * u } })),
        tA: { x: (W.x - a / 2) * u, y: -(W.y + a / 2) * u },
        cut1: [S(Pcfg.x - h.x * b * 2, Pcfg.y - h.y * b * 2), S(Pcfg.x + h.x * b * 2, Pcfg.y + h.y * b * 2)],
        cut2: [S(Pcfg.x - n.x * b * 2, Pcfg.y - n.y * b * 2), S(Pcfg.x + n.x * b * 2, Pcfg.y + n.y * b * 2)],
        G: S(Pcfg.x, Pcfg.y), Ws: S(W.x, W.y)
    });
}
window.perigalGeometry = perigalGeometry;
