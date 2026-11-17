/* src/lib/module-boot.js — gerbang sesi + aktivitas untuk modul eksternal
   (ToolsMathPro, Kalender Pythagoras). Tidak menyimpan token di URL. */
window.LMSModule = (function () {
  'use strict';

  var state = { app: 'APP', profile: null, opened: false, client: null };
  var LOGIN_KEY = 'LMS_NEXT';

  function redirect(loginUrl) {
    var next = location.pathname + location.search + location.hash;
    try { sessionStorage.setItem(LOGIN_KEY, next); } catch (e) { /* private mode */ }
    var u = new URL(loginUrl || '../index.html', location.href);
    u.searchParams.set('next', next);
    location.replace(u.href);
  }

  function blocked(message) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f8fafc;display:flex;'
      + 'align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif';
    el.innerHTML = '<div style="max-width:420px;background:#fff;border:1px solid #e2e8f0;'
      + 'border-radius:16px;padding:24px;text-align:center;box-shadow:0 8px 24px rgba(15,23,42,.08)">'
      + '<div style="font-size:32px;margin-bottom:8px">🔒</div>'
      + '<h2 style="margin:0 0 8px;font-size:18px;color:#0f172a">Akses belum tersedia</h2>'
      + '<p style="margin:0 0 16px;color:#64748b;font-size:14px">' + message + '</p>'
      + '<a href="../index.html#siswa-mapel" style="display:inline-block;background:#0f766e;color:#fff;'
      + 'padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">'
      + 'Kembali ke LMS</a></div>';
    document.body.appendChild(el);
  }

  function unwrap(v) { return Array.isArray(v) ? v[0] : v; }

  /* Verifikasi materi terdaftar + tingkat siswa (jika datanya tersedia). */
  async function checkMaterial(materialUrl, profile) {
    var client = state.client;
    var r = await client.from('materials')
      .select('id,title,url,kind,topics(modules(grade_level_id))')
      .eq('kind', 'app');
    if (r.error) {
      console.warn('[LMSModule] material check', r.error.message);
      return { ok: true, found: false };
    }
    var rows = r.data || [];
    var found = rows.filter(function (m) {
      return m.url && (materialUrl.indexOf(m.url) >= 0 || m.url.indexOf(materialUrl) >= 0);
    })[0];

    if (!found) return { ok: true, found: false }; // belum terdaftar: izinkan preview
    if (profile.role !== 'siswa') return { ok: true, found: true, material: found };

    var cm = await client.from('class_memberships')
      .select('classes(grade_level_id,label)')
      .eq('profile_id', profile.id)
      .is('left_at', null)
      .limit(1);
    var cls = cm.data && cm.data[0] && cm.data[0].classes;
    var topic = unwrap(found.topics);
    var mod = topic && unwrap(topic.modules);

    if (cls && mod && mod.grade_level_id && cls.grade_level_id
        && String(cls.grade_level_id) !== String(mod.grade_level_id)) {
      return { ok: false, found: true, material: found, msg: 'Modul ini tidak tersedia untuk tingkat kelas Anda.' };
    }
    return { ok: true, found: true, material: found };
  }

  async function boot(opts) {
    opts = opts || {};
    state.app = opts.app || 'APP';
    var loginUrl = opts.loginUrl || '../index.html';

    if (!window.LMS || !window.LMS.whenReady) {
      throw new Error('src/lib/supabase.js belum dimuat');
    }
    await window.LMS.whenReady();
    if (!window.LMS.supabase) throw new Error('Klien Supabase tidak tersedia');
    state.client = window.LMS.supabase;

    var s = await state.client.auth.getSession();
    if (!s.data || !s.data.session) { redirect(loginUrl); return null; }

    var meta = await window.LMS.profileMeta();
    if (!meta) {
      await window.LMS.signOut();
      redirect(loginUrl);
      return null;
    }
    state.profile = meta;

    if (opts.materialUrl && meta.role === 'siswa') {
      var check = await checkMaterial(opts.materialUrl, meta);
      if (!check.ok) {
        blocked(check.msg || 'Materi ini tidak tersedia untuk akun Anda.');
        return null;
      }
      if (!check.found && opts.requireRegistered) {
        blocked('Aplikasi ini belum terdaftar pada materi LMS.');
        return null;
      }
    }
    return meta;
  }

  async function log(event, section, duration, score, meta) {
    if (!state.client || !state.profile) return { ok: false, msg: 'belum siap' };
    if (event === 'open') {
      if (state.opened) return { ok: true, skipped: true };
      state.opened = true;
    }
    var dur = Math.max(0, Math.round(Number(duration) || 0));
    if (event === 'open' || event === 'use') dur = Math.max(30, dur);

    var payload = {
      p_app: state.app,
      p_section: section || 'APP',
      p_event: event,
      p_duration: dur,
      p_score: score == null ? null : score,
      p_meta: meta || {}
    };
    var r = await state.client.rpc('app_ingest_activity_v2', payload);

    /* Fallback selama migrasi 0011 belum diterapkan */
    if (r.error && /function|schema cache|does not exist/i.test(r.error.message)) {
      var kind = event === 'complete' || event === 'submit' ? 'submit' : 'section';
      r = await state.client.rpc('app_ingest_activity', {
        p_app: payload.p_app, p_section: payload.p_section, p_kind: kind,
        p_duration: dur, p_score: payload.p_score
      });
    }
    if (r.error) console.warn('[LMSModule] aktivitas gagal:', r.error.message);
    return r.data || { ok: !r.error };
  }

  function profile() { return state.profile; }
  function client() { return state.client; }

  return { boot: boot, log: log, profile: profile, client: client, redirect: redirect, blocked: blocked };
})();
