/* =====================================================
   pdf-export.js  v3.3
   - Modal konfirmasi SELALU muncul saat klik Download
   - Checkbox WAJIB dicentang untuk enable tombol
   - Export 1 halaman A4 (794×1123 px)
   ===================================================== */

/* ---------- Tampilkan Modal Konfirmasi ---------- */
function showDownloadModal() {
  const modal = document.getElementById('downloadModal');
  const checkbox = document.getElementById('modalAck');
  const btnDownload = document.getElementById('btnModalDownload');
  const warning = document.getElementById('modalWarning');

  if (!modal) {
    console.error('❌ Modal download tidak ditemukan');
    return;
  }

  // Reset state
  checkbox.checked = false;
  btnDownload.disabled = true;

  // Cek checklist proyek
  const checklistComplete = (typeof window.canDownloadPDF === 'function')
    ? window.canDownloadPDF()
    : true; // Jika tidak ada checklist, anggap lengkap

  if (checklistComplete) {
    warning.style.display = 'none';
    // Tetap wajib centang checkbox di modal
  } else {
    warning.style.display = 'block';
    warning.textContent = '⚠️ Checklist proyek belum lengkap. Silakan centang semua item di halaman utama terlebih dahulu, lalu centang box di bawah untuk melanjutkan.';
  }

  // Checkbox handler
  checkbox.onchange = () => {
    if (checkbox.checked) {
      btnDownload.disabled = false;
      // Simpan ke localStorage
      try {
        localStorage.setItem('pythagoras_modal_ack', JSON.stringify({
          acknowledged: true,
          timestamp: Date.now(),
          page: window.location.pathname
        }));
      } catch (e) {
        console.warn('⚠️ Tidak bisa simpan ke localStorage:', e);
      }
    } else {
      btnDownload.disabled = true;
    }
  };

  // Tampilkan modal
  modal.classList.add('show');
}

/* ---------- Tutup Modal ---------- */
function closeDownloadModal() {
  const modal = document.getElementById('downloadModal');
  if (modal) modal.classList.remove('show');
}

/* ---------- Export PDF 1 halaman A4 ---------- */
async function doExportPDF() {
  /* 1. Pastikan preview terbuka */
  const previewCollapse = document.getElementById('previewCollapse');
  if (previewCollapse && previewCollapse.classList.contains('collapsed')) {
    previewCollapse.classList.remove('collapsed');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (typeof window.fitSheet === 'function') window.fitSheet();
  await new Promise(resolve => setTimeout(resolve, 300));

  /* 2. Ambil area export */
  const sheet = document.querySelector('.a4-sheet') || document.getElementById('exportArea');
  if (!sheet) {
    alert('❌ Area export tidak ditemukan!');
    return;
  }

  /* 3. Simpan state transform asli */
  const originalTransform = sheet.style.transform;
  const originalTransformOrigin = sheet.style.transformOrigin;
  const viewport = sheet.closest('.a4-viewport');
  const originalViewportH = viewport ? viewport.style.height : '';
  const originalViewportOv = viewport ? viewport.style.overflow : '';

  sheet.style.transform = 'none';
  sheet.style.transformOrigin = 'top left';
  if (viewport) {
    viewport.style.height = 'auto';
    viewport.style.overflow = 'visible';
  }
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    /* 4. Capture dengan html2canvas */
    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
      windowWidth: 794,
      windowHeight: 1123
    });

    /* 5. Buat PDF A4 portrait */
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    /* 6. Fit image ke A4 */
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;
    const offsetX = (pdfWidth - finalWidth) / 2;
    const offsetY = (pdfHeight - finalHeight) / 2;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', offsetX, offsetY, finalWidth, finalHeight);

    /* 7. Footer */
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text('Kalender Pythagoras 2027 - SMPN 2 Karawang Barat', pdfWidth / 2, pdfHeight - 5, { align: 'center' });

    /* 8. Download */
    const title = (document.querySelector('.proof-info h1') || {}).textContent || 'Bukti-Pythagoras';
    const safeName = title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 50);
    pdf.save(`${safeName}.pdf`);

  } catch (error) {
    console.error(' Error export PDF:', error);
    alert('❌ Gagal export PDF: ' + error.message);
  } finally {
    /* 9. Restore state */
    sheet.style.transform = originalTransform;
    sheet.style.transformOrigin = originalTransformOrigin;
    if (viewport) {
      viewport.style.height = originalViewportH;
      viewport.style.overflow = originalViewportOv;
    }
    if (typeof window.fitSheet === 'function') window.fitSheet();
  }
}

/* ---------- Handler tombol Download di modal ---------- */
function handleModalDownload() {
  const checkbox = document.getElementById('modalAck');
  if (!checkbox || !checkbox.checked) {
    alert('⚠️ Centang checkbox terlebih dahulu!');
    return;
  }
  closeDownloadModal();
  doExportPDF();
}

/* ---------- Print / Save as PDF (browser dialog) ---------- */
function printPDF() {
  const previewCollapse = document.getElementById('previewCollapse');
  if (previewCollapse && previewCollapse.classList.contains('collapsed')) {
    previewCollapse.classList.remove('collapsed');
    setTimeout(() => {
      if (typeof window.fitSheet === 'function') window.fitSheet();
      window.print();
    }, 200);
  } else {
    window.print();
  }
}

/* ---------- Expose ke global scope ---------- */
window.exportToPDF = showDownloadModal;
window.printPDF = printPDF;
window.closeDownloadModal = closeDownloadModal;
window.handleModalDownload = handleModalDownload;

/* ---------- Auto-bind saat DOM ready ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const btnModalDownload = document.getElementById('btnModalDownload');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const modalOverlay = document.getElementById('downloadModal');

  if (btnModalDownload) {
    btnModalDownload.addEventListener('click', handleModalDownload);
  }
  if (btnModalCancel) {
    btnModalCancel.addEventListener('click', closeDownloadModal);
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeDownloadModal();
    });
  }
});
