/* ============ pages/admin-pengguna.js — pengguna & permintaan akun ============ */
Router.register('admin-pengguna', async () => `
  <div class="page-wrap">
    <div id="ap-head"></div>
    <div class="flex gap-2" style="margin-bottom:12px">
      <button id="ap-tab-users" type="button" class="btn btn-primary btn-sm">Pengguna</button>
      <button id="ap-tab-req" type="button" class="btn btn-secondary btn-sm">Permintaan Akun <span id="ap-req-count"></span></button>
    </div>
    <div id="ap-users">
      <div class="card" style="margin-bottom:12px">
        <div class="flex flex-wrap gap-2 items-center">
          <select id="ap-role" class="border rounded-xl px-3 py-2 text-sm">
            <option value="">Semua peran</option>
            <option value="admin">Admin</option>
            <option value="guru">Guru</option>
            <option value="siswa">Siswa</option>
          </select>
          <input id="ap-q" class="border rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px]" placeholder="Cari nama / username">
          <button id="ap-refresh" type="button" class="btn btn-secondary btn-sm">Muat ulang</button>
        </div>
      </div>
      <div id="ap-list">${UI.skeleton(4)}</div>
    </div>
    <div id="ap-requests" class="hidden"></div>
  </div>
`);

window.init_admin_pengguna = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { users: [], requests: [] };
  const ROLE_TONE = { admin: 'danger', guru: 'info', siswa: 'success' };

  $('#ap-head').innerHTML = UI.pageHeader({
    title: 'Pengguna',
    subtitle: 'Daftar akun sekolah dan permintaan perubahan akun.'
  });

  function renderUsers() {
    const role = $('#ap-role').value;
    const q = $('#ap-q').value.trim().toLowerCase();
    const rows = state.users.filter(u =>
      (!role || u.role === role) &&
      (!q || ((u.full_name || '') + ' ' + (u.username || '')).toLowerCase().indexOf(q) >= 0));
    $('#ap-list').innerHTML = rows.length
      ? '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs">'
        + '<thead><tr class="bg-slate-100"><th class="p-2 text-left">Nama</th><th class="p-2 text-left">Username</th>'
        + '<th class="p-2 text-left">Peran</th><th class="p-2 text-left">Status</th><th class="p-2 text-left">Kelas</th></tr></thead><tbody>'
        + rows.map(u => `<tr class="border-t">
            <td class="p-2"><b>${esc(u.full_name)}</b></td>
            <td class="p-2">${esc(u.username)}</td>
            <td class="p-2">${UI.badge(u.role, ROLE_TONE[u.role] || '')}</td>
            <td class="p-2">${esc(u.status || '-')}</td>
            <td class="p-2">${esc((u.settings || {}).kelas || '-')}</td>
          </tr>`).join('')
        + '</tbody></table></div>'
      : UI.empty('Tidak ada pengguna', 'Ubah filter atau tambahkan pengguna.');
    $('#ap-req-count').textContent = '(' + state.requests.filter(r => r.status === 'pending').length + ')';
  }

  function renderRequests() {
    const pending = state.requests.filter(r => r.status === 'pending');
    const history = state.requests.filter(r => r.status !== 'pending').slice(0, 20);
    function card(r) {
      return `<div class="card" style="margin-bottom:8px">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="card-title">${esc(r.nama || r.username || '-')}</div>
            <div class="card-sub">${esc(r.username || '')} · ${esc(r.kind)}</div>
          </div>
          ${UI.badge(r.status, r.status === 'pending' ? 'warning' : r.status === 'approved' ? 'success' : 'danger')}
        </div>
        <div class="card-sub" style="margin-top:6px">
          ${esc(r.current || '-')} → <b>${esc(r.requested || '-')}</b>
          ${r.reason ? '<br>Alasan: ' + esc(r.reason) : ''}
        </div>
        <div class="card-sub">${esc(r.at || '')}</div>
        ${r.status === 'pending' ? `<div class="flex gap-2" style="margin-top:10px">
          <button class="btn btn-primary btn-sm" data-approve="${esc(r.id)}">Setujui</button>
          <button class="btn btn-danger btn-sm" data-reject="${esc(r.id)}">Tolak</button>
        </div>` : ''}
      </div>`;
    }
    $('#ap-requests').innerHTML =
      '<h3 style="font-weight:800;margin-bottom:8px">Menunggu keputusan</h3>'
      + (pending.length ? pending.map(card).join('') : UI.empty('Tidak ada permintaan', 'Semua permintaan sudah diproses.'))
      + (history.length ? '<h3 style="font-weight:800;margin:16px 0 8px">Riwayat terbaru</h3>' + history.map(card).join('') : '');

    $('#ap-requests').querySelectorAll('[data-approve],[data-reject]').forEach(b => b.onclick = async () => {
      const approve = b.hasAttribute('data-approve');
      if (!confirm(approve ? 'Setujui permintaan ini?' : 'Tolak permintaan ini?')) return;
      b.disabled = true;
      const r = await API.auth('adminRequestDecide', {
        id: b.dataset.approve || b.dataset.reject,
        decision: approve ? 'approve' : 'reject'
      });
      if (r && r.ok) { API.toast(approve ? '✅ Disetujui' : '✅ Ditolak'); await load(); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); b.disabled = false; }
    });
  }

  async function load() {
    const [u, r] = await Promise.all([API.auth('adminUsers'), API.auth('adminRequests')]);
    state.users = (u && u.rows) || [];
    state.requests = (r && r.rows) || [];
    renderUsers();
    renderRequests();
  }

  function show(tab) {
    const users = tab === 'users';
    $('#ap-users').classList.toggle('hidden', !users);
    $('#ap-requests').classList.toggle('hidden', users);
    $('#ap-tab-users').className = 'btn btn-sm ' + (users ? 'btn-primary' : 'btn-secondary');
    $('#ap-tab-req').className = 'btn btn-sm ' + (users ? 'btn-secondary' : 'btn-primary');
  }

  $('#ap-tab-users').onclick = () => show('users');
  $('#ap-tab-req').onclick = () => show('requests');
  $('#ap-role').onchange = renderUsers;
  $('#ap-q').oninput = renderUsers;
  $('#ap-refresh').onclick = load;
  await load();
  show('users');
};
