/* =====================================================
   static-scenes.js
   Renderer GAMBAR STATIS (kondisi AWAL & AKHIR) untuk
   dokumentasi cetak/PDF. Dipakai semua halaman pembuktian.
   Geometri identik dengan animasi live (sel terbang).
   ===================================================== */
(function () {
    const C = 40, COS = 0.8, SIN = 0.6, ROT = 36.87;
    const CROP = { x: 110, y: 60, w: 440, h: 520 };   // area potong agar gambar padat
    const RED = '#e53935', GREEN = '#43a047';

    function slot(k) {                                 // top-left sel pada grid c² (rotated)
        const col = k % 5, row = (k / 5) | 0;
        const lx = col * C + 20, ly = row * C + 20;
        const dx = lx, dy = ly - 200;
        return { x: 250 + COS * dx - SIN * dy - 20,
                 y: 280 + SIN * dx + COS * dy - 20 };
    }

    function el(tag, styles, parent) {
        const d = document.createElement(tag);
        Object.assign(d.style, styles);
        parent.appendChild(d);
        return d;
    }

    /* renderStaticScene(container, 'initial'|'final', skala) */
    window.renderStaticScene = function (container, state, s) {
        s = s || 0.5;
        container.innerHTML = '';
        Object.assign(container.style, {
            position: 'relative',
            width:  (CROP.w * s) + 'px',
            height: (CROP.h * s) + 'px',
            background: '#f4f6fb',
            border: '2px solid #cfd4dd',
            borderRadius: '8px',
            overflow: 'hidden'
        });
        const P = x => (x - CROP.x) * s;
        const Q = y => (y - CROP.y) * s;

        /* garis panduan sumbu */
        el('div', { position:'absolute', left:P(250)+'px', top:0, bottom:0,
                    borderLeft:'1px dashed #dfe3ea' }, container);
        el('div', { position:'absolute', top:Q(400)+'px', left:0, right:0,
                    borderTop:'1px dashed #dfe3ea' }, container);

        /* ghost dashed a², b², c² (c² di ATAS hipotenusa) */
        el('div', { position:'absolute', left:P(130)+'px', top:Q(280)+'px',
                    width:120*s+'px', height:120*s+'px',
                    border:'2px dashed rgba(229,57,53,.6)', borderRadius:4*s+'px' }, container);
        el('div', { position:'absolute', left:P(250)+'px', top:Q(400)+'px',
                    width:160*s+'px', height:160*s+'px',
                    border:'2px dashed rgba(67,160,71,.6)', borderRadius:4*s+'px' }, container);
        el('div', { position:'absolute', left:P(250)+'px', top:Q(80)+'px',
                    width:200*s+'px', height:200*s+'px',
                    border:'2px dashed rgba(21,101,192,.7)', borderRadius:4*s+'px',
                    transformOrigin:'0 ' + (200*s) + 'px',
                    transform:'rotate(' + ROT + 'deg)' }, container);

        /* segitiga via SVG inline (aman untuk html2canvas & print) */
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', 160 * s);
        svg.setAttribute('height', 120 * s);
        Object.assign(svg.style, { position:'absolute', left:P(250)+'px', top:Q(280)+'px' });
        const poly = document.createElementNS(NS, 'polygon');
        poly.setAttribute('points', '0,0 0,' + (120*s) + ' ' + (160*s) + ',' + (120*s));
        poly.setAttribute('fill', state === 'final'
            ? 'rgba(144,164,174,.30)' : 'rgba(144,164,174,.50)');
        svg.appendChild(poly);
        container.appendChild(svg);

        /* label sisi */
        const lab = (x, y, txt, color) => {
            const d = el('div', { position:'absolute', left:P(x)+'px', top:Q(y)+'px',
                fontSize:(12*s+4)+'px', fontWeight:'bold', color }, container);
            d.textContent = txt;
        };
        lab(256, 320, 'a=3', '#c62828');
        lab(312, 380, 'b=4', '#2e7d32');
        lab(450, 148, 'c=5', '#1565c0');

        /* pill label c² */
        const pill = (txt) => {
            const d = el('div', { position:'absolute', left:P(352)+'px', top:Q(242)+'px',
                zIndex:70, background:'rgba(255,255,255,.9)', color:'#0d47a1',
                fontWeight:'bold', fontSize:(12*s+4)+'px',
                padding:2*s+'px '+6*s+'px', borderRadius:6*s+'px',
                border:'1px solid rgba(13,71,161,.4)' }, container);
            d.textContent = txt;
        };

        /* sel satuan */
        const cellDiv = (x, y, rot, color) => el('div', {
            position:'absolute', left:0, top:0,
            width:C*s+'px', height:C*s+'px',
            background:color,
            border:(2*s)+'px solid rgba(0,0,0,.35)',
            borderRadius:3*s+'px',
            transform:'translate(' + P(x) + 'px,' + Q(y) + 'px) rotate(' + rot + 'deg)'
        }, container);

        if (state === 'initial') {
            /* GBR 1: a² & b² TERISI, c² kosong */
            for (let i = 0; i < 9; i++)
                cellDiv(130 + (i % 3) * C, 280 + ((i / 3) | 0) * C, 0, RED);
            for (let j = 0; j < 16; j++)
                cellDiv(250 + (j % 4) * C, 400 + ((j / 4) | 0) * C, 0, GREEN);
            pill('c² = ?');
        } else {
            /* GBR 2: c² TERISI 25 kotak, a² & b² kosong */
            for (let k = 0; k < 25; k++) {
                const t = slot(k);
                cellDiv(t.x, t.y, ROT, k < 16 ? GREEN : RED);
            }
            pill('c² = 25 ✓');
            lab(146, 330, 'a² kosong', '#c62828');
            lab(278, 470, 'b² kosong', '#2e7d32');
        }
    };
})();
