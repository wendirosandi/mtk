/* src/lib/transport.js — adapter pengganti post(GS_URL) pada LKPD lama.
   Menyediakan window.Transport.post(payload) dengan kontrak respons lama
   ({ok|status,...}) tetapi seluruhnya menuju Supabase. Tidak ada GAS. */
(function () {
  'use strict';
  const sb = () => window.LMS.supabase;

  async function rpc(name, args) { const r = await sb().rpc(name, args); if (r.error) throw r.error; return r.data; }

  async function post(payload) {
    const a = payload.action;
    /* ---- auth & gerbang ---- */
    if (a === 'directLogin' || a === 'loginSiswa') {
      const email = window.LMS.loginId(payload.u || payload.username, 'siswa');
      const r = await sb().auth.signInWithPassword({ email, password: payload.p || payload.password });
      if (r.error) {
        /* fallback legacy hash (password lama belum migrasi) */
        const v = await rpc('app_verify_legacy_password', { p_username: payload.u, p_password: payload.p });
        if (v === true) {
          /* minta Edge/flow reset: kembalikan kode khusus agar UI menawarkan reset */
          return { ok: false, legacy: true, msg: 'Password legacy terverifikasi — lakukan reset password.' };
        }
        return { ok: false };
      }
      const p = await window.LMS.currentProfile();
      return { ok: true, username: p.username, nama: p.full_name, kelas: (p.settings || {}).kelas || '',
               kategori: (p.settings || {}).kategori || '', status: {} };
    }
    if (a === 'directExamList') {
      const r = await sb().from('assessments')
        .select('code,title,status,published_at')
        .in('delivery', ['exambro', 'direct'])
        .in('status', ['active', 'exambro'])
        .order('published_at', { ascending: false });
      if (r.error) throw r.error;
      return { ok: true, list: r.data.map(x => ({ kode: x.code, nama: x.title, status: x.status })) };
    }
    if (a === 'validateAccess' || a === 'lkpdInfo') return rpc('app_access_check', { p_code: payload.kode });
    if (a === 'logAktifitas')
      return rpc('app_ingest_activity', { p_app: payload.namaApp, p_section: payload.section,
        p_kind: payload.jenis, p_duration: payload.durasi, p_score: payload.skor ?? null });

    /* ---- alur pengerjaan LKPD/KUIS ---- */
    if (a === 'startAttempt') return rpc('app_start_attempt', { p_code: payload.kode, p_partner: payload.partner || null, p_source: payload.source || 'portal' });
    if (a === 'saveAnswers')  return rpc('app_save_answers', { p_attempt: payload.attemptId, p_answers: payload.answers });
    if (a === 'scoreAttempt') return rpc('app_score_attempt', { p_attempt: payload.attemptId });
    if (a === 'submitLegacy') return rpc('app_submit_legacy', { p_code: payload.kode, p_payload: payload });

    /* ---- payload rekap lama (tipe LKPD/KUIS) → alur baru ---- */
    if (!a && (payload.tipe === 'LKPD' || payload.tipe === 'KUIS')) {
      const st = await rpc('app_start_attempt', { p_code: payload.kode, p_source: 'legacy' });
      if (!st.ok) return { status: 'error', msg: st.msg };
      await rpc('app_save_answers', { p_attempt: st.attemptId,
        answers: { legacy: payload.jawaban || '', kuis: payload.tipe === 'KUIS' } });
      const r = await rpc('app_submit_legacy', { p_code: payload.kode, p_payload: payload });
      return r.ok ? { status: 'ok' } : { status: 'error', msg: r.msg };
    }
    return { status: 'error', msg: 'Aksi tidak dikenal: ' + a };
  }

  window.Transport = { post, rpc };
  /* Patch satu baris untuk core/APP_STATE.js:
     ganti  const post = p => fetch(CFG.GS_URL, {...})
     menjadi const post = p => window.Transport.post(p);            */
})();