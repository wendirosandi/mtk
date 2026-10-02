/**
 * APP_STATE.js — state, identitas, gate kolab, autosave, kirim
 * v2.0 (format multi-baris agar aman dari korup paste)
 */
window.LKPD = (function () {
  'use strict';
  const $ = s => document.querySelector(s);

  const S = { kode: null, sections: [], user: null, access: null, salt: null, cur: null, curStart: 0, booted: false };

  const post = p => fetch(CFG.GS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p) }).then(r => r.json());

  const sKey = () => 'LKPD_' + S.kode + '_' + (S.user ? S.user.username : 'anon');
  const load = () => { try { return JSON.parse(localStorage.getItem(sKey())) || {}; } catch (e) { return {}; } };
  const save = o => { const c = load(); Object.assign(c, o); localStorage.setItem(sKey(), JSON.stringify(c)); };

  const mulberry32 = a => function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  function rng() { const st = load(); if (!st.salt) save({ salt: (Date.now() % 2147483647) }); S.salt = load().salt; Math.random = mulberry32(S.salt); }

  function identity() {
    const q = new URLSearchParams(location.search);
    if (q.get('s')) return { sess: q.get('s') };
    const ds = JSON.parse(localStorage.getItem('DIRECT_SESSION') || 'null');
    if (ds && ds.username) return { username: ds.username, direct: ds };
    if (q.get('d')) return { token: q.get('d') };
    return null;
  }

  /* ---- loader / toast ---- */
  function showLoader(m) {
    let o = $('#lkpd-loader');
    if (!o) {
      o = document.createElement('div');
      o.id = 'lkpd-loader';
      o.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.75)';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:16px;padding:22px 28px;box-shadow:0 10px 30px rgba(0,0,0,.15);text-align:center';
      const spin = document.createElement('div');
      spin.style.cssText = 'width:42px;height:42px;border-radius:50%;border:5px solid #e0e7ff;border-top-color:#0f766e;animation:spin .8s linear infinite;margin:0 auto 10px';
      const txt = document.createElement('div');
      txt.id = 'lkpd-loader-t';
      txt.style.cssText = 'font:700 13px sans-serif';
      txt.textContent = '…';
      box.appendChild(spin); box.appendChild(txt); o.appendChild(box);
      document.body.appendChild(o);
    }
    $('#lkpd-loader-t').textContent = m || 'Memproses...';
    o.style.display = 'flex';
  }
  function hideLoader() { const o = $('#lkpd-loader'); if (o) o.style.display = 'none'; }
  function toast(m) {
    let t = $('#lkpd-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'lkpd-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#0f172a;color:#fff;font:600 12px sans-serif;padding:10px 16px;border-radius:999px;z-index:10000;opacity:0;transition:.3s';
      document.body.appendChild(t);
    }
    t.textContent = m;
    t.style.opacity = 1;
    setTimeout(function () { t.style.opacity = 0; }, 2600);
  }

  /* ---- autosave ---- */
  function wireAutosave() {
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id) save({ answers: Object.assign(load().answers || {}, { [e.target.id]: e.target.value }) });
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id) save({ answers: Object.assign(load().answers || {}, { [e.target.id]: e.target.value }) });
    });
  }
  function restoreAnswers() {
    const a = load().answers || {};
    Object.keys(a).forEach(function (id) { const el = document.getElementById(id); if (el && !el.disabled) el.value = a[id]; });
  }

  /* ---- aktivitas ---- */
  function section(name) { flush(); S.cur = name; S.curStart = Date.now(); }
  function flush() {
    if (!S.cur || !S.user) return;
    const dur = Math.floor((Date.now() - S.curStart) / 1000);
    S.curStart = Date.now();
    if (dur > 0) post({ action: 'logAktifitas', username: S.user.username, namaApp: 'LKPD:' + S.kode, section: S.cur, jenis: 'section', durasi: dur });
  }
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); else if (S.cur) S.curStart = Date.now(); });
  const elapsed = () => Math.floor((Date.now() - (S.t0 || Date.now())) / 1000);

  /* ---- gate kolab (tidak memblokir; kolab opsional) ---- */
  function gateUI(a) {
    return new Promise(function (res) {
      if (!a || !a.mode || a.mode === 'normal' || a.mode === 'owner-solo') { res({}); return; }
      if (a.mode === 'owner-approved' || a.mode === 'fix-pair') { res(a.pair ? { pair: a.pair } : {}); return; }
      res({});
    });
  }

  /* ---- boot ---- */
  async function init(cfgPage) {
    S.kode = cfgPage.kode;
    S.sections = cfgPage.sections || ['LKPD', 'KUIS'];
    S.t0 = Date.now();
    showLoader('Memverifikasi link...');
    const id = identity();
    if (!id) { hideLoader(); return { ok: false, msg: 'Gunakan gerbang resmi.' }; }
    let va = null;
    try {
      va = await post({ action: 'validateAccess', kode: S.kode, username: id.username || null, sess: id.sess || null, token: id.token || null });
    } catch (e) {
      if (id.direct) va = { ok: true, username: id.direct.username, nama: id.direct.nama, kelas: id.direct.kelas, kategori: id.direct.kategori };
      else { hideLoader(); return { ok: false, msg: 'Server tak terjangkau.' }; }
    }
    if (!va || !va.ok) { hideLoader(); return { ok: false, msg: (va && va.msg) || 'Akses ditolak.' }; }
        const uname =
      va.username ||
      (id && id.username) ||
      (id && id.direct ? id.direct.username : '') ||
      '';
    if (!uname) { hideLoader(); return { ok: false, msg: 'Username tidak ditemukan (sesi tidak valid).' }; }
    S.user = { username: uname, nama: va.nama, kelas: va.kelas, kategori: va.kategori };
    S.access = va;
    rng();
    wireAutosave();
    const g = await gateUI(va);
    if (g && g.pair) S.access.pair = g.pair;
    restoreAnswers();
    hideLoader();
    return { ok: true, access: S.access, user: S.user, readOnly: !!va.readOnly };
  }

  /* ---- kirim ---- */
  async function kirim(payload) {
  flush();
  payload.username = payload.username || S.user.username;
  payload.kode = payload.kode || S.kode;
  payload.nama1 = payload.nama1 || S.user.nama;
  payload.kelas = payload.kelas || S.user.kelas;
  payload.kategori = payload.kategori || S.user.kategori;
  if (S.access && S.access.pair) payload.username2 = payload.username2 || S.access.pair.username2;

  // Retry loop untuk status 'busy' (LockService paralel)
  let attempts = 0, last = null;
  while (attempts < 5) {
    try {
      const r = await fetch(CFG.GS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(res => res.json());
      last = r;
      if (r.status === 'ok') {
        post({
          action: 'logAktifitas', username: S.user.username, namaApp: 'LKPD:' + S.kode,
          section: payload.tipe === 'KUIS' ? 'KUIS' : 'LKPD', jenis: 'submit',
          durasi: elapsed(), skor: payload.skor !== undefined ? payload.skor : payload.autoNilai
        });
        return r;
      }
      if (r.status === 'busy') { attempts++; await new Promise(ok => setTimeout(ok, 600)); continue; }
      return r; // error lain → kembalikan apa adanya
    } catch (e) {
      attempts++;
      if (attempts >= 5) return { status: 'error', msg: 'Network error: ' + e.message };
      await new Promise(ok => setTimeout(ok, 600));
    }
  }
  return last || { status: 'error', msg: 'Max retries reached' };
}

  return { init, kirim, section, toast, showLoader, hideLoader, post, state: S, restoreAnswers, save, load };
})();