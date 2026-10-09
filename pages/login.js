
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

      <div class="grid grid-cols-2 gap-3 mb-4">
        <button id="role-siswa"
          class="py-2.5 rounded-xl font-bold text-sm bg-sky-600 text-white">
          👨‍🎓 Siswa
        </button>
        <button id="role-guru"
          class="py-2.5 rounded-xl font-bold text-sm bg-gray-200 text-gray-600">
          🏫 Guru
        </button>
      </div>

      <div id="form-siswa">
        <input id="in-user" class="w-full border rounded-xl px-4 py-3 mb-3"
          placeholder="Username">
        <input id="in-pass" type="password"
          class="w-full border rounded-xl px-4 py-3 mb-4"
          placeholder="Password">
      </div>

      <div id="form-guru" class="hidden">
        <input id="in-pin" type="password"
          class="w-full border rounded-xl px-4 py-3 mb-4"
          placeholder="PIN Guru">
      </div>

      <button id="btn-login"
        class="w-full bg-sky-600 text-white font-bold py-3 rounded-xl">
        Masuk →
      </button>
    </div>
  </div>
`);

window.init_login = async () => {
  // Helper lokal, tidak membutuhkan $ global
  const $ = (selector) => document.querySelector(selector);

  if (API.sess()) {
    Router.go(API.getRole() === 'guru' ? 'guru-dash' : 'siswa-dash');
    return;
  }

  try {
    const i = await API.postRaw({ action: 'getPublicInfo' });
    $('#lg-judul').textContent = i.namaAplikasi;
    $('#lg-sub').textContent = i.namaSekolah + ' • ' + i.namaGuru;
  } catch (e) {
    console.error('Gagal mengambil informasi aplikasi:', e);
  }

  let role = 'siswa';

  const siswa = $('#role-siswa');
  const guru = $('#role-guru');
  const formSiswa = $('#form-siswa');
  const formGuru = $('#form-guru');
  const btnLogin = $('#btn-login');

  siswa.onclick = () => {
    role = 'siswa';
    formSiswa.classList.remove('hidden');
    formGuru.classList.add('hidden');

    siswa.className =
      'py-2.5 rounded-xl font-bold text-sm bg-sky-600 text-white';
    guru.className =
      'py-2.5 rounded-xl font-bold text-sm bg-gray-200 text-gray-600';
  };

  guru.onclick = () => {
    role = 'guru';
    formGuru.classList.remove('hidden');
    formSiswa.classList.add('hidden');

    guru.className =
      'py-2.5 rounded-xl font-bold text-sm bg-sky-600 text-white';
    siswa.className =
      'py-2.5 rounded-xl font-bold text-sm bg-gray-200 text-gray-600';
  };

  btnLogin.onclick = async () => {
    btnLogin.disabled = true;
    btnLogin.textContent = 'Memverifikasi...';

    try {
      let r;

      if (role === 'siswa') {
        r = await API.login(
          $('#in-user').value.trim(),
          $('#in-pass').value
        );
      } else {
        r = await API.loginGuru($('#in-pin').value);
      }

      if (!r.ok) {
        API.toast(
          '❌ ' + (role === 'siswa'
            ? 'Username/password salah'
            : 'PIN salah')
        );
        return;
      }

      API.toast('✅ Masuk berhasil');
      Router.go(role === 'guru' ? 'guru-dash' : 'siswa-dash');

    } catch (e) {
      console.error('Login gagal:', e);
      API.toast('❌ Gagal koneksi');

    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Masuk →';
    }
  };
};