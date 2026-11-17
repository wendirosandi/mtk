/* ============ pages/guru-kolab.js — approval pasangan ============ */
Router.register('guru-kolab', async () => `
  <div class="page-wrap">
    <div id="gk-head"></div>
    <div id="gk-body">${UI.skeleton(4)}</div>
  </div>
`);

window.init_guru_kolab = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  let rows = [];
  const TONE = { pending: 'warning', approved: 'success', rejected: 'danger', replaced: '' };

  $('#gk-head').innerHTML = UI.pageHeader({
    title: 'Kolaborasi',
    subtitle: 'Setujui atau tolak permintaan pasangan siswa.'
  });

  function card(r) {
    return `<div class="card" style="margin-bottom:8px">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="card-title">${esc(r.owner ? r.owner.full_name : '-')} + ${esc(r.partner ? r.partner.full_name : '-')}</div>
          <div class="card-sub">${esc(r.assessment ? r.assessment.code + ' — ' + r.assessment.title : 'Semua asesmen')}</div>
          <div class="card-sub">${esc(r.owner ? r.owner.username : '')} ↔ ${esc(r.partner ? r.partner.username : '')} · ${esc(r.at || '')}</div>
        </div>
        ${UI.badge(r.status, TONE[r.status] || '')}
      </div>
      ${r.status === 'pending' ? `<div class="flex gap-2" style="margin-top:10px">
        <button class="btn btn-primary btn-sm" data-approve="${esc(r.id)}">Setujui</button>
        <button class="btn btn-danger btn-sm" data-reject="${esc(r.id)}">Tolak</button>
      </div>` : ''}
    </div>`;
  }

  function render() {
    const pending = rows.filter(r => r.status === 'pending');
    const history = rows.filter(r => r.status !== 'pending').slice(0, 50);
    $('#gk-body').innerHTML =
      '<h3 style="font-weight:800;margin-bottom:8px">Menunggu persetujuan</h3>'
      + (pending.length ? pending.map(card).join('') : UI.empty('Tidak ada permintaan', 'Semua permintaan sudah diproses.'))
      + (history.length ? '<h3 style="font-weight:800;margin:16px 0 8px">Riwayat</h3>' + history.map(card).join('') : '');

    $('#gk-body').querySelectorAll('[data-approve],[data-reject]').forEach(b => b.onclick = async () => {
      const approve = b.hasAttribute('data-approve');
      if (!confirm(approve ? 'Setujui pasangan ini?' : 'Tolak pasangan ini?')) return;
      b.disabled = true;
      const r = await API.auth('guruKolabDecide', {
        id: b.dataset.approve || b.dataset.reject,
        decision: approve ? 'approve' : 'reject'
      });
      if (r && r.ok) { API.toast(approve ? '✅ Disetujui' : '✅ Ditolak'); await load(); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); b.disabled = false; }
    });
  }

  async function load() {
    const r = await API.auth('guruKolabData');
    if (!r || !r.ok) {
      $('#gk-body').innerHTML = UI.empty('Gagal memuat kolaborasi', (r && r.msg) || 'Coba lagi.');
      return;
    }
    rows = r.rows || [];
    render();
  }

  await load();
};
