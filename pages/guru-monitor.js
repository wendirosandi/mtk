/* ============ pages/guru-monitor.js — monitoring pengerjaan ============ */
Router.register('guru-monitor', async () => `
  <div class="page-wrap">
    <div id="gm-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="flex flex-wrap gap-2 items-center">
        <select id="gm-status" class="border rounded-xl px-3 py-2 text-sm">
          <option value="">Semua status</option>
          <option value="in_progress">Sedang mengerjakan</option>
          <option value="submitted">Terkirim</option>
          <option value="graded">Sudah dinilai</option>
          <option value="void">Dibatalkan</option>
        </select>
        <div class="flex-1"></div>
        <button id="gm-refresh" type="button" class="btn btn-secondary btn-sm">Muat ulang</button>
      </div>
      <p id="gm-info" class="card-sub" style="margin-top:8px"></p>
    </div>
    <div id="gm-list"></div>
  </div>
`);

window.init_guru_monitor = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  let rows = [];

  const TONE = { in_progress: 'warning', submitted: 'info', graded: 'success', void: 'danger' };
  const LABEL = { in_progress: 'Mengerjakan', submitted: 'Terkirim', graded: 'Dinilai', void: 'Void' };

  $('#gm-head').innerHTML = UI.pageHeader({
    title: 'Monitoring',
    subtitle: 'Percobaan pengerjaan siswa pada asesmen yang berada dalam lingkup Anda.'
  });

  function render() {
    const st = $('#gm-status').value;
    const data = rows.filter(r => !st || r.status === st);
    $('#gm-info').textContent = data.length + ' percobaan';
    $('#gm-list').innerHTML = data.length
      ? '<div class="space-y-2">' + data.map(r => {
          const flags = r.flags && typeof r.flags === 'object' ? Object.keys(r.flags).filter(k => r.flags[k]) : [];
          return `<div class="card" style="padding:12px">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div style="font-weight:800;font-size:14px">${esc(r.nama)}</div>
                <div class="card-sub">${esc(r.username)} · ${esc(r.kode)} — ${esc(r.judul)}</div>
              </div>
              ${UI.badge(LABEL[r.status] || r.status, TONE[r.status] || '')}
            </div>
            <div class="card-sub" style="margin-top:8px">
              Mulai: ${esc(r.mulai || '-')}${r.selesai ? ' · Selesai: ' + esc(r.selesai) : ''}
              ${r.durasi !== '' ? ' · Durasi: ' + esc(r.durasi) + 's' : ''}
              ${flags.length ? ' · Flag: ' + esc(flags.join(', ')) : ''}
            </div>
          </div>`;
        }).join('') + '</div>'
      : UI.empty('Tidak ada percobaan', 'Belum ada siswa yang mengerjakan pada filter ini.');
  }

  async function load() {
    const r = await API.auth('guruMonitor');
    if (!r || !r.ok) {
      $('#gm-list').innerHTML = UI.empty('Gagal memuat monitoring', (r && r.msg) || 'Coba lagi.');
      return;
    }
    rows = r.rows || [];
    render();
  }

  $('#gm-status').onchange = render;
  $('#gm-refresh').onclick = load;
  await load();
};
