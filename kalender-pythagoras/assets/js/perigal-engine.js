/* =====================================================
   perigal-engine.js  v6.1
   - Cek overlap via LUAS IRISAN konveks (aman utk tepi berimpit)
   - Rantai fallback: model W=WC+o → W=WC → binary-search → sign-rule
   - DIJAMIN tidak pernah return null
   ===================================================== */
function perigalGeometry(a, b, off, viewW, viewH, pad) {
    off = off || { p: 0, q: 0 };
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
    const Wc = { x: (C.x + sqC[2].x) / 2, y: (C.y + sqC[2].y) / 2 };
    const Gc = { x: -b / 2, y: b / 2 };
    const add = (P, o) => ({ x: P.x + o.x, y: P.y + o.y });
    const oVec = (p, q) => ({ x: p * h.x + q * n.x, y: p * h.y + q * n.y });

    /* ---------- util ---------- */
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
    function centroid(poly) {
        let x = 0, y = 0;
        poly.forEach(p => { x += p.x; y += p.y; });
        return { x: x / poly.length, y: y / poly.length };
    }
    function clipHalf(poly, P, m, s) {
        const out = [], f = q => (m.x * (q.x - P.x) + m.y * (q.y - P.y)) * s;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const cur = poly[i], prev = poly[j];
            const fc = f(cur), fp = f(prev);
            if (fc >= 0) out.push(cur);
            if ((fc > 0) !== (fp > 0)) {
                const t = fp / (fp - fc);
                out.push({ x: prev.x + (cur.x - prev.x) * t,
                           y: prev.y + (cur.y - prev.y) * t });
            }
        }
        return out;
    }
    /* luas irisan dua poligon konveks (0 untuk tepi berimpit) */
    function interArea(Ap, Bp) {
        let out = Ap.slice();
        const cb = centroid(Bp);
        for (let i = 0, j = Bp.length - 1; i < Bp.length && out.length; j = i++) {
            const P = Bp[j], Q = Bp[i];
            const m = { x: -(Q.y - P.y), y: Q.x - P.x };
            const s = (m.x * (cb.x - P.x) + m.y * (cb.y - P.y)) > 0 ? 1 : -1;
            out = clipHalf(out, P, m, s);
        }
        return out.length ? Math.abs(area(out)) : 0;
    }

    const target = Math.abs(area(sqC)) - a * a;   // = b²

    function buildPieces(P) {
        const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
        const pieces = [];
        for (const [sH, sN] of signs) {
            let poly = clip(sqB.slice(), P, h, sH);
            poly = clip(poly, P, n, sN);
            if (poly.length < 3 || Math.abs(area(poly)) < 1e-9) return null;
            const K = sqB.find(P2 => pip(poly, P2, 1e-6 * b));
            if (!K) return null;
            pieces.push({ poly, K });
        }
        const sum = pieces.reduce((s, pc) => s + Math.abs(area(pc.poly)), 0);
        if (Math.abs(sum - target) > 1e-4 * target) return null;
        return pieces;
    }

    function verify(pieces, ts, inner) {
        const moved = pieces.map((pc, i) =>
            pc.poly.map(p => ({ x: p.x + ts[i].x, y: p.y + ts[i].y })));
        for (const m of moved)
            for (const p of m)
                if (!pip(sqC, p, 1e-7 * c)) return false;
        for (const m of moved)
            if (interArea(m, inner) > 1e-6 * target) return false;
        for (let i = 0; i < 4; i++)
            for (let j = i + 1; j < 4; j++)
                if (interArea(moved[i], moved[j]) > 1e-6 * target) return false;
        return true;
    }

    function trySolve(P, W) {
        const pieces = buildPieces(P);
        if (!pieces) return null;
        const inner = [
            { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
            { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y - a / 2 }];
        const Qs = inner;
        let solution = null;
        for (let c1 = 0; c1 < 4 && !solution; c1++)
        for (let c2 = 0; c2 < 4 && !solution; c2++)
        for (let c3 = 0; c3 < 4 && !solution; c3++)
        for (let c4 = 0; c4 < 4 && !solution; c4++) {
            const ts = [
                { x: Qs[c1].x - pieces[0].K.x, y: Qs[c1].y - pieces[0].K.y },
                { x: Qs[c2].x - pieces[1].K.x, y: Qs[c2].y - pieces[1].K.y },
                { x: Qs[c3].x - pieces[2].K.x, y: Qs[c3].y - pieces[2].K.y },
                { x: Qs[c4].x - pieces[3].K.x, y: Qs[c4].y - pieces[3].K.y }];
            if (verify(pieces, ts, inner)) solution = ts;
        }
        if (!solution) return null;
        pieces.forEach((pc, i) => pc.t = solution[i]);
        return { pieces, inner, W, P };
    }

    /* ---------- rantai solusi ---------- */
    let result = trySolve(add(Gc, oVec(off.p, off.q)), add(Wc, oVec(off.p, off.q)));
    let actualOff = { ...off };
    if (!result) {
        result = trySolve(add(Gc, oVec(off.p, off.q)), Wc);
        if (result) console.info('ℹ️ Perigal: model W=pusat');
    }
    if (!result) {
        let lo = 0, hi = 1, best = null, bestOff = { p: 0, q: 0 };
        for (let it = 0; it < 14; it++) {
            const mid = (lo + hi) / 2;
            const o2 = oVec(off.p * mid, off.q * mid);
            const r = trySolve(add(Gc, o2), add(Wc, o2)) || trySolve(add(Gc, o2), Wc);
            if (r) { best = r; bestOff = { p: off.p * mid, q: off.q * mid }; lo = mid; }
            else hi = mid;
        }
        result = best; actualOff = bestOff;
        if (result) console.info('ℹ️ Perigal: offset di-clamp ke (' +
            bestOff.p.toFixed(2) + ',' + bestOff.q.toFixed(2) + ')');
    }
    let degraded = false;
    if (!result) {   /* jaminan terakhir: sign-rule klasik di pusat */
        degraded = true; actualOff = { p: 0, q: 0 };
        const pieces = buildPieces(Gc);
        pieces.forEach(pc => {
            const sx = Math.sign(pc.K.x - Gc.x), sy = Math.sign(pc.K.y - Gc.y);
            pc.t = { x: Wc.x + (a / 2) * sx - pc.K.x, y: Wc.y + (a / 2) * sy - pc.K.y };
        });
        result = { pieces, W: Wc, P: Gc,
            inner: [{ x: Wc.x - a / 2, y: Wc.y - a / 2 }, { x: Wc.x + a / 2, y: Wc.y - a / 2 },
                    { x: Wc.x + a / 2, y: Wc.y + a / 2 }, { x: Wc.x - a / 2, y: Wc.y - a / 2 }] };
        console.warn('⚠️ Perigal: mode degradasi (sign-rule)');
    }

    const { pieces, inner, W, P } = result;
    const tA = { x: W.x - a / 2, y: W.y + a / 2 };

    if (!degraded) console.log('✅ TILING OK (Perigal ' + a + ',' + b +
        ' | offset ' + actualOff.p.toFixed(2) + ',' + actualOff.q.toFixed(2) + ')');

    const map = poly => poly.map(P2 => S(P2.x, P2.y));
    return {
        a, b, c, u, S, actualOff, degraded,
        tri: map([B, A, C]),
        sqA: map(sqA), sqB: map(sqB), sqC: map(sqC), inner: map(inner),
        pieces: pieces.map(pc => ({ poly: map(pc.poly),
                                    t: { x: pc.t.x * u, y: -pc.t.y * u } })),
        tA: { x: tA.x * u, y: -tA.y * u },
        cut1: [S(P.x - h.x * b * 2, P.y - h.y * b * 2), S(P.x + h.x * b * 2, P.y + h.y * b * 2)],
        cut2: [S(P.x - n.x * b * 2, P.y - n.y * b * 2), S(P.x + n.x * b * 2, P.y + n.y * b * 2)],
        G: S(P.x, P.y), W: S(W.x, W.y),
        labels: {
            a: S(a / 2, 0.6), b: S(-0.9, b / 2),
            c: S(a / 2 + n.x * 0.8, b / 2 + n.y * 0.8),
            b2: S(-b / 2, b / 2), a2: S(a / 2, -a / 2),
            c2: S(Wc.x + n.x * 1.2, Wc.y + n.y * 1.2)
        }
    };
}
window.perigalGeometry = perigalGeometry;
