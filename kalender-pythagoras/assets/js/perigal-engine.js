/* =====================================================
   perigal-engine.js  v6
   - Solver 256-kombinasi (Kᵢ → Qⱼ) untuk offset apa pun
   - Auto-clamp ke offset sah jika melebihi jendela
   - Men返回 geometri + offset aktual (setelah clamp)
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
    function polysOverlap(p1, p2) {
        for (const p of p1) if (pip(p2, p, 1e-6)) return true;
        for (const p of p2) if (pip(p1, p, 1e-6)) return true;
        return false;
    }

    /* Fungsi inti: cari tiling untuk offset (p,q) tertentu.
       Kembalikan { pieces, tA, W } atau null jika gagal. */
    function trySolve(pOff, qOff) {
        const o = { x: pOff * h.x + qOff * n.x, y: pOff * h.y + qOff * n.y };
        const P = { x: Gc.x + o.x, y: Gc.y + o.y };
        const W = { x: Wc.x + o.x, y: Wc.y + o.y };

        /* 4 slice */
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

        /* 4 sudut persegi dalam */
        const Qs = [
            { x: W.x + a / 2, y: W.y - a / 2 },
            { x: W.x + a / 2, y: W.y + a / 2 },
            { x: W.x - a / 2, y: W.y + a / 2 },
            { x: W.x - a / 2, y: W.y - a / 2 }
        ];

        /* Area c² − a² (harus = b²) */
        const targetArea = Math.abs(area(sqC)) - a * a;

        /* Solver: coba 256 kombinasi */
        function verify(ts) {
            const moved = pieces.map((pc, i) =>
                pc.poly.map(p => ({ x: p.x + ts[i].x, y: p.y + ts[i].y })));
            /* semua slice harus di dalam c² */
            for (const m of moved)
                for (const p of m)
                    if (!pip(sqC, p, 1e-6 * b)) return false;
            /* tidak ada overlap antar slice */
            for (let i = 0; i < 4; i++)
                for (let j = i + 1; j < 4; j++)
                    if (polysOverlap(moved[i], moved[j])) return false;
            /* Σ luas harus = targetArea (toleransi) */
            const sumArea = moved.reduce((s, m) => s + Math.abs(area(m)), 0);
            if (Math.abs(sumArea - targetArea) > 1e-4 * targetArea) return false;
            return true;
        }

        let solution = null;
        for (let c1 = 0; c1 < 4 && !solution; c1++)
        for (let c2 = 0; c2 < 4 && !solution; c2++)
        for (let c3 = 0; c3 < 4 && !solution; c3++)
        for (let c4 = 0; c4 < 4 && !solution; c4++) {
            const ts = [
                { x: Qs[c1].x - pieces[0].K.x, y: Qs[c1].y - pieces[0].K.y },
                { x: Qs[c2].x - pieces[1].K.x, y: Qs[c2].y - pieces[1].K.y },
                { x: Qs[c3].x - pieces[2].K.x, y: Qs[c3].y - pieces[2].K.y },
                { x: Qs[c4].x - pieces[3].K.x, y: Qs[c4].y - pieces[3].K.y }
            ];
            if (verify(ts)) solution = ts;
        }

        if (!solution) return null;

        const tA = { x: W.x - a / 2, y: W.y + a / 2 };
        pieces.forEach((pc, i) => pc.t = solution[i]);
        return { pieces, tA, W, P };
    }

    /* Auto-clamp: jika gagal, binary search ke arah (0,0) */
    let result = trySolve(off.p, off.q);
    let actualOff = { ...off };
    if (!result) {
        let lo = 0, hi = 1;
        for (let iter = 0; iter < 20 && !result; iter++) {
            const mid = (lo + hi) / 2;
            const testOff = { p: off.p * mid, q: off.q * mid };
            result = trySolve(testOff.p, testOff.q);
            if (result) {
                actualOff = testOff;
            } else {
                hi = mid;
            }
        }
        if (!result) {
            /* fallback absolut: mode pusat */
            result = trySolve(0, 0);
            actualOff = { p: 0, q: 0 };
        }
    }

    const { pieces, tA, W, P } = result;

    /* Garis potong */
    const cut1 = [S(P.x - h.x * b * 2, P.y - h.y * b * 2),
                  S(P.x + h.x * b * 2, P.y + h.y * b * 2)];
    const cut2 = [S(P.x - n.x * b * 2, P.y - n.y * b * 2),
                  S(P.x + n.x * b * 2, P.y + n.y * b * 2)];

    const inner = [
        { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
        { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y + a / 2 }];

    const map = poly => poly.map(P2 => S(P2.x, P2.y));

    /* SELF-TEST */
    console.log('✅ TILING OK (Perigal ' + a + ',' + b + ', offset=' +
                actualOff.p.toFixed(2) + ',' + actualOff.q.toFixed(2) + ')');

    return {
        a, b, c, u, S, actualOff,
        tri: map([B, A, C]),
        sqA: map(sqA), sqB: map(sqB), sqC: map(sqC), inner: map(inner),
        pieces: pieces.map(pc => ({
            poly: map(pc.poly),
            t: { x: pc.t.x * u, y: -pc.t.y * u }
        })),
        tA: { x: tA.x * u, y: -tA.y * u },
        cut1, cut2,
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
