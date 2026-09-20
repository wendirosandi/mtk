/* =====================================================
   pdf-export.js v3
   - Download PDF: SELALU 1 halaman A4 (scale-to-fit)
   - Print/Save-as-PDF: vektor, 1 halaman (auto-scale beforeprint)
   ===================================================== */
function __pdfFooter(pdf, num) {
    pdf.setFontSize(9); pdf.setTextColor(150);
    pdf.text('Kalender Pythagoras 2027 - Projek SMP Kelas 8', 105, 292, { align: 'center' });
    pdf.text('Hal. ' + num + ' dari 1', 200, 292, { align: 'right' });
}

async function exportToPDF() {
    const btn = document.getElementById('btnDownloadPDF');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '⏳ Membuat PDF 1 halaman...'; btn.disabled = true; }

    const collapse = document.getElementById('previewCollapse');
    const wasCollapsed = collapse && collapse.classList.contains('collapsed');
    if (wasCollapsed) collapse.classList.remove('collapsed');
    await new Promise(r => setTimeout(r, 60));

    try {
        const target = document.getElementById('exportArea') ||
                       document.getElementById('proofContent');
        const canvas = await html2canvas(target, {
            scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff'
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const availW = 190, availH = 268;                 // ruang konten (footer 292)
        let imgW = availW;
        let imgH = canvas.height * imgW / canvas.width;
        let px = 10;
        if (imgH > availH) {                              // terlalu tinggi → mengecilkan
            imgH = availH;
            imgW = canvas.width * imgH / canvas.height;
            px = (210 - imgW) / 2;
        }
        const py = 10 + (availH - imgH) / 2;
        pdf.addImage(canvas, 'PNG', px, py, imgW, imgH);
        __pdfFooter(pdf, 1);

        const title = (document.querySelector('.proof-info h1') || {}).textContent || 'Pembuktian';
        pdf.save(title.replace(/[^a-z0-9]/gi, '_') + '_1hal.pdf');
    } catch (err) {
        console.error('Gagal export PDF:', err);
        alert('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
        if (wasCollapsed) collapse.classList.add('collapsed');
        if (btn) { btn.innerHTML = old; btn.disabled = false; }
    }
}

function printPDF() { window.print(); }

/* Print vektor 1 halaman: scale exportArea agar muat ±265mm */
window.addEventListener('beforeprint', () => {
    const ea = document.getElementById('exportArea');
    const wrap = document.getElementById('exportWrap');
    const col = document.getElementById('previewCollapse');
    if (col) col.classList.remove('collapsed');
    if (!ea) return;
    ea.style.transform = 'none';
    const hPx = ea.scrollHeight;
    const hMm = hPx * 25.4 / 96;
    const s = Math.min(1, 265 / hMm);
    ea.style.transform = `scale(${s})`;
    ea.style.transformOrigin = 'top left';
    if (wrap) wrap.style.height = (hPx * s) + 'px';
});
window.addEventListener('afterprint', () => {
    const ea = document.getElementById('exportArea');
    const wrap = document.getElementById('exportWrap');
    if (ea) ea.style.transform = 'none';
    if (wrap) wrap.style.height = 'auto';
});

window.exportToPDF = exportToPDF;
window.printPDF = printPDF;
