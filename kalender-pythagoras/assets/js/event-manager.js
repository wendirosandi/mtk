/* =====================================================
   event-manager.js  v1.1
   - URL CSV sudah diperbarui
   - Logic: Kelas kosong atau "-" akan tampil di SEMUA filter kelas
   - Case-insensitive matching (8A == 8a)
===================================================== */
(function(){
"use strict";

/* ============================================================
   KONFIGURASI URL CSV (Sudah diupdate)
============================================================ */
var CONFIG = {
  csvEvent: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_0QUtc_l6jFnb0kuSmfXmD4oaNRUHXIj7m0knsL72e-HIX-MvhrtcnwfwaK9rwDbyYIwx2OxUgPrD/pub?gid=0&single=true&output=csv',
  csvKelompok: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_0QUtc_l6jFnb0kuSmfXmD4oaNRUHXIj7m0knsL72e-HIX-MvhrtcnwfwaK9rwDbyYIwx2OxUgPrD/pub?gid=1883704425&single=true&output=csv',
  defaultKelas: 'Semua',
  defaultBulan: 'Semua',
  defaultJenis: 'Semua'
};

/* ============================================================
   STATE
============================================================ */
var state = {
  events: [],
  kelompok: [],
  activeTab: 'event',
  filter: {
    kelas: CONFIG.defaultKelas,
    bulan: CONFIG.defaultBulan,
    jenis: CONFIG.defaultJenis,
    kelasKelompok: CONFIG.defaultKelas,
    bulanKelompok: CONFIG.defaultBulan
  },
  isLoading: false,
  lastFetch: null
};

/* ============================================================
   UTILS
============================================================ */
function $(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

function formatDate(tanggalStr) {
  if (!tanggalStr) return '-';
  var d = new Date(tanggalStr);
  if (isNaN(d.getTime())) return tanggalStr; // Fallback jika format bukan tanggal valid
  var bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

function showToast(msg, type) {
  type = type || 'success';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = (type === 'success' ? '✅ ' : '⚠️ ') + msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 2500);
}

/* ============================================================
   FETCH DATA (dengan cache busting)
============================================================ */
function fetchCSV(url) {
  var bustUrl = url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
  return new Promise(function(resolve, reject) {
    Papa.parse(bustUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (results.errors && results.errors.length > 0) {
          console.warn('CSV parse warnings:', results.errors);
        }
        resolve(results.data || []);
      },
      error: function(err) {
        reject(err);
      }
    });
  });
}

async function loadData(showLoadingToast) {
  if (state.isLoading) return;
  state.isLoading = true;
  
  var refreshBtn = $('btnRefresh');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="spinner"></span> Memuat...';
  }
  disableFilters(true);
  
  try {
    var results = await Promise.all([
      fetchCSV(CONFIG.csvEvent).catch(function(e) {
        console.error('Gagal load Events:', e);
        showToast('Gagal memuat data Event. Cek koneksi atau URL CSV.', 'error');
        return [];
      }),
      fetchCSV(CONFIG.csvKelompok).catch(function(e) {
        console.error('Gagal load Kelompok:', e);
        showToast('Gagal memuat data Kelompok. Cek koneksi atau URL CSV.', 'error');
        return [];
      })
    ]);
    
    state.events = results[0];
    state.kelompok = results[1];
    state.lastFetch = new Date();
    
    populateFilterOptions();
    renderActiveTab();
    
    if (showLoadingToast) {
      showToast('Data berhasil diperbarui dari Google Sheet!');
    }
  } catch (err) {
    console.error('Load error:', err);
    showToast('Terjadi kesalahan sistem saat memuat data', 'error');
  } finally {
    state.isLoading = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '🔄 Perbarui Data';
    }
    disableFilters(false);
  }
}

function disableFilters(disabled) {
  qsa('.filter-select').forEach(function(el) { el.disabled = disabled; });
}

