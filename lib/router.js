/* ============ ROUTER — navigasi hash-based ============ */
window.Router = (function(){
  const routes = {};
  let current = null;
  
  function register(name, loader){ routes[name] = loader; }
  function go(name, params){ location.hash = '#'+name + (params ? '?'+new URLSearchParams(params).toString() : ''); }
  function currentName(){ return (location.hash.slice(1).split('?')[0]) || 'login'; }
  function currentParams(){ const q = location.hash.split('?')[1]||''; return Object.fromEntries(new URLSearchParams(q)); }
  
  
async function doResolve() {
  const name = currentName();
  const role = API.getRole();

  if (name === 'login' && window.Shell) Shell.hide();

  // Guard: halaman membutuhkan login
  if (name !== 'login' && !API.sess()) {
    go('login');
    return;
  }

  // Guard: admin
  if (name.startsWith('admin-') && role !== 'admin') {
    go(role === 'guru' ? 'guru-dash' : 'login');
    API.toast('Akses admin diperlukan');
    return;
  }

  // Guard: role mismatch
  if (name.startsWith('guru-') && role !== 'guru' && role !== 'admin') {
    go('login');
    API.toast('Akses guru diperlukan');
    return;
  }

  if (name.startsWith('siswa-') && role !== 'siswa') {
    go('login');
    API.toast('Akses siswa diperlukan');
    return;
  }

  const loader = routes[name] || routes['login'];
  if (!loader) {
    console.error('Route tidak ditemukan:', name);
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
    if (window.Shell) Shell.sync(name, role);

    current = name;

    const init = window['init_' + name.replace(/-/g, '_')];

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
    if (window.Shell) Shell.sync(name, role);
  } finally {
    API.hideLoader();
  }
}
  
  let queue = Promise.resolve();
  function resolve() {
    queue = queue.then(doResolve, doResolve);
    return queue;
  }

  window.addEventListener('hashchange', resolve);
  window.addEventListener('load', resolve);
  
  return { register, go, currentName, currentParams, resolve };
})();