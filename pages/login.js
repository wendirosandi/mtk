/* ============ pages/login.js ============ */
Router.register('login', async () => `
  <div class="max-w-md mx-auto pt-10">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-extrabold text-slate-800" id="lg-judul">
        Aplikasi Web Belajar Interaktif
      </h1>
      <p class="text-sm text-slate-500" id="lg-sub"></p>
    </div>

    <div class="bg-white rounded-2xl shadow-xl p-6">
      <h2 class="font-bold text-lg text-center mb-4">Masuk</h2>

      <div class="grid grid-cols-3 gap-2 mb-4">
        <button id="role-siswa" class="py-2.5 rounded-xl font-bold text-xs bg-sky-600 text-white">
          🎓 Siswa
        </button>
        <button id="role-guru" class="py-2.5 rounded-xl font-bold text-xs bg-gray-200 text-gray-600">
          🏫 Guru
        </button>
        <button id="role-admin" class="py-2.5 rounded-xl font-bold text-xs bg-gray-200 text-gray-600">
          🛠️ Admin
        </button>
      </div>

      <div id="form-siswa">
        <input id="in-user" class="w-full border rounded-xl px-4 py-3 mb-3" placeholder="Username">
        <input id="in-pass" type="password" class="w-full border rounded-xl px-4 py-3 mb-4" placeholder="Password">
      </div>

      <div id="form-guru" class="hidden">
        <input id="in-guru-user" class="w-full border rounded-xl px-4 py-3 mb-3" placeholder="Username Guru">
        <input id="in-guru-pass" type="password" class="w-full border rounded-xl px-4 py-3 mb-4" placeholder="Password Guru">
      </div>

      <div id="form-admin" class="hidden">
        <input id="in-admin-user" class="w-full border rounded-xl px-4 py-3 mb-3" placeholder="Username Admin">
        <input id="in-admin-pass" type="password" class="w-full border rounded-xl px-4 py-3 mb-4" placeholder="Password Admin">
      </div>

      <button id="btn-login" class="w-full bg-sky-600 text-white font-bold py-3 rounded-xl">
        Masuk →
      </button>
    </div>
  </div>
`);

window.init_login = async () => {
  const $ = (selector) => document.querySelector(selector);
  await API.ready;

  const next = API.nextTarget();
  if (API.sess()) {
    if (API.getMeta().mustChangePassword) { Router.go('ganti-password'); return; }
    const role = API.getRole();
    if (next) { API.clearNext(); location.replace(next); return; }
    Router.go(role === 'admin' ? 'admin-dash' : role === 'guru' ? 'guru-dash' : 'siswa-dash');
    return;
  }

  try {
    const i = await API.postRaw({ action: 'getPublicInfo' });
    $('#lg-judul').textContent = i.namaAplikasi;
    $('#lg-sub').textContent = i.namaSekolah + (i.namaGuru ? ' • ' + i.namaGuru : '');
  } catch (e) {
    console.error('Gagal mengambil informasi aplikasi:', e);
  }

  const BTN_ON = 'py-2.5 rounded-xl font-bold text-xs bg-sky-600 text-white';
  const BTN_OFF = 'py-2.5 rounded-xl font-bold text-xs bg-gray-200 text-gray-600';
  const roles = {
    siswa: { btn: $('#role-siswa'), form: $('#form-siswa') },
    guru: { btn: $('#role-guru'), form: $('#form-guru') },
    admin: { btn: $('#role-admin'), form: $('#form-admin') }
  };
  let role = 'siswa';

  function setRole(r) {
    role = r;
    Object.keys(roles).forEach(k => {
      roles[k].form.classList.toggle('hidden', k !== r);
      roles[k].btn.className = k === r ? BTN_ON : BTN_OFF;
    });
  }
  Object.keys(roles).forEach(r => { roles[r].btn.onclick = () => setRole(r); });

  $('#btn-login').onclick = async () => {
    const btn = $('#btn-login');
    btn.disabled = true;
    btn.textContent = 'Memverifikasi...';
    try {
      let r;
      if (role === 'siswa') r = await API.login($('#in-user').value.trim(), $('#in-pass').value);
      else if (role === 'guru') r = await API.loginGuru($('#in-guru-user').value.trim(), $('#in-guru-pass').value);
      else r = await API.loginAdmin($('#in-admin-user').value.trim(), $('#in-admin-pass').value);

      if (!r || !r.ok) {
        API.toast('❌ ' + ((r && r.msg) || 'Username/password salah'));
        return;
      }

      API.toast('✅ Masuk berhasil');
      if (r.mustChangePassword || API.getMeta().mustChangePassword) {
        Router.go('ganti-password');
        return;
      }
      const dest = API.nextTarget();
      if (dest) { API.clearNext(); location.replace(dest); return; }
      Router.go(role === 'admin' ? 'admin-dash' : role === 'guru' ? 'guru-dash' : 'siswa-dash');
    } catch (e) {
      console.error('Login gagal:', e);
      API.toast('❌ Gagal koneksi');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk →';
    }
  };
};
