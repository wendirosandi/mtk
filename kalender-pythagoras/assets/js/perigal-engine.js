/* =====================================================
   perigal-engine.js  v4
   K (sudut siku slice) → Q (sudut persegi dalam a²)
   sah untuk semua a, b, dan offset slice
   ===================================================== */
function perigalGeometry(a, b, off, viewW, viewH, pad) {
    off = off || { p: 0, q: 0 };
    pad = pad || 20;
    const c = Math.hypot(a, b);
    const h = { x: a / c, y: -b / c };
    const n = { x: b / c, y: a / c };
    const o = { x: off.p * h.x + off.q * n.x,
                y: off.p * h.y + off.q * n.y };

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
    const W  = { x: Wc.x + o.x, y: Wc.y + o.y };
    const Gc = { x: -b / 2, y: b / 2 };
    const G  = { x: Gc.x + o.x, y: Gc.y + o.y };

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
            const cross = (xj - xi) * (p.y - yi) - (yj - yi) * (p.x - xi);
            if (Math.abs(cross) / len <= eps &&
                p.x >= Math.min(xi, xj) - eps && p.x <= Math.max(xi, xj) + eps &&
                p.y >= Math.min(yi, yj) - eps && p.y <= Math.max(yi, yj) + eps) return true;
        }
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if ((yi > p.y) !== (yj > p.y) &&
                p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }
    function area(poly) {
        let s = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
            s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
        return s / 2;
    }

    const inner = [
        { x: W.x - a / 2, y: W.y - a / 2 }, { x: W.x + a / 2, y: W.y - a / 2 },
        { x: W.x + a / 2, y: W.y + a / 2 }, { x: W.x - a / 2, y: W.y + a / 2 }];

    /* ---- 4 slice + translasi K → sudut DALAM ---- */
    const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const pieces = [];
    signs.forEach(([sH, sN]) => {
        let poly = clip(sqB.slice(), G, h, sH);
        poly = clip(poly, G, n, sN);
        if (poly.length < 3 || Math.abs(area(poly)) < 1e-9) return;
        const K = sqB.find(P2 => pip(poly, P2, 1e-7 * b));
        const sx = Math.sign(K.x - G.x), sy = Math.sign(K.y - G.y);
        const Q = { x: W.x + (a / 2) * sx, y: W.y + (a / 2) * sy };
        pieces.push({ poly, t: { x: Q.x - K.x, y: Q.y - K.y } });
    });

    const tA = { x: W.x - a / 2, y: W.y + a / 2 };

    /* ---- SELF-TEST ---- */
    const sumP = pieces.reduce((s, pc) => s + Math.abs(area(pc.poly)), 0);
    const okArea = Math.abs(sumP + a * a - c * c) < 1e-6 * c * c;
    const okInside = pieces.every(pc => pc.poly.every(p =>
        pip(sqC, { x: p.x + pc.t.x, y: p.y + pc.t.y }, 1e-6 * b + 1e-9)));
    if (okArea && okInside) console.log('✅ TILING OK (Perigal ' + a + ',' + b + ')');
    else console.warn('⚠️ TILING GAGAL', { okArea, okInside });

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
