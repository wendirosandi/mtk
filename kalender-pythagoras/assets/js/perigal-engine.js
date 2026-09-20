/* =====================================================
   perigal-engine.js  v8
   Solver ANALITIK: W' diselesaikan dari persamaan linear
   kesejajaran garis potong (9–36 kombinasi, murah & eksak).
   Tidak ada pencarian buta, tidak ada fallback salah.
   ===================================================== */
function perigalPresets(a, b) {
    const m = 0.12 * Math.min(a, b - a);
    const Omin = a - b + m, Omax = -m, Mmin = a + m, Mmax = b - m;
    return {
        0: { xO: (a - b) / 2, yM: (a + b) / 2, label: '⊕ Pusat' },
        1: { xO: Omin, yM: Mmin, label: '1: O− M−' },
        2: { xO: Omin, yM: Mmax, label: '2: O− M+' },
        3: { xO: Omax, yM: Mmax, label: '3: O+ M+' },
        4: { xO: Omax, yM: Mmin, label: '4: O+ M−' }
    };
}
window.perigalPresets = perigalPresets;

function perigalGeometry(a, b, cfg, viewW, viewH, pad) {
    pad = pad || 20;
    const c = Math.hypot(a, b);
    const h = { x: a / c, y: -b / c };
    const n = { x: b / c, y: a / c };

    const minX = -b, maxX = a + b, minY = -a, maxY = a + b;
    const u = Math.min((viewW - 2 * pad) / (maxX - minX),
                       (viewH - 2 * pad) / (maxY - minY));
    const ox = pad + ((viewW - 2 * pad) - (maxX - minX) * u) / 2 - minX * u;
    const oy = pad + ((viewH - 2 * pad) - (maxY - minY) * u) / 2 + maxY * u;
    const S = (x, y) => ({ x: ox + x * u, y: oy - y * u });

    const B = { x: 0, y: 0 }, A = { x: a, y: 0 }, C = { x: 0, y: b };
    const sqA = [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a, y: -a }, { x: 0, y: -a }];
    const sqB = [{ x: -b, y: 0 }, { x: 0, y: 0 }, { x: 0, y: b }, { x: -b, y: b }];
    const sqC = [C, A,
        { x: A.x + n.x * c, y: A.y + n.y * c },
        { x: C.x + n.x * c, y: C.y + n.y * c }];
    const Opp = { x: C.x + n.x * c, y: C.y + n.y * c };

    /* ---- util ---- */
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
                out.push({ x: cur.x + (nxt.x - cur.x) * t,
                           y: cur.y + (nxt.y - cur.y) * t });
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
        return s / 2;
    }
    const cross = (v, w) => v.x * w.y - v.y * w.x;

    /* ---- titik potong P dari O & M ---- */
    const O = { x: cfg.xO, y: 0 }, M = { x: 0, y: cfg.yM };
    const s = -(cfg.xO * n.y + n.x * cfg.yM);
    const P = { x: O.x + s * h.x, y: O.y + s * h.y };

    /* ---- 4 slice ---- */
    const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const pieces = [];
    for (const [sH, sN] of signs) {
        let poly = clip(sqB.slice(), P, n, sN);
        poly = clip(poly, P, h, sH);
        if (poly.length < 3 || Math.abs(area(poly)) < 1e-9)
            return { valid: false, degraded: true };
        const K = sqB.find(P2 => pip(poly, P2, 1e-6 * b));
        if (!K) return { valid: false, degraded: true };
        let cx = 0, cy = 0;
        poly.forEach(p => { cx += p.x; cy += p.y; });
        cx /= poly.length; cy /= poly.length;
        const sigma = { x: Math.sign(cx - K.x), y: Math.sign(cy - K.y) };
        pieces.push({ poly, K, sigma, konst: { x: (a / 2) * sigma.x - K.x,
                                              y: (a / 2) * sigma.y - K.y } });
    }

    /* ---- sampel verifikasi ---- */
    const target = Math.abs(area(sqC)) - a * a;
    function makeSamples(W) {
        const inner = [
            { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
            { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y + a / 2 }];
        const out = [], step = c / 34, tol = 0.012 * c;
        const distSeg = (p, p1, p2) => {
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(p.x - (p1.x + dx * t), p.y - (p1.y + dy * t));
        };
        for (let x = minX; x <= maxX; x += step)
            for (let y = minY; y <= maxY; y += step) {
                const p = { x, y };
                if (!pip(sqC, p, 0) || pip(inner, p, 0)) continue;
                let dO = Infinity, dI = Infinity;
                for (let i = 0, j = sqC.length - 1; i < sqC.length; j = i++)
                    dO = Math.min(dO, distSeg(p, sqC[j], sqC[i]));
                for (let i = 0, j = inner.length - 1; i < inner.length; j = i++)
                    dI = Math.min(dI, distSeg(p, inner[j], inner[i]));
                if (dO < tol || dI < tol) continue;
                out.push(p);
            }
        return { samples: out, inner };
    }
    function verify(W) {
        const { samples, inner } = makeSamples(W);
        if (!samples.length) return null;
        const moved = pieces.map(pc =>
            pc.poly.map(p => ({ x: p.x + W.x + pc.konst.x, y: p.y + W.y + pc.konst.y })));
        for (const m of moved)
            for (const p of m)
                if (!pip(sqC, p, 1e-7 * c)) return null;
        for (const p of samples) {
            let cnt = 0;
            for (const m of moved) if (pip(m, p, 0)) cnt++;
            if (cnt !== 1) return null;
        }
        return { moved, inner };
    }

    /* ---- solver analitik W' ---- */
    const pairings = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    const par = (v, w) => Math.abs(cross(v, w)) < 1e-9;
    let solved = null;
    for (const hp of pairings) for (const np of pairings) {
        if (!par({ x: pieces[hp[0][0]].konst.x - pieces[hp[0][1]].konst.x,
                   y: pieces[hp[0][0]].konst.y - pieces[hp[0][1]].konst.y }, h)) continue;
        if (!par({ x: pieces[hp[1][0]].konst.x - pieces[hp[1][1]].konst.x,
                   y: pieces[hp[1][0]].konst.y - pieces[hp[1][1]].konst.y }, h)) continue;
        if (!par({ x: pieces[np[0][0]].konst.x - pieces[np[0][1]].konst.x,
                   y: pieces[np[0][0]].konst.y - pieces[np[0][1]].konst.y }, n)) continue;
        if (!par({ x: pieces[np[1][0]].konst.x - pieces[np[1][1]].konst.x,
                   y: pieces[np[1][0]].konst.y - pieces[np[1][1]].konst.y }, n)) continue;
        for (const hBase of [C, Opp]) for (const nBase of [C, A]) {
            const i = hp[0][0], k = np[0][0];
            const r1 = cross({ x: hBase.x - P.x - pieces[i].konst.x,
                               y: hBase.y - P.y - pieces[i].konst.y }, h);
            const r2 = cross({ x: nBase.x - P.x - pieces[k].konst.x,
                               y: nBase.y - P.y - pieces[k].konst.y }, n);
            const W = { x: -n.x * r1 + h.x * r2, y: -n.y * r1 + h.y * r2 };
            const res = verify(W);
            if (res) { solved = { W, ...res }; break; }
        }
        if (solved) break;
    }
    if (!solved) return { valid: false, degraded: true };

    const { W, inner } = solved;
    pieces.forEach(pc => pc.t = { x: W.x + pc.konst.x, y: W.y + pc.konst.y });
    const tA = { x: W.x - a / 2, y: W.y + a / 2 };

    console.log('✅ TILING EKSAK (Perigal ' + a + ',' + b +
                ' | O=' + cfg.xO.toFixed(2) + ' M=' + cfg.yM.toFixed(2) +
                ' | W′=' + W.x.toFixed(2) + ',' + W.y.toFixed(2) + ')');

    const map = poly => poly.map(P2 => S(P2.x, P2.y));
    return {
        a, b, c, u, S, valid: true, degraded: false, W, P,
        tri: map([B, A, C]),
        sqA: map(sqA), sqB: map(sqB), sqC: map(sqC), inner: map(inner),
        pieces: pieces.map(pc => ({ poly: map(pc.poly),
                                    t: { x: pc.t.x * u, y: -pc.t.y * u } })),
        tA: { x: tA.x * u, y: -tA.y * u },
        cut1: [S(P.x - h.x * b * 2, P.y - h.y * b * 2), S(P.x + h.x * b * 2, P.y + h.y * b * 2)],
        cut2: [S(P.x - n.x * b * 2, P.y - n.y * b * 2), S(P.x + n.x * b * 2, P.y + n.y * b * 2)],
        G: S(P.x, P.y), Ws: S(W.x, W.y),
        labels: {
            a: S(a / 2, 0.6), b: S(-0.9, b / 2),
            c: S(a / 2 + n.x * 0.8, b / 2 + n.y * 0.8),
            b2: S(-b / 2, b / 2), a2: S(a / 2, -a / 2),
            c2: S((C.x + Opp.x) / 2 + n.x * 1.2, (C.y + Opp.y) / 2 + n.y * 1.2)
        }
    };
}
window.perigalGeometry = perigalGeometry;
