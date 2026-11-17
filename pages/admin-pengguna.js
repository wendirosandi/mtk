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
          <button id="ap-new" type="button" class="btn btn-primary btn-sm">+ Pengguna</button>
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
        + '<th class="p-2 text-left">Peran</th><th class="p-2 text-left">Status</th><th class="p-2 text-left">Kelas</th><th class="p-2"></th></tr></thead><tbody>'
        + rows.map(u => `<tr class="border-t">
            <td class="p-2"><b>${esc(u.full_name)}</b></td>
            <td class="p-2">${esc(u.username)}</td>
            <td class="p-2">${UI.badge(u.role, ROLE_TONE[u.role] || '')}</td>
            <td class="p-2">${esc(u.status || '-')}</td>
            <td class="p-2">${esc((u.settings || {}).kelas || '-')}</td>
            <td class="p-2 text-right">
              <button class="btn btn-secondary btn-sm" data-reset="${esc(u.id)}" data-name="${esc(u.full_name)}">Reset</button>
              ${u.role !== 'admin' || u.status === 'nonaktif'
                ? (u.status === 'nonaktif'
                  ? `<button class="btn btn-primary btn-sm" data-activate="${esc(u.id)}">Aktifkan</button>`
                  : `<button class="btn btn-danger btn-sm" data-deactivate="${esc(u.id)}">Nonaktifkan</button>`)
                : ''}
            </td>
          </tr>`).join('')
        + '</tbody></table></div>'
      : UI.empty('Tidak ada pengguna', 'Ubah filter atau tambahkan pengguna.');
    $('#ap-req-count').textContent = '(' + state.requests.filter(r => r.status === 'pending').length + ')';
    $('#ap-list').querySelectorAll('[data-reset]').forEach(b => b.onclick = () => resetUser(b.dataset.reset, b.dataset.name));
    $('#ap-list').querySelectorAll('[data-deactivate]').forEach(b => b.onclick = () => setActive(b.dataset.deactivate, false));
    $('#ap-list').querySelectorAll('[data-activate]').forEach(b => b.onclick = () => setActive(b.dataset.activate, true));
  }

  function modal(title, fields, submitLabel, onSubmit) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = '<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto">'
      + '<h3 style="font-weight:800;font-size:18px;margin-bottom:12px">' + esc(title) + '</h3>'
      + '<form id="ap-form" class="space-y-3">'
      + fields.map(f => {
          const label = '<label style="font-size:12px;font-weight:700">' + esc(f.label) + '</label>';
          if (f.type === 'select') {
            return '<div>' + label + '<select name="' + esc(f.name) + '" class="w-full border rounded-xl px-3 py-2 text-sm">'
              + (f.options || []).map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')
              + '</select></div>';
          }
          return '<div>' + label + '<input name="' + esc(f.name) + '" type="' + esc(f.type || 'text') + '" class="w-full border rounded-xl px-3 py-2 text-sm"></div>';
        }).join('')
      + '<div class="flex gap-2" style="margin-top:16px"><button type="submit" class="btn btn-primary flex-1">' + esc(submitLabel) + '</button>'
      + '<button type="button" data-cancel class="btn btn-secondary">Batal</button></div></form></div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-cancel]').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
    wrap.querySelector('#ap-form').onsubmit = async e => {
      e.preventDefault();
      const f = wrap.querySelector('#ap-form');
      const v = {};
      fields.forEach(x => { v[x.name] = f.querySelector('[name="' + x.name + '"]').value.trim(); });
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Memproses...';
      const ok = await onSubmit(v);
      if (ok) { close(); await load(); }
      else { btn.disabled = false; btn.textContent = submitLabel; }
    };
  }

  function createUser() {
    modal('Tambah Pengguna', [
      { name: 'username', label: 'Username' },
      { name: 'full_name', label: 'Nama lengkap' },
      { name: 'role', label: 'Peran', type: 'select', options: [
        { value: 'siswa', label: 'Siswa' }, { value: 'guru', label: 'Guru' }, { value: 'admin', label: 'Admin' }
      ] },
      { name: 'gender', label: 'Jenis kelamin', type: 'select', options: [
        { value: '', label: '-' }, { value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }
      ] },
      { name: 'status', label: 'Status', type: 'select', options: [
        { value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }
      ] }
    ], 'Buat Akun', async v => {
      const r = await LMS.supabase.functions.invoke('admin-users', {
        body: Object.assign({ action: 'create' }, v)
      });
      if (r.error) { API.toast('❌ ' + r.error.message); return false; }
      if (!r.data || !r.data.ok) { API.toast('❌ ' + ((r.data && r.data.msg) || 'Gagal')); return false; }
      if (r.data.temp_password) showCredential(v.username, r.data.email, r.data.temp_password);
      else API.toast('✅ Akun dibuat');
      return true;
    });
  }

  function showCredential(username, email, password) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = '<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:460px">'
      + '<h3 style="font-weight:800;font-size:18px;margin-bottom:8px">Kredensial Sementara</h3>'
      + '<div style="font-size:13px;color:#b45309;margin-bottom:10px">Tampil sekali. Simpan di tempat aman; password tidak disimpan server.</div>'
      + '<div style="font-size:13px"><b>Username:</b> ' + esc(username) + '<br><b>Email login:</b> ' + esc(email)
      + '<br><b>Password:</b> <code>' + esc(password) + '</code></div>'
      + '<div class="flex gap-2" style="margin-top:16px"><button type="button" data-copy class="btn btn-primary flex-1">Salin</button>'
      + '<button type="button" data-close class="btn btn-secondary">Tutup</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-close]').onclick = () => wrap.remove();
    wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
    wrap.querySelector('[data-copy]').onclick = async () => {
      try {
        await navigator.clipboard.writeText('Username: ' + username + '\nEmail: ' + email + '\nPassword: ' + password);
        API.toast('✅ Disalin');
      } catch (e) { API.toast('Salin manual dari layar'); }
    };
  }

  async function setActive(id, active) {
    if (!confirm(active ? 'Aktifkan akun ini?' : 'Nonaktifkan akun ini? Riwayat akademik tetap disimpan.')) return;
    const r = await LMS.supabase.functions.invoke('admin-users', {
      body: { action: active ? 'reactivate' : 'deactivate', user_id: id }
    });
    let data = r.data;
    if (r.error) data = { ok: false, msg: r.error.message };
    if (!data || !data.ok) { API.toast('❌ ' + ((data && data.msg) || 'Gagal')); return; }
    API.toast(active ? '✅ Akun diaktifkan' : '✅ Akun dinonaktifkan');
    await load();
  }

  function resetUser(id, name) {
    modal('Reset Password — ' + name, [
      { name: 'password', label: 'Password baru (min. 8)', type: 'password' }
    ], 'Simpan', async v => {
      const r = await LMS.supabase.functions.invoke('admin-users', {
        body: { action: 'reset', user_id: id, password: v.password }
      });
      if (r.error) { API.toast('❌ ' + r.error.message); return false; }
      if (!r.data || !r.data.ok) { API.toast('❌ ' + ((r.data && r.data.msg) || 'Gagal')); return false; }
      API.toast('✅ Password direset');
      return true;
    });
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
  $('#ap-new').onclick = createUser;
  $('#ap-role').onchange = renderUsers;
  $('#ap-q').oninput = renderUsers;
  $('#ap-refresh').onclick = load;
  await load();
  show('users');
};
