/* =====================================================
   pdf-export.js  v3.1
   Target: .a4-sheet (fixed 794 px). Capture dengan
   sheet pada ukuran asli (tanpa scale).
   Print/Save-as-PDF: scale ~0.886 → vektor 1 halaman.
   ===================================================== */
function __pdfFooter(pdf) {
    pdf.setFontSize(9); pdf.setTextColor(150);
    pdf.text('Kalender Pythagoras 2027 - Projek SMP Kelas 8', 105, 292, { align: 'center' });
}

async function exportToPDF() {
    const btn = document.getElementById('btnDownloadPDF');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '⏳ Membuat PDF 1 halaman...'; btn.disabled = true; }

    const sheet    = document.querySelector('.a4-sheet') || document.getElementById('exportArea');
    const viewport = sheet?.closest('.a4-viewport');
    const collapse = document.getElementById('previewCollapse');
    const wasCollapsed = collapse && collapse.classList.contains('collapsed');

    /* buka collapse & lepas scale sementara */
    if (wasCollapsed) collapse.classList.remove('collapsed');
    const origSheetTransform = sheet.style.transform;
    const origViewportH = viewport?.style.height || '';
    const origViewportOv = viewport?.style.overflow || '';
    sheet.style.transform = 'none';
    if (viewport) { viewport.style.height = 'auto'; viewport.style.overflow = 'visible'; }
    await new Promise(r => setTimeout(r, 120));

    try {
        const canvas = await html2canvas(sheet, {
            scale: 2, width: 794, windowWidth: 794,
            useCORS: true, logging: false, backgroundColor: '#ffffff'
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const availW = 190, availH = 268;
        let imgW = availW, imgH = canvas.height * imgW / canvas.width, px = 10;
        if (imgH > availH) { imgH = availH; imgW = canvas.width * imgH / canvas.height; px = (210 - imgW) / 2; }
        const py = 10 + (availH - imgH) / 2;
        pdf.addImage(canvas, 'PNG', px, py, imgW, imgH);
        __pdfFooter(pdf);

        const title = (document.querySelector('.proof-info h1') || {}).textContent || 'Pembuktian';
        pdf.save(title.replace(/[^a-z0-9]/gi, '_') + '_1hal.pdf');
    } catch (err) {
        console.error('Gagal export PDF:', err);
        alert('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
        sheet.style.transform = origSheetTransform;
        if (viewport) { viewport.style.height = origViewportH; viewport.style.overflow = origViewportOv; }
        if (wasCollapsed) collapse.classList.add('collapsed');
        if (btn) { btn.innerHTML = old; btn.disabled = false; }
    }
}

function printPDF() { window.print(); }

/* Print vektor 1 halaman: scale sheet ke ~0.886 */
window.addEventListener('beforeprint', () => {
    const collapse = document.getElementById('previewCollapse');
    if (collapse) collapse.classList.remove('collapsed');
    const sheet = document.querySelector('.a4-sheet');
    const viewport = sheet?.closest('.a4-viewport');
    if (!sheet) return;
    const s = 0.886;                               // 210mm / ~238mm viewport efektif
    sheet.style.transform = `scale(${s})`;
    sheet.style.transformOrigin = 'top left';
    if (viewport) {
        viewport.style.height = (1123 * s) + 'px';
        viewport.style.overflow = 'visible';
    }
});
window.addEventListener('afterprint', () => {
    if (typeof window.fitSheet === 'function') window.fitSheet();
});

window.exportToPDF = exportToPDF;
window.printPDF = printPDF;
