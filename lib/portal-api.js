/* ============ PORTAL API — wrapper fetch dengan auth ============ */
window.API = (function(){
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  
  /* ---- HTTP primitive ---- */
  const postRaw = (payload) =>
    fetch(CFG.GS_URL, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    }).then(r => r.json());
  
  /* ---- Sesi (localStorage) ---- */
  const KEY = 'PORTAL_SESS_V2';
  const sess = () => localStorage.getItem(KEY);
  const setSess = (t, role, meta) => {
    localStorage.setItem(KEY, t);
    localStorage.setItem(KEY+'_ROLE', role);
    localStorage.setItem(KEY+'_META', JSON.stringify(meta||{}));
  };
  const clearSess = () => { [KEY, KEY+'_ROLE', KEY+'_META'].forEach(k => localStorage.removeItem(k)); };
  const getMeta = () => { try{return JSON.parse(localStorage.getItem(KEY+'_META')||'{}');}catch(e){return {};} };
  const getRole = () => localStorage.getItem(KEY+'_ROLE');
  
  /* ---- Auth call: kirim token di body ---- */
  async function auth(action, payload){
    const t = sess();
    if(!t){ clearSess(); Router.go('login'); throw new Error('SESSION_EXPIRED'); }
    const body = Object.assign({ action: action, sess: t }, payload || {});
    const r = await postRaw(body);
    if(r && r.msg === 'Sesi berakhir.'){ clearSess(); Router.go('login'); throw new Error('SESSION_EXPIRED'); }
    return r;
  }
  
  /* ---- Login siswa (hybrid hash/plaintext) ---- */
  async function login(u, p){
    const r = await postRaw({action:'loginSiswa', u, p});
    if(r.ok){ setSess(r.token, 'siswa', r.siswa); return {ok:true, meta:r.siswa, info:r.info, isDefaultPwd:r.isDefaultPwd}; }
    return r;
  }
  async function loginGuru(pin){
    const r = await postRaw({action:'loginGuru', pin});
    if(r.ok){ setSess(r.token, 'guru', r.info); return {ok:true, meta:r.info, info:r.info}; }
    return r;
  }
  function logout(){ clearSess(); Router.go('login'); }
  
  /* ---- UI helpers ---- */
  let _pend = 0;
  function showLoader(m){ const el = $('#loader-overlay'); if(el){ el.classList.remove('hidden'); $('#loader-text').textContent = m||'Memproses...'; } }
  function hideLoader(){ const el = $('#loader-overlay'); if(el && --_pend <= 0) el.classList.add('hidden'); _pend = Math.max(0,_pend); }
  async function call(promiseFn){
    _pend++; showLoader();
    try { const r = await promiseFn(); hideLoader(); return r; }
    catch(e){ hideLoader(); toast('❌ '+(e.message||'Gagal')); throw e; }
  }
  function toast(m){
    let t = $('#toast'); if(!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2600);
  }
  
  return { postRaw, auth, login, loginGuru, logout, sess, getRole, getMeta, call, toast, showLoader, hideLoader };
})();