/* ============================================================
   POPULATE FILTER OPTIONS (Dinamis & Bersih)
============================================================ */
function populateFilterOptions() {
  // 1. Kumpulkan semua Kelas unik (abaikan kosong atau "-")
  var kelasSet = new Set();
  state.events.forEach(function(e) { 
    var k = (e.kelas || '').trim().toUpperCase();
    if (k && k !== '-' && k !== 'SEMUA') kelasSet.add(k); 
  });
  state.kelompok.forEach(function(k) { 
    var val = (k.kelas || '').trim().toUpperCase();
    if (val && val !== '-' && val !== 'SEMUA') kelasSet.add(val); 
  });
  
  var kelasList = ['Semua'].concat(Array.from(kelasSet).sort());
  
  // 2. Bulan (Statis)
  var bulanList = ['Semua','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  
  // 3. Jenis Event (Dinamis)
  var jenisSet = new Set();
  state.events.forEach(function(e) { 
    var j = (e.jenis_event || '').trim();
    if (j) jenisSet.add(j); 
  });
  var jenisList = ['Semua'].concat(Array.from(jenisSet).sort());
  
  // Render dropdowns
  renderSelect('filterKelas', kelasList, state.filter.kelas);
  renderSelect('filterBulan', bulanList, state.filter.bulan);
  renderSelect('filterJenis', jenisList, state.filter.jenis);
  renderSelect('filterKelasKelompok', kelasList, state.filter.kelasKelompok);
  renderSelect('filterBulanKelompok', bulanList, state.filter.bulanKelompok);
}

function renderSelect(id, options, selected) {
  var el = $(id);
  if (!el) return;
  var currentVal = el.value; // Simpan nilai saat ini agar tidak reset saat re-render
  el.innerHTML = '';
  options.forEach(function(opt) {
    var o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    // Pilih jika sesuai, atau jika ini pertama kali load dan cocok dengan default
    if (opt === selected || (currentVal && opt === currentVal)) o.selected = true;
    el.appendChild(o);
  });
}

/* ============================================================
   TAB SWITCHING
============================================================ */
function switchTab(tab) {
  state.activeTab = tab;
  qsa('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
  var targetBtn = $('tab-' + tab);
  if (targetBtn) targetBtn.classList.add('active');
  
  qsa('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  var targetContent = $('content-' + tab);
  if (targetContent) targetContent.classList.add('active');
  
  renderActiveTab();
}

function renderActiveTab() {
  if (state.activeTab === 'event') renderEvents();
  else if (state.activeTab === 'kelompok') renderKelompok();
}

/* ============================================================
   RENDER EVENTS (Dengan Logic "Kelas Kosong/-" = Semua Kelas)
============================================================ */
function renderEvents() {
  var container = $('eventContainer');
  if (!container) return;
  
  var filtered = state.events.filter(function(e) {
    var kelasVal = (e.kelas || '').trim().toUpperCase();
    
    // LOGIKA UTAMA: Jika kelas kosong, "-", atau "SEMUA", maka tampilkan di filter apa pun
    var isGlobalEvent = (kelasVal === '' || kelasVal === '-' || kelasVal === 'SEMUA');
    
    var matchKelas = state.filter.kelas === 'Semua' || isGlobalEvent || kelasVal === state.filter.kelas.toUpperCase();
    var matchBulan = state.filter.bulan === 'Semua' || ((e.bulan || '').trim().toUpperCase() === state.filter.bulan.toUpperCase());
    var matchJenis = state.filter.jenis === 'Semua' || ((e.jenis_event || '').trim().toUpperCase() === state.filter.jenis.toUpperCase());
    
    return matchKelas && matchBulan && matchJenis;
  });
  
  // Sort by tanggal (ascending)
  filtered.sort(function(a, b) {
    if (!a.tanggal) return 1;
    if (!b.tanggal) return -1;
    return new Date(a.tanggal) - new Date(b.tanggal);
  });
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">📭 Tidak ada event yang cocok dengan filter saat ini.</div>';
    return;
  }
  
  var html = '<div class="event-grid">';
  filtered.forEach(function(e) {
    var jenis = (e.jenis_event || 'Lainnya').trim().toLowerCase();
    var colorClass = 'event-lainnya';
    var icon = '📌';
    
    if (jenis.includes('ulang') || jenis.includes('ultah') || jenis.includes('lahir')) {
      colorClass = 'event-ultah'; icon = '🎂';
    } else if (jenis.includes('deadline') || jenis.includes('tenggat') || jenis.includes('kumpul')) {
      colorClass = 'event-deadline'; icon = '⏰';
    } else if (jenis.includes('presentasi') || jenis.includes('ujian') || jenis.includes('showcase')) {
      colorClass = 'event-presentasi'; icon = '🎤';
    } else if (jenis.includes('hari besar') || jenis.includes('libur') || jenis.includes('nasional')) {
      colorClass = 'event-haribes'; icon = '🎉';
    }
    
    html += '<div class="event-card ' + colorClass + '">';
    html += '<div class="event-icon">' + icon + '</div>';
    html += '<div class="event-body">';
    html += '<div class="event-date">' + formatDate(e.tanggal) + '</div>';
    html += '<div class="event-name">' + (e.nama || e.nama_kegiatan || 'Kegiatan Tanpa Nama') + '</div>';
    html += '<div class="event-meta">';
    if (e.kelas && e.kelas.trim() !== '-' && e.kelas.trim() !== '') {
      html += '<span class="badge badge-kelas">🏫 ' + e.kelas.trim() + '</span>';
    } else {
      html += '<span class="badge badge-kelas" style="background:#f3f4f6;color:#6b7280;">🌐 Semua Kelas</span>';
    }
    if (e.jenis_event) html += '<span class="badge badge-jenis">' + e.jenis_event.trim() + '</span>';
    html += '</div>';
    if (e.keterangan) html += '<div class="event-note">💬 ' + e.keterangan.trim() + '</div>';
    html += '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

/* ============================================================
   RENDER KELOMPOK
============================================================ */
function renderKelompok() {
  var container = $('kelompokContainer');
  if (!container) return;
  
  var filtered = state.kelompok.filter(function(k) {
    var kelasVal = (k.kelas || '').trim().toUpperCase();
    var isGlobalGroup = (kelasVal === '' || kelasVal === '-' || kelasVal === 'SEMUA');
    
    var matchKelas = state.filter.kelasKelompok === 'Semua' || isGlobalGroup || kelasVal === state.filter.kelasKelompok.toUpperCase();
    var matchBulan = state.filter.bulanKelompok === 'Semua' || ((k.bulan || '').trim().toUpperCase() === state.filter.bulanKelompok.toUpperCase());
    
    return matchKelas && matchBulan;
    });
  
  // Sort by kelas, then bulan
  filtered.sort(function(a, b) {
    var kA = (a.kelas || '').trim().toUpperCase();
    var kB = (b.kelas || '').trim().toUpperCase();
    if (kA !== kB) return kA.localeCompare(kB);
    return (a.bulan || '').localeCompare(b.bulan || '');
  });
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">👥 Tidak ada kelompok yang cocok dengan filter.</div>';
    return;
  }
  
  var html = '<div class="kelompok-grid">';
  filtered.forEach(function(k) {
    var status = (k.status || 'On Track').trim().toLowerCase();
    var statusClass = 'status-ontrack';
    var statusIcon = '✅';
    
    if (status.includes('bimbingan') || status.includes('perlu') || status.includes('warning') || status.includes('revisi')) {
      statusClass = 'status-warning'; statusIcon = '⚠️';
    } else if (status.includes('selesai') || status.includes('done') || status.includes('lunas')) {
      statusClass = 'status-done'; statusIcon = '🏆';
    }
    
    var anggota = (k.anggota || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    var displayKelas = (k.kelas && k.kelas.trim() !== '-' && k.kelas.trim() !== '') ? k.kelas.trim() : 'Semua Kelas';
    
    html += '<div class="kelompok-card">';
    html += '<div class="kelompok-header">';
    html += '<div class="kelompok-nama">' + (k.nama_kelompok || k.nama || 'Kelompok') + '</div>';
    html += '<div class="kelompok-status ' + statusClass + '">' + statusIcon + ' ' + (k.status || 'On Track') + '</div>';
    html += '</div>';
    html += '<div class="kelompok-topik">📐 ' + (k.topik_pembuktian || k.topik || 'Belum ditentukan') + '</div>';
    html += '<div class="kelompok-meta">';
    html += '<span class="badge badge-kelas">🏫 ' + displayKelas + '</span>';
    if (k.bulan) html += '<span class="badge badge-bulan">📅 ' + k.bulan.trim() + '</span>';
    html += '</div>';
    if (k.ketua) html += '<div class="kelompok-ketua">👑 Ketua: <strong>' + k.ketua.trim() + '</strong></div>';
    if (anggota.length > 0) {
      html += '<div class="kelompok-anggota">';
      html += '<div class="anggota-label">Anggota:</div>';
      html += '<div class="anggota-tags">';
      anggota.forEach(function(a) {
        html += '<span class="anggota-tag">' + a + '</span>';
      });
      html += '</div></div>';
    }
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

/* ============================================================
   EVENT LISTENERS
============================================================ */
function bindEvents() {
  // Tab buttons
  qsa('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(this.dataset.tab);
    });
  });
  
  // Filter Event
  $('filterKelas').addEventListener('change', function() {
    state.filter.kelas = this.value; renderEvents();
  });
  $('filterBulan').addEventListener('change', function() {
    state.filter.bulan = this.value; renderEvents();
  });
  $('filterJenis').addEventListener('change', function() {
    state.filter.jenis = this.value; renderEvents();
  });
  
  // Filter Kelompok
  $('filterKelasKelompok').addEventListener('change', function() {
    state.filter.kelasKelompok = this.value; renderKelompok();
  });
  $('filterBulanKelompok').addEventListener('change', function() {
    state.filter.bulanKelompok = this.value; renderKelompok();
  });
  
  // Refresh button
  $('btnRefresh').addEventListener('click', function() {
    loadData(true);
  });
  
  // Last fetch info updater
  if ($('lastFetchInfo')) {
    setInterval(function() {
      if (state.lastFetch) {
        var diff = Math.floor((Date.now() - state.lastFetch.getTime()) / 60000);
        $('lastFetchInfo').textContent = 'Terakhir diperbarui: ' + (diff < 1 ? 'baru saja' : diff + ' menit lalu');
      }
    }, 30000);
  }
}

/* ============================================================
   INIT
============================================================ */
function init() {
  bindEvents();
  loadData(false); // Load pertama tanpa toast
}

// Expose for debugging/console
window.EventManager = {
  reload: function() { loadData(true); },
  getState: function() { return state; },
  setConfig: function(cfg) {
    for (var k in cfg) CONFIG[k] = cfg[k];
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();