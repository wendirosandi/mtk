/* src/lib/supabase.js — inisialisasi klien Supabase (UMD, tanpa build step).
   WAJIB: jangan pernah menaruh service_role key di sini.
   Konfigurasi diisi dari window.LMS_CONFIG yang di-inject oleh halaman
   (nilai produksi dibaca dari env CI saat build/deploy; dev memakai placeholder). */
(function () {
  'use strict';
  var CFG = window.LMS_CONFIG || {
    SUPABASE_URL: 'https://wotszlppzfvlsvrqxbgh.supabase.co',   // <-- ganti via CI/env
    SUPABASE_ANON_KEY: 'sb_publishable_fi4B8GrKcJcYib126FH2FA_WI0HG0iH'      // <-- anon PUBLIC saja
  };
  if (!window.supabase || !window.supabase.createClient) {
    // fallback muat UMD dari CDN bila halaman belum menyertakan
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = boot; document.head.appendChild(s);
  } else { boot(); }

  function boot() {
    var client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.LMS = window.LMS || {};
    window.LMS.supabase = client;
    window.LMS.cfg = CFG;

    /* email sintetis untuk kompatibilitas username lama */
    window.LMS.loginId = function (usernameOrEmail, role) {
      if (usernameOrEmail.indexOf('@') > 0) return usernameOrEmail.toLowerCase();
      var school = (CFG.SCHOOL_CODE || 'PLACEHOLDER-SCHOOL').toLowerCase();
      return usernameOrEmail.trim().toLowerCase() + '@' + school + '.' + (role || 'siswa') + '.lms';
    };
    window.LMS.currentProfile = async function () {
      var u = (await client.auth.getUser()).user;
      if (!u) return null;
      var r = await client.from('profiles').select('*').eq('id', u.id).single();
      return r.error ? null : r.data;
    };
    window.LMS.requireRole = async function (role) {
      var p = await window.LMS.currentProfile();
      if (!p || p.role !== role) { location.hash = '#login'; throw new Error('ROLE_DENIED'); }
      return p;
    };
    document.dispatchEvent(new CustomEvent('lms:ready'));
  }
})();