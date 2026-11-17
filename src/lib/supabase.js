/* src/lib/supabase.js — inisialisasi klien Supabase (UMD, tanpa build step).
   WAJIB: jangan pernah menaruh service_role key di sini.
   Konfigurasi diisi dari window.LMS_CONFIG yang di-inject oleh halaman
   (nilai produksi dibaca dari env CI saat build/deploy; dev memakai placeholder). */
(function () {
  'use strict';
  var CFG = window.LMS_CONFIG || {
    SUPABASE_URL: 'https://wotszlppzfvlsvrqxbgh.supabase.co',   // <-- ganti via CI/env
    SUPABASE_ANON_KEY: 'sb_publishable_fi4B8GrKcJcYib126FH2FA_WI0HG0iH', // <-- anon PUBLIC saja
    SCHOOL_CODE: (window.CFG && window.CFG.SEKOLAH_KODE) || 'PLACEHOLDER-SCHOOL'
  };
  if (!CFG.SCHOOL_CODE) CFG.SCHOOL_CODE = 'PLACEHOLDER-SCHOOL';

  var LMS = window.LMS = window.LMS || {};
  var readyResolve;
  LMS.ready = new Promise(function (resolve) { readyResolve = resolve; });
  LMS.whenReady = function () { return LMS.ready; };
  LMS.cfg = CFG;

  /* email sintetis untuk kompatibilitas username lama */
  LMS.loginId = function (usernameOrEmail, role) {
    if (String(usernameOrEmail).indexOf('@') > 0) return String(usernameOrEmail).toLowerCase();
    var school = (CFG.SCHOOL_CODE || 'PLACEHOLDER-SCHOOL').toLowerCase();
    return String(usernameOrEmail).trim().toLowerCase() + '@' + school + '.' + (role || 'siswa') + '.lms';
  };

  if (!window.supabase || !window.supabase.createClient) {
    // fallback muat UMD dari CDN bila halaman belum menyertakan
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = boot;
    s.onerror = function () { readyResolve(null); };
    document.head.appendChild(s);
  } else {
    boot();
  }

  function boot() {
    if (!window.supabase || !window.supabase.createClient) { readyResolve(null); return; }
    var client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    LMS.supabase = client;

    LMS.currentProfile = async function () {
      var u = (await client.auth.getUser()).data.user;
      if (!u) return null;
      var r = await client.from('profiles').select('*').eq('id', u.id).single();
      return r.error ? null : r.data;
    };

    /* Meta siap-pakai untuk UI (cache-friendly, satu sumber). */
    LMS.profileMeta = async function () {
      var p = await LMS.currentProfile();
      if (!p) return null;
      var kelas = (p.settings || {}).kelas || '';
      if (!kelas) {
        try {
          var cm = await client.from('class_memberships')
            .select('classes(label)')
            .eq('profile_id', p.id)
            .is('left_at', null)
            .limit(1);
          if (cm.data && cm.data[0] && cm.data[0].classes) kelas = cm.data[0].classes.label || '';
        } catch (e) { /* biarkan kosong */ }
      }
      var namaSekolah = '';
      var schoolSettings = {};
      var kategori = (p.settings || {}).kategori || '';
      var kategoriMapel = {};
      try {
        var sc = await client.from('schools').select('name,settings').eq('id', p.school_id).single();
        if (!sc.error && sc.data) {
          namaSekolah = sc.data.name || '';
          schoolSettings = sc.data.settings || {};
        }
      } catch (e) { /* biarkan kosong */ }

      /* Kategori baru (0016). Fallback ke settings bila RPC belum tersedia. */
      try {
        var cat = await client.rpc('app_get_my_categories');
        if (!cat.error && Array.isArray(cat.data)) {
          cat.data.forEach(function (row) {
            if (row.scope === 'umum' && row.category) kategori = row.category;
            if (row.scope === 'mapel' && row.subject_code) kategoriMapel[row.subject_code] = row.category || '';
          });
        }
      } catch (e) { /* fallback legacy */ }

      return {
        id: p.id,
        school_id: p.school_id,
        username: p.username,
        nama: p.full_name,
        namaGuru: p.role === 'guru' || p.role === 'admin' ? p.full_name : '',
        role: p.role,
        kelas: kelas,
        kategori: kategori,
        kategoriMapel: kategoriMapel,
        ta: (p.settings || {}).ta || '',
        namaSekolah: namaSekolah,
        features: schoolSettings.features || {},
        mustChangePassword: !!p.must_change_password,
        info: { namaSekolah: namaSekolah }
      };
    };

    LMS.requireRole = async function (role) {
      var p = await LMS.currentProfile();
      if (!p || p.role !== role) { location.hash = '#login'; throw new Error('ROLE_DENIED'); }
      return p;
    };

    /* Login terpusat: verifikasi role agar siswa tidak bisa masuk jalur guru. */
    LMS.signIn = async function (username, password, role) {
      role = role || 'siswa';
      var email = LMS.loginId(username, role);
      var r = await client.auth.signInWithPassword({ email: email, password: password });
      if (r.error) return { ok: false, msg: r.error.message };
      var meta = await LMS.profileMeta();
      if (!meta) {
        await client.auth.signOut();
        return { ok: false, msg: 'Profil tidak ditemukan untuk akun ini.' };
      }
      var allowed = role === 'guru' ? (meta.role === 'guru' || meta.role === 'admin') : (meta.role === role);
      if (!allowed) {
        await client.auth.signOut();
        return { ok: false, msg: 'Akun ini tidak memiliki akses sebagai ' + role + '.' };
      }
      return { ok: true, meta: meta };
    };

    LMS.signOut = async function () {
      try { await client.auth.signOut(); } catch (e) { /* abaikan */ }
    };

    readyResolve(client);
    document.dispatchEvent(new CustomEvent('lms:ready'));
  }
})();
