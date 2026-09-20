/* =====================================================
   perigal-engine.js
   Geometri Diseksi Perigal (slice fleksibel) parameterik:
   perigalGeometry(a, b, offset, viewW, viewH, pad)
   - Potong b² dg 2 garis (∥ & ⊥ hipotenusa) melalui pusat G
   - 4 slice + persegi a² ber-TRANSLASI murni ke c²
   - offset {p,q} = geser slice & posisi a² di dalam c²
   ===================================================== */
function perigalGeometry(a, b, off, viewW, viewH, pad) {
    off = off || { p: 0, q: 0 };
    pad = pad || 20;
    const c = Math.hypot(a, b);
    const h = { x: a / c, y: -b / c };          // arah hipotenusa (C→A), koordinat math
    const n = { x: b / c, y: a / c };           // normal luar

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
    const W = { x: Wc.x + off.p * h.x + off.q * n.x,
                y: Wc.y + off.p * h.y + off.q * n.y };      // pusat a² di dalam c²
    const Gc = { x: -b / 2, y: b / 2 };
    const G = { x: Gc.x + off.p * h.x + off.q * n.x,
                y: Gc.y + off.p * h.y + off.q * n.y };      // pusat potongan b²

    /* clip polygon Sutherland–Hodgman satu half-plane */
    function clip(poly, P, m, s) {
        const out = [];
        const v = q => m.x * (q.x - P.x) + m.y * (q.y - P.y);
        for (let i = 0; i < poly.length; i++) {
            const cur = poly[i], nxt = poly[(i + 1) % poly.length];
            const vc = v(cur), vn = v(nxt);
            const fc = (vc === 0) || Math.sign(vc) === s;
            const fn = (vn === 0) || Math.sign(vn) === s;
            if (fc) out.push(cur);
            if (fc !== fn) {
                const t = vc / (vc - vn);
                out.push({ x: cur.x + (nxt.x - cur.x) * t,
                           y: cur.y + (nxt.y - cur.y) * t });
            }
        }
        return out;
    }

    const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];   // [sH, sN]
    const pieces = signs.map(([sH, sN]) => {
        let poly = clip(sqB.slice(), G, h, sH);
        poly = clip(poly, G, n, sN);
        /* sudut persegi b² yang ikut dalam potongan ini */
        const corner = sqB.find(P2 =>
            Math.sign(h.x * (P2.x - G.x) + h.y * (P2.y - G.y)) === sH &&
            Math.sign(n.x * (P2.x - G.x) + n.y * (P2.y - G.y)) === sN);
        const ax = Math.sign(corner.x - G.x), ay = Math.sign(corner.y - G.y);
        const Q = { x: W.x + (a / 2) * ax, y: W.y + (a / 2) * ay };  // sudut dalam a²
        return { poly, t: { x: Q.x - corner.x, y: Q.y - corner.y } };
    });

    const inner = [
        { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
        { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y + a / 2 }];
    const tA = { x: W.x - a / 2, y: W.y + a / 2 };   // translasi persegi a²

    /* konversi ke koordinat layar */
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
            a: S(a / 2, 0.6), b: S(-0.9, b / 2), c: S(a / 2 + n.x * 0.8, b / 2 + n.y * 0.8),
            b2: S(-b / 2, b / 2), a2: S(a / 2, -a / 2),
            c2: S(Wc.x + n.x * 1.2, Wc.y + n.y * 1.2)
        }
    };
}
window.perigalGeometry = perigalGeometry;
