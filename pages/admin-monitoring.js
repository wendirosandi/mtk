/* ============ pages/admin-monitoring.js — aktivitas & audit ============ */
Router.register('admin-monitoring', async () => `
  <div class="page-wrap">
    <div id="am-head"></div>
    <div class="flex gap-2" style="margin-bottom:12px">
      <button id="am-tab-act" type="button" class="btn btn-primary btn-sm">Aktivitas</button>
      <button id="am-tab-audit" type="button" class="btn btn-secondary btn-sm">Audit Log</button>
      <div class="flex-1"></div>
      <button id="am-refresh" type="button" class="btn btn-secondary btn-sm">Muat ulang</button>
    </div>
    <div id="am-activity"></div>
    <div id="am-audit" class="hidden"></div>
  </div>
`);

window.init_admin_monitoring = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  let data = { activity: [], audit: [] };

  $('#am-head').innerHTML = UI.pageHeader({
    title: 'Monitoring',
    subtitle: 'Aktivitas belajar dan jejak audit sekolah.'
  });

  function renderActivity() {
    const rows = data.activity || [];
    $('#am-activity').innerHTML = rows.length
      ? '<div class="space-y-2">' + rows.map(a => `<div class="card" style="padding:12px">
          <div class="flex justify-between gap-2">
            <div><b>${esc(a.nama || a.username || '-')}</b>
              <span class="card-sub">${esc(a.username || '')}</span></div>
            <span class="card-sub">${esc(a.at || '')}</span>
          </div>
          <div class="card-sub" style="margin-top:4px">${esc(a.app || '')} · ${esc(a.section || '')} ·
            <b>${esc(a.event || a.kind || '')}</b> · ${esc(a.durasi)}s${a.skor != null ? ' · skor ' + esc(a.skor) : ''}</div>
        </div>`).join('') + '</div>'
      : UI.empty('Belum ada aktivitas', 'Log akan muncul setelah siswa/guru menggunakan aplikasi.');
  }

  function renderAudit() {
    const rows = data.audit || [];
    $('#am-audit').innerHTML = rows.length
      ? '<div class="space-y-2">' + rows.map(a => `<div class="card" style="padding:12px">
          <div class="flex justify-between gap-2">
            <div><b>${esc(a.action)}</b> <span class="card-sub">${esc(a.entity || '')}</span></div>
            <span class="card-sub">${esc(a.at || '')}</span>
          </div>
          <div class="card-sub" style="margin-top:4px">${esc(a.nama || a.username || '-')}
            ${a.entityId ? ' · ' + esc(a.entityId) : ''}</div>
          ${a.detail && Object.keys(a.detail).length ? '<pre style="font-size:10px;background:#f8fafc;padding:8px;border-radius:8px;margin-top:6px;white-space:pre-wrap">' + esc(JSON.stringify(a.detail, null, 2)) + '</pre>' : ''}
        </div>`).join('') + '</div>'
      : UI.empty('Belum ada audit', 'Aksi sensitif akan tercatat di sini.');
  }

  function show(tab) {
    const act = tab === 'act';
    $('#am-activity').classList.toggle('hidden', !act);
    $('#am-audit').classList.toggle('hidden', act);
    $('#am-tab-act').className = 'btn btn-sm ' + (act ? 'btn-primary' : 'btn-secondary');
    $('#am-tab-audit').className = 'btn btn-sm ' + (act ? 'btn-secondary' : 'btn-primary');
  }

  async function load() {
    const r = await API.auth('adminMonitoring');
    if (!r || !r.ok) {
      $('#am-activity').innerHTML = UI.empty('Gagal memuat monitoring', (r && r.msg) || 'Coba lagi.');
      return;
    }
    data = r;
    renderActivity();
    renderAudit();
  }

  $('#am-tab-act').onclick = () => show('act');
  $('#am-tab-audit').onclick = () => show('audit');
  $('#am-refresh').onclick = load;
  await load();
  show('act');
};
