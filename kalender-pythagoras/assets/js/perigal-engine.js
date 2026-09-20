/* =====================================================
   perigal-engine.js  v2  (solver translasi numerik)
   perigalGeometry(a, b, offset, viewW, viewH, pad)
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
    const W  = { x: Wc.x + off.p * h.x + off.q * n.x,
                 y: Wc.y + off.p * h.y + off.q * n.y };
    const Gc = { x: -b / 2, y: b / 2 };
    const G  = { x: Gc.x + off.p * h.x + off.q * n.x,
                 y: Gc.y + off.p * h.y + off.q * n.y };

    /* ---- clip half-plane (Sutherland–Hodgman 1 garis) ---- */
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

    /* ---- util uji titik ---- */
    function pip(poly, p, eps) {           // inside-or-on (eps toleransi)
        let ok = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if (Math.abs((yj - yi) * (p.x - xi) - (xj - xi) * (p.y - yi)) < eps &&
                Math.min(xi, xj) - eps <= p.x && p.x <= Math.max(xi, xj) + eps &&
                Math.min(yi, yj) - eps <= p.y && p.y <= Math.max(yi, yj) + eps) return true;
        }
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if ((yi > p.y) !== (yj > p.y) &&
                p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) ok = !ok;
        }
        return ok;
    }
    const near = (p, q, eps) => Math.hypot(p.x - q.x, p.y - q.y) < eps;

    /* ---- persegi dalam a² (axis-aligned, pusat W) ---- */
    const inner = [
        { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
        { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y + a / 2 }];

    /* ---- 4 slice + SOLVER translasi ---- */
    const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const eps = 1e-6 * Math.max(1, b);
    const pieces = signs.map(([sH, sN]) => {
        let poly = clip(sqB.slice(), G, h, sH);
        poly = clip(poly, G, n, sN);
        const K = sqB.find(P2 =>
            Math.sign(h.x * (P2.x - G.x) + h.y * (P2.y - G.y)) === sH &&
            Math.sign(n.x * (P2.x - G.x) + n.y * (P2.y - G.y)) === sN);

        /* cari sudut c² tujuan: G harus mendarat di sudut inner & slice muat */
        let t = null;
        for (const Z of sqC) {
            const cand = { x: Z.x - K.x, y: Z.y - K.y };
            const G2 = { x: G.x + cand.x, y: G.y + cand.y };
            if (!inner.some(Q => near(Q, G2, 1e-6 * b + 1e-9))) continue;
            const moved = poly.map(p => ({ x: p.x + cand.x, y: p.y + cand.y }));
            const okAll = moved.every(p => pip(sqC, p, 1e-6 * b + 1e-9) && !pip(inner, p, -1e-9) ||
                                           pip(sqC, p, 1e-6 * b + 1e-9));
            const okOut = moved.every(p => pip(sqC, p, 1e-6 * b + 1e-9));
            const okNotIn = moved.every(p => !pip(inner, p, 0) ||
                                           inner.some(Q => near(Q, p, 1e-6 * b + 1e-9)) ||
                                           Math.abs(p.x - W.x) >= a / 2 - 1e-6 ||
                                           Math.abs(p.y - W.y) >= a / 2 - 1e-6);
            if (okAll && okOut && okNotIn) { t = cand; break; }
        }
        if (!t) t = { x: W.x - G.x, y: W.y - G.y };   // fallback aman
        return { poly, t };
    });

    const tA = { x: W.x - a / 2, y: W.y + a / 2 };    // translasi persegi a²

    const map = poly => poly.map(P => S(P.x, P.y));
    return {
        a, b, c, u, S,
        tri: map([B, A, C]),
        sqA: map(sqA), sqB: map(sqB), sqC: map(sqC), inner: map(inner),
        pieces: pieces.map(pc => ({ poly: map(pc.poly),
                                    t: { x: pc.t.x * u, y: -pc.t.y * u } })),
        tA: { x: tA.x * u, y: -tA.y * u },
        cut1: [S(G.x - h.x * b * 2, G.y - h.y * b * 2), S(G.x + h.x * b * 2, G.y + h.y * b * 2)],
        cut2: [S(G.x - n.x * b * 2, G.y - n.y * b * 2), S(G.x + n.x * b * 2, G.y + n.y * b * 2)],
        G: S(G.x, G.y), W: S(W.x, W.y),
        labels: {
            a: S(a / 2, 0.6), b: S(-0.9, b / 2),
            c: S(a / 2 + n.x * 0.8, b / 2 + n.y * 0.8),
            b2: S(-b / 2, b / 2), a2: S(a / 2, -a / 2),
            c2: S(Wc.x + n.x * 1.2, Wc.y + n.y * 1.2)
        }
    };
}
window.perigalGeometry = perigalGeometry;
