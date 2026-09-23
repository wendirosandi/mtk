/* project-checklist.js — Checklist, LocalStorage, Validasi Download */
(function(){
"use strict";

/* Checklist items */
const CHECKLIST_ITEMS = [
  { id: 'understand_goal', label: 'Saya memahami tujuan proyek (kalender + 12 pembuktian)' },
  { id: 'group_formed', label: 'Kelompok saya sudah terbentuk (4-5 siswa)' },
  { id: 'month_assigned', label: 'Saya tahu bulan yang menjadi tugas kelompok saya' },
  { id: 'studied_example', label: 'Saya sudah mempelajari contoh guru (Januari & Februari)' },
  { id: 'read_rubric', label: 'Saya sudah membaca kriteria penilaian (100 poin)' },
  { id: 'role_divided', label: 'Pembagian tugas sudah jelas (moderator, operator, presenter)' },
  { id: 'timeline_understood', label: 'Saya paham timeline: 2 minggu + 2 pertemuan' }
];

const STORAGE_KEY = 'pythagoras_project_checklist';
const PEER_REVIEW_KEY = 'pythagoras_peer_reviews';

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
    console.warn('️ Tidak bisa simpan ke localStorage:', e);
  }
}

/* Render checklist */
function renderChecklist() {
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
  const state = loadState();
  const checkedCount = CHECKLIST_ITEMS.filter(item => state[item.id]).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const allChecked = checkedCount === totalCount;
  
  if (allChecked) {
    downloadStatus.innerHTML = '<span style="color:#2f855a;">✅ Semua checklist lengkap — Anda bisa download PDF dari halaman bulan manapun!</span>';
  } else {
    downloadStatus.innerHTML = `<span style="color:#c53030;">️ ${checkedCount}/${totalCount} checklist selesai — lengkapi semua untuk mengaktifkan download PDF.</span>`;
  }
  
  /* Expose function for PDF validation */
  window.__projectChecklistComplete = allChecked;
}

/* Check if can download */
window.canDownloadPDF = function() {
  const state = loadState();
  return CHECKLIST_ITEMS.every(item => state[item.id]);
};

/* Peer Review System */
const GROUPS = [
  'Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5',
  'Kelompok 6', 'Kelompok 7', 'Kelompok 8', 'Kelompok 9', 'Kelompok 10'
];

function renderPeerReviewForm() {
  const form = $('peerReviewForm');
  form.innerHTML = '';
  
  const savedReviews = loadPeerReviews();
  
  GROUPS.forEach(group => {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:12px;padding:10px;background:#f7fafc;border-radius:6px;';
    
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;margin-bottom:6px;color:#2d3748;';
    title.textContent = group;
    row.appendChild(title);
    
    const ratingSelect = document.createElement('select');
    ratingSelect.style.cssText = 'width:100%;padding:6px;border:1px solid #cbd5e0;border-radius:4px;margin-bottom:6px;';
    ratingSelect.innerHTML = `
      <option value="">-- Pilih penilaian --</option>
      <option value="5">⭐⭐⭐⭐⭐ Sangat Baik (90-100)</option>
      <option value="4">⭐⭐⭐⭐ Baik (75-89)</option>
      <option value="3">⭐⭐⭐ Cukup (60-74)</option>
      <option value="2">⭐⭐ Kurang (<60)</option>
    `;
    
    const saved = savedReviews[group];
    if (saved) {
      ratingSelect.value = saved.rating;
    }
    
    ratingSelect.onchange = () => {
      savedReviews[group] = savedReviews[group] || {};
      savedReviews[group].rating = ratingSelect.value;
      savePeerReviews(savedReviews);
    };
    
    row.appendChild(ratingSelect);
    
    const comment = document.createElement('textarea');
    comment.placeholder = 'Komentar (opsional)...';
    comment.style.cssText = 'width:100%;padding:6px;border:1px solid #cbd5e0;border-radius:4px;font-size:13px;';
    comment.rows = 2;
    
    if (saved && saved.comment) {
      comment.value = saved.comment;
    }
    
    comment.oninput = () => {
      savedReviews[group] = savedReviews[group] || {};
      savedReviews[group].comment = comment.value;
      savePeerReviews(savedReviews);
    };
    
    row.appendChild(comment);
    form.appendChild(row);
  });
}

function loadPeerReviews() {
  try {
    const saved = localStorage.getItem(PEER_REVIEW_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

function savePeerReviews(reviews) {
  try {
    localStorage.setItem(PEER_REVIEW_KEY, JSON.stringify(reviews));
  } catch (e) {
    console.warn('⚠️ Tidak bisa simpan peer review:', e);
  }
}

/* Modal handlers */
$('btnPeerReview').onclick = () => {
  renderPeerReviewForm();
  $('peerReviewModal').style.display = 'flex';
};

$('btnClosePeerReview').onclick = () => {
  $('peerReviewModal').style.display = 'none';
};

$('btnSavePeerReview').onclick = () => {
  alert('✅ Penilaian antar kelompok disimpan!');
  $('peerReviewModal').style.display = 'none';
};

/* Initialize */
renderChecklist();
})();
