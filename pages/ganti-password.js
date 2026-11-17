/* ============ pages/ganti-password.js — wajib ganti password saat login pertama ============ */
Router.register('ganti-password', async () => `
  <div class="max-w-md mx-auto pt-10">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-extrabold text-slate-800">Ganti Password</h1>
      <p class="text-sm text-slate-500">Akun ini memakai password sementara. Buat password baru sebelum melanjutkan.</p>
    </div>
    <div class="bg-white rounded-2xl shadow-xl p-6">
      <form id="gp-form" class="space-y-3">
        <div>
          <label style="font-size:12px;font-weight:700">Password saat ini</label>
          <input id="gp-current" type="password" autocomplete="current-password" class="w-full border rounded-xl px-4 py-3" placeholder="Password sementara">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700">Password baru (min. 12)</label>
          <input id="gp-new" type="password" autocomplete="new-password" class="w-full border rounded-xl px-4 py-3" placeholder="Password baru">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700">Ulangi password baru</label>
          <input id="gp-confirm" type="password" autocomplete="new-password" class="w-full border rounded-xl px-4 py-3" placeholder="Ulangi password baru">
        </div>
        <button id="gp-submit" type="submit" class="w-full bg-sky-600 text-white font-bold py-3 rounded-xl">Simpan Password</button>
        <button id="gp-logout" type="button" class="w-full bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl">Keluar</button>
      </form>
      <div id="gp-msg" class="text-sm" style="margin-top:10px"></div>
    </div>
  </div>
`);

window.init_ganti_password = async () => {
  const $ = s => document.querySelector(s);
  await API.ready;

  if (!API.sess()) { Router.go('login'); return; }

  $('#gp-logout').onclick = () => API.logout();

  $('#gp-form').onsubmit = async e => {
    e.preventDefault();
    const current = $('#gp-current').value;
    const next = $('#gp-new').value;
    const confirm = $('#gp-confirm').value;
    const msg = $('#gp-msg');
    if (next.length < 12) { msg.style.color = '#b91c1c'; msg.textContent = 'Password baru minimal 12 karakter.'; return; }
    if (next !== confirm) { msg.style.color = '#b91c1c'; msg.textContent = 'Konfirmasi password tidak sama.'; return; }
    const btn = $('#gp-submit');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      const r = await LMS.supabase.functions.invoke('admin-users', {
        body: { action: 'change_password', current_password: current, new_password: next }
      });
      let data = r.data;
      if (r.error) {
        let m = r.error.message || 'Gagal';
        try {
          const ctx = r.error.context;
          if (ctx && typeof ctx.json === 'function') {
            const j = await ctx.json();
            if (j && j.msg) m = j.msg;
          }
        } catch (err) { /* biarkan */ }
        data = { ok: false, msg: m };
      }
      if (!data || !data.ok) {
        msg.style.color = '#b91c1c';
        msg.textContent = (data && data.msg) || 'Gagal mengganti password.';
        return;
      }
      API.patchMeta({ mustChangePassword: false });
      msg.style.color = '#047857';
      msg.textContent = 'Password berhasil diganti. Mengalihkan...';
      const role = API.getRole();
      setTimeout(() => {
        Router.go(role === 'admin' ? 'admin-dash' : role === 'guru' ? 'guru-dash' : 'siswa-dash');
      }, 600);
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan Password';
    }
  };
};
