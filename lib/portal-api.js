/* ============ PORTAL API — Supabase-first, fallback legacy GAS ============ */
window.API = (function () {
  const $ = s => document.querySelector(s);
  const KEY = 'LMS_SESS';
  const META = 'LMS_META';

  const hasTransport = () => !!(window.Transport && window.Transport.post);

  /* ---- HTTP primitive (legacy hanya bila adapter Supabase tidak ada) ---- */
  const legacyPost = (payload) =>
    fetch(window.CFG.GS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

  const postRaw = (payload) => hasTransport() ? window.Transport.post(payload) : legacyPost(payload);

  /* ---- Sesi (flag + metadata; sesi asli di Supabase Auth) ---- */
  const sess = () => localStorage.getItem(KEY) === '1';
  const setSess = (meta) => {
    localStorage.setItem(KEY, '1');
    localStorage.setItem(META, JSON.stringify(meta || {}));
  };
  const clearSess = () => { localStorage.removeItem(KEY); localStorage.removeItem(META); };
  const getMeta = () => { try { return JSON.parse(localStorage.getItem(META) || '{}'); } catch (e) { return {}; } };
  const getRole = () => getMeta().role || null;

  /* ---- Auth call ---- */
  async function auth(action, payload) {
    const body = Object.assign({}, payload || {}, { action: action });
    const r = await postRaw(body);
    if (r && r.msg && /sesi tidak valid/i.test(r.msg)) {
      clearSess();
      Router.go('login');
      throw new Error('SESSION_EXPIRED');
    }
    return r;
  }

  async function login(u, p) {
    const r = await postRaw({ action: 'loginSiswa', u: u, p: p });
    if (r && r.ok) {
      setSess({
        username: r.username, nama: r.nama, kelas: r.kelas, kategori: r.kategori,
        role: 'siswa', info: r.info || {}
      });
    }
    return r;
  }

  async function loginGuru(u, p) {
    const r = await postRaw({ action: 'loginGuru', u: u, p: p });
    if (r && r.ok) {
      const i = r.info || {};
      setSess({
        username: i.username, nama: i.namaGuru, namaGuru: i.namaGuru,
        namaSekolah: i.namaSekolah, role: i.role || 'guru',
        info: i
      });
    }
    return r;
  }

  async function loginAdmin(u, p) {
    const r = await postRaw({ action: 'loginAdmin', u: u, p: p });
    if (r && r.ok) {
      const i = r.info || {};
      setSess({
        username: i.username, nama: i.namaGuru, namaGuru: i.namaGuru,
        namaSekolah: i.namaSekolah, role: 'admin', info: i
      });
    }
    return r;
  }

  function logout() {
    clearSess();
    if (window.LMS && window.LMS.signOut) window.LMS.signOut();
    Router.go('login');
  }

  /* ---- UI helpers ---- */
  let _pend = 0;
  function showLoader(m) {
    const el = $('#loader-overlay');
    if (el) { el.classList.remove('hidden'); $('#loader-text').textContent = m || 'Memproses...'; }
    _pend++;
  }
  function hideLoader() {
    _pend = Math.max(0, _pend - 1);
    const el = $('#loader-overlay');
    if (el && _pend === 0) el.classList.add('hidden');
  }
  async function call(promiseFn) {
    showLoader();
    try { const r = await promiseFn(); hideLoader(); return r; }
    catch (e) { hideLoader(); toast('❌ ' + (e.message || 'Gagal')); throw e; }
  }
  function toast(m) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---- Tujuan setelah login (dipakai modul eksternal) ---- */
  function nextTarget() {
    var raw = null;
    try {
      raw = new URLSearchParams(location.search).get('next')
        || sessionStorage.getItem('LMS_NEXT');
    } catch (e) { raw = null; }
    if (!raw || raw.charAt(0) !== '/' || raw.indexOf('//') === 0) return null;
    try {
      var u = new URL(raw, location.origin);
      if (u.origin !== location.origin) return null;
      return u.pathname + u.search + u.hash;
    } catch (e) { return null; }
  }

  function clearNext() {
    try { sessionStorage.removeItem('LMS_NEXT'); } catch (e) { /* abaikan */ }
  }

  /* ---- Restore sesi Supabase saat halaman dimuat ---- */
  const ready = (function () {
    if (!window.LMS || !window.LMS.whenReady) return Promise.resolve(false);
    return window.LMS.whenReady().then(async () => {
      try {
        const s = await window.LMS.supabase.auth.getSession();
        const hasSession = !!(s && s.data && s.data.session);
        if (hasSession) {
          const m = await window.LMS.profileMeta();
          if (m) setSess(m); else clearSess();
        } else if (sess()) {
          clearSess();
        }
        return hasSession;
      } catch (e) { return false; }
    });
  })();

  return {
    postRaw, auth, login, loginGuru, loginAdmin, logout, sess, getRole, getMeta,
    call, toast, showLoader, hideLoader, ready, nextTarget, clearNext
  };
})();
