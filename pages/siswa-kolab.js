/* ============ pages/siswa-kolab.js — pasangan kolaborasi ============ */
Router.register('siswa-kolab', async () => `
  <div class="page-wrap">
    <div id="sk-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">Ajukan Pasangan</div>
      <div class="grid gap-2" style="margin-top:8px">
        <select id="sk-assess" class="w-full border rounded-xl px-3 py-2 text-sm"></select>
        <input id="sk-partner" class="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Username pasangan (mis. 8-f-siswa2)">
        <input id="sk-note" class="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Catatan (opsional)">
        <button id="sk-send" type="button" class="btn btn-primary">Ajukan</button>
      </div>
      <p class="card-sub" style="margin-top:8px">Permintaan harus disetujui guru sebelum dipakai saat mengerjakan.</p>
    </div>
    <div id="sk-list">${UI.skeleton(4)}</div>
  </div>
`);

window.init_siswa_kolab = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { data: null };

  $('#sk-head').innerHTML = UI.pageHeader({
    title: 'Kolaborasi',
    subtitle: 'Pilih pasangan untuk asesmen yang mewajibkan/mengizinkan kerja berpasangan.'
  });

  const MODE = { required: 'Wajib', required_fixed: 'Wajib (fix)', optional: 'Opsional', optional_fixed: 'Opsional (fix)' };
  const TONE = { pending: 'warning', approved: 'success', rejected: 'danger', replaced: '' };

  function render() {
    const a = state.data.assessments || [];
    const pairs = state.data.pairs || [];
    $('#sk-assess').innerHTML = a.length
      ? a.map(x => `<option value="${esc(x.id)}">${esc(x.code)} — ${esc(x.title)} (${esc(MODE[x.collab_mode] || x.collab_mode)})</option>`).join('')
      : '<option value="">Tidak ada asesmen kolaborasi</option>';

    if (!a.length) {
      $('#sk-list').innerHTML = UI.empty('Belum ada asesmen kolaborasi', 'Guru belum membuka asesmen berpasangan.');
      return;
    }

    $('#sk-list').innerHTML = '<div class="space-y-2">' + a.map(x => {
      const mine = pairs.filter(p => p.assessmentId === x.id && (p.ownerId || p.partnerId));
      const active = mine.find(p => p.status === 'pending' || p.status === 'approved');
      const partner = active ? (active.isOwner ? active.partner : active.owner) : null;
      const status = active ? active.status : 'belum ada';
      return `<div class="card">
        <div class="flex items-start justify-between gap-3">
          <div><div class="card-title">${esc(x.title)}</div>
            <div class="card-sub">${esc(x.code)} · ${esc(MODE[x.collab_mode] || x.collab_mode)}</div>
            <div class="card-sub">${partner ? 'Pasangan: ' + esc(partner.full_name) + ' (' + esc(partner.username) + ')' : 'Belum ada pasangan'}</div>
          </div>
          ${UI.badge(status, TONE[status] || '')}
        </div>
        <div class="flex gap-2" style="margin-top:10px">
          ${!active ? `<button class="btn btn-secondary btn-sm" data-choose="${esc(x.id)}">Pilih untuk diajukan</button>` : ''}
          ${active && active.status === 'pending' && active.isOwner ? `<button class="btn btn-danger btn-sm" data-cancel="${esc(active.id)}">Batalkan</button>` : ''}
        </div>
      </div>`;
    }).join('') + '</div>';

    $('#sk-list').querySelectorAll('[data-choose]').forEach(b => b.onclick = () => {
      $('#sk-assess').value = b.dataset.choose;
      $('#sk-partner').focus();
    });
    $('#sk-list').querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
      if (!confirm('Batalkan permintaan pasangan?')) return;
      const r = await API.auth('siswaKolabCancel', { id: b.dataset.cancel });
      if (r && r.ok) { API.toast('✅ Dibatalkan'); await load(); }
      else API.toast('❌ ' + ((r && r.msg) || 'Gagal'));
    });
  }

  async function load() {
    const r = await API.auth('siswaKolabData');
    if (!r || !r.ok) {
      $('#sk-list').innerHTML = UI.empty('Gagal memuat kolaborasi', (r && r.msg) || 'Coba lagi.');
      return;
    }
    state.data = r;
    render();
  }

  $('#sk-send').onclick = async () => {
    const btn = $('#sk-send');
    btn.disabled = true;
    const r = await API.auth('siswaKolabRequest', {
      assessmentId: $('#sk-assess').value,
      partnerUsername: $('#sk-partner').value.trim(),
      note: $('#sk-note').value.trim()
    });
    btn.disabled = false;
    if (r && r.ok) {
      API.toast('✅ Permintaan dikirim');
      $('#sk-partner').value = ''; $('#sk-note').value = '';
      await load();
    } else API.toast('❌ ' + ((r && r.msg) || 'Gagal'));
  };

  await load();
};
