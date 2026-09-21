/* perigal-page.js v3 */
(function () {
    const PC = window.PCFG;
    const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];
    const A = PC.a, B = PC.b, C = Math.round(Math.hypot(A, B));
    const prevNames = ['','januari','februari','maret','april','mei','juni','juli'];
    const prevFile = 'bukti-0' + (PC.month - 1) + '-' + prevNames[PC.month - 1] + '.html';
    const nextM = PC.month + 1, nextOk = nextM <= 7;
    const nextFile = nextOk ? 'bukti-0' + nextM + '-' + prevNames[nextM] + '.html' : '#';

    document.getElementById('app').innerHTML = `
    <header class="proof-header no-print">
        <a href="../index.html" class="back-btn">← Kembali ke Kalender</a>
        <div class="proof-info">
            <h1>Bukti #${PC.month}: Perigal (${A}-${B}-${C})</h1>
            <div class="proof-meta">
                <span class="meta-item">📅 ${MONTHS[PC.month - 1]} 2027</span>
                <span class="meta-item">👥 ${PC.group}</span>
                <span class="meta-item">🎯 Level: ${PC.level}</span>
            </div>
        </div>
        <div class="export-buttons">
            <button class="export-pdf-btn" id="btnDownloadPDF" onclick="exportToPDF()">📄 Download PDF (1 hal)</button>
            <button class="btn-print" onclick="printPDF()">🖨 Print / Save as PDF</button>
        </div>
    </header>
    <nav class="proof-nav no-print">
        <a href="${prevFile}" class="prev-btn">← Bukti #${PC.month - 1}</a>
        <span class="nav-indicator">${PC.month} / 12</span>
        ${nextOk ? `<a href="${nextFile}" class="next-btn">Bukti #${nextM} →</a>`
                 : `<a href="#" class="next-btn disabled" onclick="alert('Masih tahap pengembangan');return false;">Bukti #${nextM} →</a>`}
    </nav>
    <main class="proof-content">
        <section class="section introduction no-print">
            <h2>📖 Pengenalan</h2>
            <p class="intro-text">Bulan ini membuktikan Teorema Pythagoras dengan
               <strong>Diseksi Perigal</strong> pada triple <strong>${A}-${B}-${C}</strong>:
               persegi b² dipotong menjadi 4 slice oleh dua garis (sejajar & tegak-lurus hipotenusa)
               melalui pusatnya; keempat slice beserta persegi a² kemudian
               <em>digeser tanpa rotasi</em> hingga menutup persegi c² dengan sempurna.</p>
            <div class="historical-note"><strong>🔧 Konfigurasi:</strong> Perigal klasik (pusat).
               Variasi slice fleksibel (geser O & M) dapat dieksplorasi pada applet GeoGebra di bawah.</div>
        </section>
        <section class="section animation no-print">
            <h2>🎬 Animasi Interaktif</h2>
            <div class="animation-wrapper">
                <div class="stage-wrap" style="position:relative;width:100%;background:#f4f6fb;border:3px solid #e0e0e0;border-radius:15px;overflow:hidden;">
                    <svg id="stageSvg" viewBox="0 0 560 520" style="display:block;width:100%;height:auto;"></svg>
                </div>
                <div id="geoNotice" style="display:none;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:10px;margin-top:10px;font-size:13px;color:#856404;"></div>
                <div class="animation-controls">
                    <button class="btn-start" id="btnStart">▶ Mulai</button>
                    <button class="btn-pause" id="btnPause" style="display:none">⏸ Pause</button>
                    <button class="btn-skip" id="btnSkip">⏭ Selesai</button>
                    <button class="btn-reset" id="btnReset">↺ Reset</button>
                    <div class="speed-control">
                        <label for="speedSlider">⚡ Kecepatan:</label>
                        <input type="range" id="speedSlider" min="0.5" max="3" step="0.5" value="1">
                        <span class="speed-value" id="speedValue">1×</span>
                    </div>
                </div>
                <div class="progress-box">
                    <div class="pbar"><div class="pfill" id="pfill"></div></div>
                    <div class="ptext" id="ptext">Progres: 0%</div>
                </div>
                <div class="formula-display" style="margin-top:15px;">
                    <div class="formula-step active" id="step0">Siap memulai… tekan ▶ Mulai</div>
                    <div class="formula-step" id="step1"></div>
                    <div class="formula-step" id="step2"></div>
                    <div class="formula-step" id="step3">b² dipotong 4 slice (∥ & ⊥ hipotenusa)</div>
                    <div class="formula-step" id="step4">4 slice + a² digeser (tanpa rotasi) ke c²</div>
                    <div class="formula-step" id="step5"></div>
                </div>
            </div>
        </section>
        <section class="section external-resources no-print">
            <h2>🔗 Applet GeoGebra (Slice Fleksibel)</h2>
            <div class="embed-container" style="text-align:center;padding:24px;">
                <div style="font-size:40px;">📐</div>
                <p style="margin:10px 0;color:#555;">Applet <strong>"Pembuktian Teorema Pythagoras 3 —
                   Versi Slice Fleksibel"</strong>: geser titik O & M (slice) serta A & C (ukuran).</p>
                <a class="external-link" target="_blank" rel="noopener"
                   href="https://www.geogebra.org/calculator/cqgadg5k"
                   style="display:inline-block;background:#667eea;color:#fff;padding:10px 22px;border-radius:8px;font-weight:700;text-decoration:none;">
                   🔗 Buka Applet GeoGebra cqgadg5k</a>
            </div>
        </section>
        <section class="section export-section no-print-screen">
            <button class="preview-toggle no-print" id="btnPreview" onclick="togglePreview()">
                👁 Tampilkan Pratinjau PDF (1 halaman)</button>
            <div class="preview-collapse collapsed" id="previewCollapse">
              <div class="a4-viewport" id="a4Viewport">
                <div id="exportArea" class="a4-sheet">
                    <div class="export-header">
                        <h2>Bukti #${PC.month}: Perigal (${A}-${B}-${C})</h2>
                        <p>Kalender Pythagoras 2027 • ${MONTHS[PC.month - 1]} • ${PC.group} • Level: ${PC.level}</p>
                    </div>
                    <div id="calBlock" class="cal-block"></div>
                    <hr class="cal-divider">
                    <div class="proof-figures">
                        <figure class="proof-figure"><span class="state-badge initial">AWAL</span>
                            <div class="scene" id="figInitial"></div>
                            <figcaption><strong>Gbr 1:</strong> b² terpotong 4 slice; a² utuh; c² kosong.</figcaption></figure>
                        <figure class="proof-figure"><span class="state-badge final">AKHIR</span>
                            <div class="scene" id="figFinal"></div>
                            <figcaption><strong>Gbr 2:</strong> 4 slice + a² mengisi c²; sumber kosong.</figcaption></figure>
                    </div>
                    <div class="export-explain">
                        <p><strong>Penjelasan:</strong> Dua garis potong melalui pusat b²
                           (sejajar & tegak-lurus hipotenusa) menghasilkan 4 slice. Keempat slice dan
                           persegi a² hanya <em>digeser</em> (translasi murni) hingga menutup c²
                           tanpa celah dan tanpa tumpang-tindih.</p>
                        <div class="export-formula">c² = a² + b² → ${C}² = ${A}² + ${B}² → ${C*C} = ${A*A} + ${B*B} ✓</div>
                    </div>
                    <div class="export-conclusion">
                        <div class="export-conclusion-text">KESIMPULAN:<br>a² + b² = c²</div>
                        <div><div class="qr-box" id="qrcode">[QR]</div>
                        <div class="qr-caption">Scan untuk animasi</div></div>
                    </div>
                </div>
              </div>
            </div>
        </section>
    </main>
    <nav class="proof-nav bottom no-print">
        <a href="${prevFile}" class="prev-btn">← Sebelumnya</a>
        <a href="../index.html" class="home-btn">🏠 Kalender</a>
        ${nextOk ? `<a href="${nextFile}" class="next-btn">Selanjutnya →</a>`
                 : `<a href="#" class="next-btn disabled" onclick="alert('Masih tahap pengembangan');return false;">Selanjutnya →</a>`}
    </nav>
    <footer class="no-print"><p><strong>${PC.group}</strong> - Pembuktian #${PC.month}</p>
        <p>Projek Kalender Pythagoras 2027</p></footer>`;

    /* ================= stage ================= */
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('stageSvg');
    const P = poly => (poly || []).map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const COL = ['#f16a7a', '#5b5bee', '#5bf17a', '#f1d95b'];
    const mk = (t, at, pa) => { const e = document.createElementNS(NS, t);
        for (const k in at) e.setAttribute(k, at[k]); (pa || svg).appendChild(e); return e; };
    const clearSVG = () => { while (svg.firstChild) svg.removeChild(svg.firstChild); };

    let GEO = perigalGeometry(A, B, null, 560, 520, 24);
    if (!GEO.valid) {
        document.getElementById('geoNotice').style.display = 'block';
        document.getElementById('geoNotice').textContent =
            '⚠️ Triple ' + A + '-' + B + '-' + C + ' belum memiliki solusi tiling pada mesin ini; ' +
            'animasi menampilkan konfigurasi tempat-potong tanpa perpindahan. ' +
            'Gunakan applet GeoGebra untuk eksplorasi penuh.';
    }
    let gTri, gSqC, gSqB, gGhostB, gGhostA, gCutG, cut1, cut2, gInner, gA, sliceEls;
    const tweens = []; const TOTAL = 5000;

    function buildStage() {
        clearSVG();
        const defs = mk('defs', {}); const cp = mk('clipPath', { id: 'clipB' }, defs);
        mk('polygon', { points: P(GEO.sqB) }, cp);
        gTri  = mk('polygon', { points: P(GEO.tri), fill: 'rgba(144,164,174,.45)', opacity: 0 });
        gSqC  = mk('polygon', { points: P(GEO.sqC), fill: '#eef4fb', stroke: '#2f7bd9', 'stroke-width': 2.5, opacity: 0 });
        gSqB  = mk('polygon', { points: P(GEO.sqB), fill: '#ffffff', stroke: '#2f7bd9', 'stroke-width': 2, opacity: 0 });
        gGhostB = mk('polygon', { points: P(GEO.sqB), fill: 'none', stroke: '#2f7bd9', 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0 });
        gGhostA = mk('polygon', { points: P(GEO.sqA), fill: 'none', stroke: '#b02ab0', 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0 });
        gCutG = mk('g', { 'clip-path': 'url(#clipB)', opacity: 0 });
        cut1 = mk('line', { x1: GEO.cut1[0].x, y1: GEO.cut1[0].y, x2: GEO.cut1[1].x, y2: GEO.cut1[1].y, stroke: '#37474f', 'stroke-width': 2.5 }, gCutG);
        cut2 = mk('line', { x1: GEO.cut2[0].x, y1: GEO.cut2[0].y, x2: GEO.cut2[1].x, y2: GEO.cut2[1].y, stroke: '#37474f', 'stroke-width': 2.5 }, gCutG);
        gInner = mk('polygon', { points: P(GEO.inner), fill: 'none', stroke: '#b02ab0', 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0 });
        gA = mk('g', { transform: 'translate(0,0)', opacity: 0 });
        mk('polygon', { points: P(GEO.sqA), fill: '#ee55ee', stroke: '#b02ab0', 'stroke-width': 2 }, gA);
        sliceEls = (GEO.pieces || []).map((pc, i) => {
            const g = mk('g', { transform: 'translate(0,0)' });
            mk('polygon', { points: P(pc.poly), fill: COL[i], stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.5, opacity: 0 }, g);
            return g; });
        const lab = (p, t, col, sz) => { const e = mk('text', { x: p.x, y: p.y, fill: col,
            'font-size': sz || 15, 'font-weight': 'bold', opacity: 0, 'text-anchor': 'middle' });
            e.textContent = t; return e; };
        lab(GEO.labels.a, 'a = ' + A, '#c62828'); lab(GEO.labels.b, 'b = ' + B, '#2e7d32');
        lab(GEO.labels.c, 'c = ' + C, '#1565c0'); lab(GEO.labels.b2, String(B * B), '#1565c0', 20);
        lab(GEO.labels.a2, String(A * A), '#b02ab0', 18); lab(GEO.labels.c2, String(C * C), '#1565c0', 22);
    }
    const addTween = (t0, t1, fn) => { const tw = { t0, t1, fn, last: -1 }; tweens.push(tw); return tw; };
    const fade = (el, t0, d, to, from = 0) => addTween(t0, t0 + d, p => el.setAttribute('opacity', from + (to - from) * p));
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    function buildTimeline() {
        tweens.length = 0;
        fade(gTri, 0, 400, 1); fade(gA, 400, 300, 1); fade(gSqB, 700, 300, 1); fade(gSqC, 1000, 300, 1);
        const L1 = Math.hypot(GEO.cut1[1].x - GEO.cut1[0].x, GEO.cut1[1].y - GEO.cut1[0].y);
        const L2 = Math.hypot(GEO.cut2[1].x - GEO.cut2[0].x, GEO.cut2[1].y - GEO.cut2[0].y);
        fade(gCutG, 1400, 100, 1);
        [cut1, cut2].forEach((ln, i) => { const L = i ? L2 : L1;
            ln.setAttribute('stroke-dasharray', L); ln.setAttribute('stroke-dashoffset', L);
            addTween(1400 + i * 250, 1900 + i * 250, p => ln.setAttribute('stroke-dashoffset', L * (1 - p))); });
        sliceEls.forEach((g, i) => fade(g.firstChild, 2000 + i * 120, 300, 1));
        fade(gInner, 2600, 300, 1);
        addTween(2800, 3500, p => { const e = ease(p);
            gA.setAttribute('transform', `translate(${GEO.tA.x * e},${GEO.tA.y * e})`); });
        fade(gGhostA, 2900, 400, 1);
        (GEO.pieces || []).forEach((pc, i) => addTween(3300 + i * 220, 4000 + i * 220, p => { const e = ease(p);
            sliceEls[i].setAttribute('transform', `translate(${pc.t.x * e},${pc.t.y * e})`); }));
        fade(gSqB, 3300, 500, 0, 1); fade(gGhostB, 3300, 500, 1);
        addTween(4400, 4800, p => { svg.style.transform = `scale(${1 + 0.03 * Math.sin(Math.PI * p)})`; });
    }
    function updateTexts() {
        document.getElementById('step1').textContent = `Segitiga siku-siku: a = ${A}, b = ${B}, c = ${C}`;
        document.getElementById('step2').textContent = `a² = ${A*A} • b² = ${B*B} • c² = ${C*C}`;
        document.getElementById('step5').textContent = `c² tertutup sempurna → ${C*C} = ${A*A} + ${B*B} ✓`;
    }
    let vt = 0, playing = false, speed = 1, lastTs = null;
    const stepTimes = [[0, 1], [400, 2], [1400, 3], [2800, 4], [4400, 5]];
    function frame(ts) {
        if (lastTs === null) lastTs = ts;
        const dt = Math.min(50, ts - lastTs); lastTs = ts;
        if (playing) vt = Math.min(TOTAL, vt + dt * speed);
        for (const tw of tweens) { const p = Math.max(0, Math.min(1, (vt - tw.t0) / (tw.t1 - tw.t0)));
            if (p !== tw.last) { tw.fn(p); tw.last = p; } }
        const pct = Math.round(vt / TOTAL * 100);
        document.getElementById('ptext').textContent = 'Progres: ' + pct + '%';
        document.getElementById('pfill').style.width = pct + '%';
        let n = 0; for (const [t, s] of stepTimes) if (vt >= t) n = s;
        document.querySelectorAll('.formula-step').forEach(el => el.classList.remove('active'));
        const el = document.getElementById('step' + n); if (el) el.classList.add('active');
        if (playing && vt >= TOTAL) { playing = false;
            const b = document.getElementById('btnStart');
            b.textContent = '▶ Ulangi'; b.style.display = 'inline-block';
            document.getElementById('btnPause').style.display = 'none'; }
        requestAnimationFrame(frame);
    }
    function resetState() { vt = 0; playing = false; svg.style.transform = 'none';
        for (const tw of tweens) tw.last = -1;
        const b = document.getElementById('btnStart');
        b.textContent = '▶ Mulai'; b.style.display = 'inline-block';
        document.getElementById('btnPause').style.display = 'none'; }
    document.getElementById('btnStart').addEventListener('click', () => {
        if (vt >= TOTAL) resetState(); playing = true;
        document.getElementById('btnStart').style.display = 'none';
        document.getElementById('btnPause').style.display = 'inline-block'; });
    document.getElementById('btnPause').addEventListener('click', () => { playing = false;
        const b = document.getElementById('btnStart');
        b.textContent = '▶ Lanjut'; b.style.display = 'inline-block';
        document.getElementById('btnPause').style.display = 'none'; });
    document.getElementById('btnSkip').addEventListener('click', () => { vt = TOTAL; playing = false;
        for (const tw of tweens) { tw.fn(1); tw.last = 1; } });
    document.getElementById('btnReset').addEventListener('click', resetState);
    document.getElementById('speedSlider').addEventListener('input', e => {
        speed = parseFloat(e.target.value);
        document.getElementById('speedValue').textContent = speed + '×'; });

    /* ================= gambar statis sheet ================= */
    function perigalScene(state, w) {
        const g = perigalGeometry(A, B, null, w, Math.round(w * 0.93), 14);
        const C4 = ['#f16a7a', '#5b5bee', '#5bf17a', '#f1d95b'];
        const hh = Math.round(w * 0.93);
        let s = `<svg viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" style="display:block;margin:auto;">`;
        s += `<defs><clipPath id="clipB_${state}_${PC.month}"><polygon points="${P(g.sqB)}"/></clipPath></defs>`;
        s += `<polygon points="${P(g.tri)}" fill="rgba(144,164,174,.45)"/>`;
        s += `<polygon points="${P(g.sqC)}" fill="#eef4fb" stroke="#2f7bd9" stroke-width="2"/>`;
        if (state === 'initial') {
            s += `<polygon points="${P(g.sqB)}" fill="#ffffff" stroke="#2f7bd9" stroke-width="2"/>`;
            (g.pieces || []).forEach((pc, i) => s += `<polygon points="${P(pc.poly)}" fill="${C4[i]}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>`);
            s += `<g clip-path="url(#clipB_${state}_${PC.month})">` +
                 `<line x1="${g.cut1[0].x}" y1="${g.cut1[0].y}" x2="${g.cut1[1].x}" y2="${g.cut1[1].y}" stroke="#37474f" stroke-width="2"/>` +
                 `<line x1="${g.cut2[0].x}" y1="${g.cut2[0].y}" x2="${g.cut2[1].x}" y2="${g.cut2[1].y}" stroke="#37474f" stroke-width="2"/></g>`;
            s += `<polygon points="${P(g.sqA)}" fill="#ee55ee" stroke="#b02ab0" stroke-width="2"/>`;
        } else {
            (g.pieces || []).forEach((pc, i) => s += `<polygon points="${P(pc.poly.map(p => ({ x: p.x + pc.t.x, y: p.y + pc.t.y })))}" fill="${C4[i]}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>`);
            s += `<polygon points="${P(g.sqA.map(p => ({ x: p.x + g.tA.x, y: p.y + g.tA.y })))}" fill="#ee55ee" stroke="#b02ab0" stroke-width="2"/>`;
            s += `<polygon points="${P(g.sqB)}" fill="none" stroke="#2f7bd9" stroke-width="2" stroke-dasharray="6 5"/>`;
            s += `<polygon points="${P(g.sqA)}" fill="none" stroke="#b02ab0" stroke-width="2" stroke-dasharray="6 5"/>`;
        }
        return s + `</svg>`;
    }
    document.getElementById('figInitial').innerHTML = perigalScene('initial', 260);
    document.getElementById('figFinal').innerHTML   = perigalScene('final', 260);

    /* ================= sheet/kalender/QR ================= */
    function fitSheet() {
        const vp = document.getElementById('a4Viewport');
        const sh = document.querySelector('.a4-sheet');
        if (!vp || !sh) return;
        const s = Math.min(1, vp.clientWidth / 794);
        sh.style.transform = `scale(${s})`; sh.style.transformOrigin = 'top left';
        vp.style.height = (1123 * s) + 'px';
    }
    window.fitSheet = fitSheet;
    window.addEventListener('resize', fitSheet);
    window.togglePreview = function () {
        const col = document.getElementById('previewCollapse');
        col.classList.toggle('collapsed');
        document.getElementById('btnPreview').textContent = col.classList.contains('collapsed')
            ? '👁 Tampilkan Pratinjau PDF (1 halaman)' : '🙈 Sembunyikan Pratinjau PDF';
        if (!col.classList.contains('collapsed')) setTimeout(fitSheet, 60);
    };
    renderCalendar(document.getElementById('calBlock'), PC.month);
    try { new QRCode(document.getElementById('qrcode'), { text: window.location.href,
          width: 84, height: 84, correctLevel: QRCode.CorrectLevel.M }); }
    catch (e) { document.getElementById('qrcode').textContent = window.location.href; }

    buildStage(); buildTimeline(); updateTexts();
    fitSheet();
    requestAnimationFrame(frame);
})();
