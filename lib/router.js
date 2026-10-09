/* ============ ROUTER — navigasi hash-based ============ */
window.Router = (function(){
  const routes = {};
  let current = null;
  
  function register(name, loader){ routes[name] = loader; }
  function go(name, params){ location.hash = '#'+name + (params ? '?'+new URLSearchParams(params).toString() : ''); }
  function currentName(){ return (location.hash.slice(1).split('?')[0]) || 'login'; }
  function currentParams(){ const q = location.hash.split('?')[1]||''; return Object.fromEntries(new URLSearchParams(q)); }
  
  
async function resolve() {
  const name = currentName();
  const loader = routes[name] || routes['login'];
  const role = API.getRole();

  // Pastikan halaman login tersedia
  if (!loader) {
    console.error('Route tidak ditemukan:', name);
    return;
  }

  // Guard: halaman membutuhkan login
  if (name !== 'login' && !API.sess()) {
    go('login');
    return;
  }

  // Guard: role mismatch
  if (name.startsWith('guru-') && role !== 'guru') {
    go('login');
    API.toast('Akses guru diperlukan');
    return;
  }

  if (name.startsWith('siswa-') && role !== 'siswa') {
    go('login');
    API.toast('Akses siswa diperlukan');
    return;
  }

  // Gunakan JavaScript murni, tanpa $
  const main = document.getElementById('main');

  if (!main) {
    console.error('Elemen #main tidak ditemukan.');
    return;
  }

  main.classList.add('hidden');
  main.innerHTML = '';

  API.showLoader();

  try {
    const html = await loader(currentParams());

    main.innerHTML = html;
    main.classList.remove('hidden');

    current = name;

    const init = window['init_' + name];

    if (typeof init === 'function') {
      await init(currentParams());
    }
  } catch (e) {
    console.error('Gagal memuat route:', name, e);

    main.innerHTML =
      '<div class="p-8 text-center text-rose-600">' +
      'Gagal memuat halaman. Silakan coba kembali.' +
      '</div>';

    main.classList.remove('hidden');
  } finally {
    API.hideLoader();
  }
}
  
  window.addEventListener('hashchange', resolve);
  window.addEventListener('load', resolve);
  
  return { register, go, currentName, currentParams, resolve };
})();