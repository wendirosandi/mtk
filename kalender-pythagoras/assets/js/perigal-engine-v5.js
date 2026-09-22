/* perigal-engine-v5.1.js — perbaikan: lubang a² MIRING sejajar c² */
function perigalGeometry(a, b, off, viewW, viewH, pad) {
    off = off || { p: 0, q: 0 };
    pad = pad || 20;
    const c = Math.hypot(a, b);
    const h = { x: a / c, y: -b / c };
    const n = { x: b / c, y: a / c };
    const o = { x: off.p * h.x + off.q * n.x, y: off.p * h.y + off.q * n.y };

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
    const W = { x: Wc.x + o.x, y: Wc.y + o.y };
    const Gc = { x: -b / 2, y: b / 2 };
    const G = { x: Gc.x + o.x, y: Gc.y + o.y };

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
    function distPoly(poly, p) {
        let d = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            const dx = xj - xi, dy = yj - yi;
            const t = Math.max(0, Math.min(1, ((p.x - xi) * dx + (p.y - yi) * dy) / (dx * dx + dy * dy || 1)));
            d = Math.min(d, Math.hypot(p.x - (xi + dx * t), p.y - (yi + dy * t)));
        }
        return d;
    }
    function area(poly) { let s = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
            s += poly[j].x * poly[i].y - poly[i].x * poly[j].y; return s / 2; }
    const move = (poly, t) => poly.map(p => ({ x: p.x + t.x, y: p.y + t.y }));

    /* === PERBAIKAN: lubang a² MIRING (sejajar sisi c²) === */
    const q = a / 2;
    const inner = [
        { x: W.x + q * (h.x + n.x),  y: W.y + q * (h.y + n.y) },
        { x: W.x + q * (-h.x + n.x), y: W.y + q * (-h.y + n.y) },
        { x: W.x + q * (-h.x - n.x), y: W.y + q * (-h.y - n.y) },
        { x: W.x + q * (h.x - n.x),  y: W.y + q * (h.y - n.y) }];
    const mids = [0, 1, 2, 3].map(i => ({
        x: (inner[i].x + inner[(i + 1) % 4].x) / 2,
        y: (inner[i].y + inner[(i + 1) % 4].y) / 2 }));
    const targets = inner.concat(mids, [W]);

    const signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const pieces = [];
    signs.forEach(([sH, sN]) => {
        let poly = clip(sqB.slice(), G, h, sH);
        poly = clip(poly, G, n, sN);
        if (poly.length < 3 || Math.abs(area(poly)) < 1e-9) return;
        pieces.push({ poly, t: null });
    });

    const tol = 0.02 * c;
    const samples = [];
    const step = c / 22;
    for (let x = minX; x <= maxX; x += step)
        for (let y = minY; y <= maxY; y += step) {
            const p = { x, y };
            if (!pip(sqC, p, 0) || pip(inner, p, 0)) continue;
            if (distPoly(sqC, p) < tol || distPoly(inner, p) < tol) continue;
            samples.push(p);
        }

    function coveredOnce(moved) {
        for (const p of samples) {
            let cnt = 0;
            for (const m of moved) if (pip(m, p, 0)) cnt++;
            if (cnt !== 1) return false;
        }
        return true;
    }
    function noOverlap(mNew, placed) {
        const probe = mNew.concat([
            { x: (mNew[0].x + mNew[2].x) / 2, y: (mNew[0].y + mNew[2].y) / 2 }]);
        for (const q2 of probe)
            for (const m of placed)
                if (pip(m, q2, -1e-9) && distPoly(m, q2) > 1e-7) return false;
        return true;
    }

    const cands = pieces.map(pc => {
        const list = [];
        for (const V of pc.poly) for (const Q of targets)
            list.push({ x: Q.x - V.x, y: Q.y - V.y });
        return list;
    });
    let solution = null;
    (function dfs(i, placed, ts) {
        if (solution) return;
        if (i === pieces.length) {
            if (coveredOnce(placed)) { solution = ts.slice(); }
            return;
        }
        for (const t of cands[i]) {
            const m = move(pieces[i].poly, t);
            if (!m.every(p => pip(sqC, p, 1e-7))) continue;
            if (!noOverlap(m, placed)) continue;
            ts.push(t); placed.push(m);
            dfs(i + 1, placed, ts);
            ts.pop(); placed.pop();
            if (solution) return;
        }
    })(0, [], []);

    if (!solution) {
        console.warn('⚠️ solver Perigal: fallback tanda-sumbu');
        pieces.forEach(pc => {
            const K = sqB.find(P2 => pip(pc.poly, P2, 1e-7 * b));
            const sx = Math.sign(K.x - G.x), sy = Math.sign(K.y - G.y);
            pc.t = { x: W.x + q * (sx * h.x + sy * n.x) - K.x,
                     y: W.y + q * (sx * h.y + sy * n.y) - K.y };
        });
    } else {
        pieces.forEach((pc, i) => pc.t = solution[i]);
    }

    const moved = pieces.map(pc => move(pc.poly, pc.t));
    const okCover = coveredOnce(moved);
    if (okCover) console.log('✅ TILING OK (Perigal ' + a + ',' + b + ')');
    else console.warn('⚠️ TILING GAGAL', { okCover });

    const map = poly => poly.map(P => S(P.x, P.y));
    return {
        a, b, c, u, S,
        tri: map([B, A, C]),
        sqA: map(sqA), sqB: map(sqB), sqC: map(sqC),
        inner: map(inner),                      /* lubang miring = target a² */
        pieces: pieces.map(pc => ({ poly: map(pc.poly), t: { x: pc.t.x * u, y: -pc.t.y * u } })),
        cut1: [S(G.x - h.x * b * 2, G.y - h.y * b * 2), S(G.x + h.x * b * 2, G.y + h.y * b * 2)],
        cut2: [S(G.x - n.x * b * 2, G.y - n.y * b * 2), S(G.x + n.x * b * 2, G.y + n.y * b * 2)],
        G: S(G.x, G.y), W: S(W.x, W.y),
        labels: {
            a: S(a / 2, 0.6), b: S(-0.9, b / 2),
            c: S(a / 2 + n.x * 0.8, b / 2 + n.y * 0.8),
            b2: S(-b / 2, b / 2), a2: S(W.x, W.y),
            c2: S(Wc.x + n.x * 1.2, Wc.y + n.y * 1.2)
        }
    };
}
window.perigalGeometry = perigalGeometry;
