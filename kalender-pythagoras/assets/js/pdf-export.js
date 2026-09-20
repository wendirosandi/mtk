/* =====================================================
   pdf-export.js (revisi)
   - Export PDF menangkap #exportArea (2 gambar statis)
   - Mode 1: Download PDF (html2canvas + jsPDF, raster)
   - Mode 2: Print / Save as PDF (vektor via browser)
   ===================================================== */

function __pdfFooter(pdf, pageNum, total) {
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text('Kalender Pythagoras 2027 - Projek SMP Kelas 8',
             105, 291, { align: 'center' });
    pdf.text('Hal. ' + pageNum + ' dari ' + total,
             200, 291, { align: 'right' });
}

async function exportToPDF() {
    const btn = document.getElementById('btnDownloadPDF');
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '⏳ Membuat PDF...'; btn.disabled = true; }

    try {
        const target = document.getElementById('exportArea')
                    || document.getElementById('proofContent');

        const canvas = await html2canvas(target, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pageW = 210, pageH = 297, margin = 10;
        const imgW = pageW - 2 * margin;
        const pxPerMm = canvas.width / imgW;
        const pageContentH = pageH - 2 * margin - 6;      // sisa untuk footer
        const slicePx = Math.floor(pageContentH * pxPerMm);

        /* potong canvas menjadi beberapa irisan halaman */
        const slices = [];
        let y = 0;
        while (y < canvas.height) {
            const h = Math.min(slicePx, canvas.height - y);
            const cut = document.createElement('canvas');
            cut.width = canvas.width;
            cut.height = h;
            cut.getContext('2d').drawImage(canvas, 0, y, canvas.width, h,
                                           0, 0, canvas.width, h);
            slices.push(cut);
            y += h;
        }

        slices.forEach((cut, i) => {
            if (i > 0) pdf.addPage();
            pdf.addImage(cut, 'PNG', margin, margin, imgW, cut.height / pxPerMm);
            __pdfFooter(pdf, i + 1, slices.length);
        });

        const title = (document.querySelector('.proof-info h1') || {}).textContent
                      || 'Pembuktian Pythagoras';
        pdf.save(title.replace(/[^a-z0-9]/gi, '_') + '.pdf');

    } catch (err) {
        console.error('Gagal export PDF:', err);
        alert('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
        if (btn) { btn.innerHTML = original; btn.disabled = false; }
    }
}

/* Mode 2: cetak vektor via dialog print browser (CSS @media print) */
function printPDF() {
    window.print();
}

window.exportToPDF = exportToPDF;
window.printPDF = printPDF;
