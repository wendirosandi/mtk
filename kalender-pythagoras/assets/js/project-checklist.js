/* =====================================================
   project-checklist.js  v2.0
   - 9 item checklist (tambah 2 item baru)
   - Panduan Presentasi dengan Prompt AI (auto-replace)
   - Fitur peer review DINONAKTIFKAN (untuk versi 2)
   ===================================================== */

(function(){
"use strict";

/* ============ CHECKLIST ITEMS (9 TOTAL) ============ */
const CHECKLIST_ITEMS = [
  { id: 'understand_goal', label: 'Saya memahami tujuan proyek (kalender + 12 pembuktian)' },
  { id: 'group_formed', label: 'Kelompok saya sudah terbentuk (4-5 siswa)' },
  { id: 'month_assigned', label: 'Saya tahu bulan yang menjadi tugas kelompok saya' },
  { id: 'studied_example', label: 'Saya sudah mempelajari contoh guru (Januari & Februari)' },
  { id: 'read_rubric', label: 'Saya sudah membaca kriteria penilaian (100 poin)' },
  { id: 'role_divided', label: 'Pembagian tugas sudah jelas (moderator, operator, presenter)' },
  { id: 'timeline_understood', label: 'Saya paham timeline: 2 minggu + 2 pertemuan' },
  { id: 'ready_to_modify', label: 'Saya siap memodifikasi PDF (misal dengan Canva) agar lebih menarik dan siap dicetak sebagai Kalender Pythagoras 2027' },
  { id: 'ready_to_present', label: 'Saya siap mempresentasikan hasil kerja dalam waktu 3-4 menit sesuai jadwal' }
];

const STORAGE_KEY = 'pythagoras_project_checklist';

/* DOM elements */
const $ = id => document.getElementById(id);
const checklistContainer = $('checklistContainer');
const downloadStatus = $('downloadStatus');

/* Load state from localStorage */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

/* Save state to localStorage */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('⚠️ Tidak bisa simpan ke localStorage:', e);
  }
}

/* Render checklist */
function renderChecklist() {
  if (!checklistContainer) return;
  
  const state = loadState();
  checklistContainer.innerHTML = '';
  
  CHECKLIST_ITEMS.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px;background:#fff;border-radius:6px;cursor:pointer;transition:all 0.2s;';
    row.onmouseover = () => row.style.background = '#e0e7ff';
    row.onmouseout = () => row.style.background = '#fff';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `chk-${item.id}`;
    checkbox.checked = state[item.id] || false;
    checkbox.style.cssText = 'width:18px;height:18px;cursor:pointer;';
    checkbox.onchange = () => {
      state[item.id] = checkbox.checked;
      saveState(state);
      updateDownloadStatus();
    };
    
    const label = document.createElement('label');
    label.htmlFor = `chk-${item.id}`;
    label.textContent = item.label;
    label.style.cssText = 'flex:1;cursor:pointer;font-size:14px;color:#2d3748;';
    
    row.appendChild(checkbox);
    row.appendChild(label);
    row.onclick = (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.onchange();
      }
    };
    
    checklistContainer.appendChild(row);
  });
  
  updateDownloadStatus();
}

/* Update download status message */
function updateDownloadStatus() {
  if (!downloadStatus) return;
  
  const state = loadState();
  const checkedCount = CHECKLIST_ITEMS.filter(item => state[item.id]).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const allChecked = checkedCount === totalCount;
  
  if (allChecked) {
    downloadStatus.innerHTML = '<span style="color:#2f855a;">✅ Semua checklist lengkap — Anda bisa download PDF dari halaman bulan manapun!</span>';
  } else {
    downloadStatus.innerHTML = `<span style="color:#c53030;">⚠️ ${checkedCount}/${totalCount} checklist selesai — lengkapi semua untuk mengaktifkan download PDF.</span>`;
  }
  
  /* Expose function for PDF validation */
  window.__projectChecklistComplete = allChecked;
  window.canDownloadPDF = () => allChecked;
}

/* ============ PANDUAN PRESENTASI DENGAN PROMPT AI ============ */
function renderPanduanPresentasi() {
  const container = $('panduanPresentasiContainer');
  if (!container) return;
  
  /* Ambil nama bukti dari halaman (jika ada) */
  const proofName = window.PROOF_NAME || 'Teorema Pythagoras';
  
  const rawPrompt = `"Saya seorang siswa SMP akan mempresentasikan Pembuktian Teorema Pythagoras [NAMA BUKTI] mulai dari Pendahuluan, Penjelasan Visual/Animasi, Contoh, hingga Kesimpulan dalam waktu 3-4 menit. Bantu saya menyusun naskah presentasi yang mudah dipahami, menarik, dan sesuai untuk audiens teman sekelas."`;
  
  const finalPrompt = rawPrompt.replace('[NAMA BUKTI]', proofName);
  
  container.innerHTML = `
    <div style="background:#f0f4ff;border:2px solid #5a67d8;border-radius:10px;padding:16px;margin:15px 0;">
      <h4 style="margin:0 0 10px 0;color:#5a67d8;font-size:16px;">💡 Panduan Presentasi</h4>
      <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#4a5568;">
        Jika kamu kesulitan memahami pembuktian atau menyiapkan presentasi, gunakan contoh prompt AI berikut sebagai bantuan. 
        Sertakan <strong>screenshot halaman pembuktian</strong> atau <strong>upload PDF</strong> saat berinteraksi dengan AI.
      </p>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-family:'Courier New',monospace;font-size:13px;line-height:1.6;color:#2d3748;margin:10px 0;white-space:pre-wrap;" id="promptText">${finalPrompt}</div>
      <button id="btnCopyPrompt" style="background:#5a67d8;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;">📋 Copy Teks</button>
      <p style="font-size:12px;color:#718096;margin:8px 0 0 0;">⏱️ Durasi 3-4 menit sudah memperhitungkan jeda dan kemungkinan keterlambatan siswa.</p>
    </div>
  `;
  
  /* Copy button handler */
  const btnCopy = $('btnCopyPrompt');
  if (btnCopy) {
    btnCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(finalPrompt);
        btnCopy.textContent = '✅ Tersalin!';
        btnCopy.style.background = '#48bb78';
        setTimeout(() => {
          btnCopy.textContent = '📋 Copy Teks';
          btnCopy.style.background = '#5a67d8';
        }, 2000);
      } catch (e) {
        alert('❌ Gagal menyalin: ' + e.message);
      }
    };
  }
}

/* ============ PEER REVIEW (DINONAKTIFKAN) ============ */
/* 
  TODO: Peer review system akan dibuat di versi 2 dengan pendekatan berbeda.
  Untuk saat ini, fitur ini dinonaktifkan.
  
  const PEER_REVIEW_KEY = 'pythagoras_peer_reviews';
  const GROUPS = ['Kelompok 1', ..., 'Kelompok 10'];
  
  function renderPeerReviewForm() { ... }
  function loadPeerReviews() { ... }
  function savePeerReviews(reviews) { ... }
*/

/* ============ INISIALISASI ============ */
document.addEventListener('DOMContentLoaded', () => {
  renderChecklist();
  renderPanduanPresentasi();
  
  /* Expose functions */
  window.canDownloadPDF = () => {
    const state = loadState();
    return CHECKLIST_ITEMS.every(item => state[item.id]);
  };
});

/* Juga jalankan jika DOM sudah ready */
if (document.readyState !== 'loading') {
  renderChecklist();
  renderPanduanPresentasi();
  window.canDownloadPDF = () => {
    const state = loadState();
    return CHECKLIST_ITEMS.every(item => state[item.id]);
  };
}
})();
