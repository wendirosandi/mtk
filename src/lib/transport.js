/* src/lib/transport.js — adapter pengganti post(GS_URL) pada UI lama.
   Menyediakan window.Transport.post(payload) dengan kontrak respons lama
   ({ok|status,...}) tetapi seluruhnya menuju Supabase. Tidak ada GAS. */
(function () {
  'use strict';

  var FILE_FALLBACK = {
    'MTK-8202': 'LKPD/MTK8202.html'
  };
  /* Asesmen yang sudah berjalan penuh di Supabase. Peta ini diprioritaskan
     di atas assessments.file_url karena data lama masih menunjuk file GAS. */
  var SUPABASE_NATIVE = {
    'MTK-8202': 'LKPD/MTK8202.html'
  };
  var STATUS_LABEL = {
    draft: 'Draft', active: 'Aktif', exambro: 'Exambro', inactive: 'Tidak Aktif',
    locked: 'Terkunci', archived: 'Arsip', deleted: 'Dihapus'
  };
  var RATING_LABEL = {
    kurang: 'Kurang', cukup: 'Cukup', baik: 'Baik', sangat_baik: 'Sangat Baik'
  };
  var RATING_ENUM = {
    Kurang: 'kurang', Cukup: 'cukup', Baik: 'baik', 'Sangat Baik': 'sangat_baik'
  };

  async function sb() {
    await window.LMS.whenReady();
    if (!window.LMS.supabase) throw new Error('Klien Supabase tidak tersedia');
    return window.LMS.supabase;
  }

  async function rpc(name, args) {
    var r = await (await sb()).rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }

  async function currentMeta() {
    var m = await window.LMS.profileMeta();
    if (!m) throw new Error('Sesi tidak valid, silakan login ulang.');
    return m;
  }

  function fmtDate(v) {
    if (!v) return '';
    try { return new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return String(v); }
  }

  function assessmentTarget(code, fileUrl) {
    return SUPABASE_NATIVE[code] || fileUrl || FILE_FALLBACK[code] || '';
  }

  function classPrefix(kelas) {
    return String(kelas || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-';
  }

  /* ---------- login ---------- */
  async function loginSiswa(payload) {
    var r = await window.LMS.signIn(payload.u || payload.username, payload.p || payload.password, 'siswa');
    if (!r.ok) {
      var v = null;
      try { v = await rpc('app_verify_legacy_password', { p_username: payload.u, p_password: payload.p }); }
      catch (e) { v = null; }
      if (v === true) return { ok: false, legacy: true, msg: 'Password legacy terverifikasi — lakukan reset password.' };
      return { ok: false, msg: r.msg || 'Username/password salah' };
    }
    var m = r.meta;
    return {
      ok: true, username: m.username, nama: m.nama, kelas: m.kelas, kategori: m.kategori,
      status: {}, info: { namaSekolah: m.namaSekolah }
    };
  }

  async function loginGuru(payload) {
    var r = await window.LMS.signIn(payload.u || payload.username, payload.p || payload.password, 'guru');
    if (!r.ok) return { ok: false, msg: r.msg || 'Username/password guru salah' };
    var m = r.meta;
    return {
      ok: true,
      info: { namaGuru: m.nama, namaSekolah: m.namaSekolah, username: m.username, role: m.role }
    };
  }

  async function getPublicInfo() {
    var cfg = window.CFG || {};
    return {
      namaAplikasi: cfg.APP_NAMA || 'Aplikasi Web Belajar Interaktif',
      namaSekolah: cfg.SEKOLAH_NAMA || 'SMPN 2 Karawang Barat',
      namaGuru: cfg.GURU_NAMA || ''
    };
  }

  /* ---------- nilai siswa ---------- */
  async function siswaGetNilai() {
    var meta = await currentMeta();
    var db = await sb();

    var res = await Promise.all([
      db.from('assessments').select('id,code,title,semester,status,kind,file_url,topics(title)').order('title'),
      db.from('gradebook_entries').select('assessment_id,score,score_kind,max_score,letter,updated_at').eq('profile_id', meta.id),
      db.from('attempts').select('assessment_id,status,submitted_at,started_at').eq('profile_id', meta.id),
      db.from('performance_ratings').select('assessment_id,dimension,rating,rater').eq('profile_id', meta.id)
    ]);
    if (res[0].error) throw res[0].error;
    if (res[1].error) throw res[1].error;
    if (res[2].error) throw res[2].error;
    if (res[3].error) throw res[3].error;

    var gbBy = {}, atBy = {}, prBy = {};
    (res[1].data || []).forEach(function (g) {
      var row = gbBy[g.assessment_id] || (gbBy[g.assessment_id] = {});
      var key = g.score_kind === 'kuis' ? 'kuis' : 'lkpd';
      var prev = row['_' + key];
      if (!prev || String(g.updated_at) > String(prev.updated_at)) row['_' + key] = g;
    });
    (res[2].data || []).forEach(function (t) { atBy[t.assessment_id] = t; });
    (res[3].data || []).forEach(function (p) {
      prBy[p.assessment_id] = prBy[p.assessment_id] || {};
      prBy[p.assessment_id][p.dimension] = RATING_LABEL[p.rating] || p.rating;
    });

    var rows = (res[0].data || []).map(function (a) {
      var g = gbBy[a.id] || {};
      var lk = g._lkpd || {}, ku = g._kuis || {};
      var pr = prBy[a.id] || {};
      var at = atBy[a.id] || null;
      var perf = {
        diri: pr.diri || '', lkpd: pr.lkpd || '',
        sikap: pr.sikap || '', pen: pr.pengetahuan || '', ket: pr.keterampilan || ''
      };
      var perfCount = Object.keys(perf).filter(function (k) { return !!perf[k]; }).length;
      var status = a.status;
      return {
        kode: a.code,
        nama: a.title,
        materi: (a.topics && a.topics.title) || '',
        semester: a.semester ? String(a.semester) : '',
        ta: meta.ta || '',
        status: STATUS_LABEL[status] || status,
        locked: status === 'locked',
        readOnly: status === 'archived',
        target: assessmentTarget(a.code, a.file_url),
        nilaiLkpd: lk.score == null ? 'X' : lk.score,
        nilaiKuis: ku.score == null ? 'X' : ku.score,
        jawabanL: '', jawabanK: '',
        waktuL: fmtDate(lk.updated_at), waktuK: fmtDate(ku.updated_at),
        performa: perf,
        lengkap: perfCount === 5 || !!(at && (at.status === 'submitted' || at.status === 'graded')),
        lengkapCnt: perfCount,
        lengkapOf: 5
      };
    });
    return { ok: true, rows: rows };
  }

  /* ---------- aktivitas siswa ---------- */
  async function siswaGetAktifitas() {
    var data = await rpc('app_get_student_activity', { p_limit: 200 });
    return {
      ok: true,
      rows: (data || []).map(function (r) {
        return {
          app: r.app_code, section: r.section, jenis: r.kind,
          durasi: r.duration_sec, skor: r.score == null ? '' : r.score,
          tanggal: fmtDate(r.logged_at)
        };
      })
    };
  }

  /* ---------- performa (self assessment) ---------- */
  async function siswaSavePerforma(payload) {
    var meta = await currentMeta();
    var db = await sb();
    var a = await db.from('assessments').select('id').eq('code', payload.kode).single();
    if (a.error) throw a.error;
    var ratingMap = { diri: payload.diri, lkpd: payload.lkpd };
    var rows = Object.keys(ratingMap).filter(function (d) { return !!ratingMap[d]; }).map(function (d) {
      return {
        assessment_id: a.data.id,
        profile_id: meta.id,
        rater: 'self',
        dimension: d,
        rating: RATING_ENUM[ratingMap[d]] || 'cukup'
      };
    });
    if (!rows.length) return { ok: false, msg: 'Tidak ada nilai performa yang dipilih.' };
    var r = await db.from('performance_ratings').upsert(rows, {
      onConflict: 'assessment_id,profile_id,rater,dimension'
    });
    if (r.error) throw r.error;
    return { ok: true };
  }

  /* ---------- akun ---------- */
  async function siswaGantiPassword(payload) {
    var meta = await currentMeta();
    var db = await sb();
    var reauth = await db.auth.signInWithPassword({
      email: window.LMS.loginId(meta.username, meta.role),
      password: payload.oldP
    });
    if (reauth.error) return { ok: false, msg: 'Password lama salah.' };
    var upd = await db.auth.updateUser({ password: payload.newP });
    if (upd.error) return { ok: false, msg: upd.error.message };
    return { ok: true };
  }

  async function siswaRequestAkun(payload) {
    var meta = await currentMeta();
    var kind, value;
    if (payload.jenis === 'Kategori') {
      kind = 'kategori';
      value = payload.nilaiBaru;
    } else {
      kind = 'username';
      var slug = String(payload.panggilan || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!slug) return { ok: false, msg: 'Nama panggilan wajib diisi.' };
      value = classPrefix(meta.kelas) + slug;
    }
    var data = await rpc('app_request_account_change', {
      p_kind: kind, p_value: value, p_reason: payload.alasan || null
    });
    if (!data || !data.ok) return { ok: false, msg: (data && data.msg) || 'Gagal mengirim permintaan.' };
    return { ok: true, nilaiBaru: data.nilaiBaru || value, msg: data.msg };
  }

  /* ---------- guru ---------- */
  async function guruGetRekap() {
    var db = await sb();
    var r = await db.from('gradebook_entries')
      .select('score,max_score,score_kind,source,updated_at,profiles(full_name,username),classes(label),assessments(code,title)')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (r.error) throw r.error;
    return {
      ok: true,
      rows: (r.data || []).map(function (g) {
        return {
          nama: (g.profiles && g.profiles.full_name) || '-',
          username: (g.profiles && g.profiles.username) || '-',
          kelas: (g.classes && g.classes.label) || '-',
          kode: (g.assessments && g.assessments.code) || '-',
          judul: (g.assessments && g.assessments.title) || '-',
          jenis: g.score_kind || '-',
          skor: g.score,
          maks: g.max_score,
          sumber: g.source,
          waktu: fmtDate(g.updated_at)
        };
      })
    };
  }

  async function guruGetAktifitas() {
    var db = await sb();
    var r = await db.from('activity_logs')
      .select('app_code,section,kind,duration_sec,score,logged_at,profiles(full_name,username)')
      .order('logged_at', { ascending: false })
      .limit(300);
    if (r.error) throw r.error;
    return {
      ok: true,
      rows: (r.data || []).map(function (a) {
        return {
          nama: (a.profiles && a.profiles.full_name) || '-',
          username: (a.profiles && a.profiles.username) || '-',
          app: a.app_code, section: a.section, jenis: a.kind,
          durasi: a.duration_sec, skor: a.score == null ? '' : a.score,
          tanggal: fmtDate(a.logged_at)
        };
      })
    };
  }

  /* ---------- kurikulum (mapel → modul → materi) ---------- */
  async function getMaterial(id) {
    var db = await sb();
    var r = await db.from('materials')
      .select('id,title,kind,url,meta,sort_order,topics(id,title,modules(id,title,subjects(id,code,name)))')
      .eq('id', id)
      .single();
    if (r.error) throw r.error;
    return { ok: true, material: r.data };
  }

  /* ---------- router aksi ---------- */
  async function route(payload) {
    var a = payload.action;

    if (a === 'getPublicInfo') return getPublicInfo();
    if (a === 'directLogin' || a === 'loginSiswa') return loginSiswa(payload);
    if (a === 'loginGuru') return loginGuru(payload);

    if (a === 'directExamList') {
      var db = await sb();
      var r = await db.from('assessments')
        .select('code,title,status,published_at')
        .in('delivery', ['exambro', 'direct'])
        .in('status', ['active', 'exambro'])
        .order('published_at', { ascending: false });
      if (r.error) throw r.error;
      return { ok: true, list: (r.data || []).map(function (x) { return { kode: x.code, nama: x.title, status: x.status }; }) };
    }

    if (a === 'validateAccess' || a === 'lkpdInfo') return rpc('app_access_check', { p_code: payload.kode });
    if (a === 'logAktifitas') {
      return rpc('app_ingest_activity', {
        p_app: payload.namaApp, p_section: payload.section,
        p_kind: payload.jenis, p_duration: payload.durasi, p_score: payload.skor == null ? null : payload.skor
      });
    }

    if (a === 'siswaGetNilai') return siswaGetNilai();
    if (a === 'siswaGetAktifitas') return siswaGetAktifitas();
    if (a === 'siswaSavePerforma') return siswaSavePerforma(payload);
    if (a === 'siswaGantiPassword') return siswaGantiPassword(payload);
    if (a === 'siswaRequestAkun') return siswaRequestAkun(payload);
    if (a === 'guruGetRekap') return guruGetRekap();
    if (a === 'guruGetAktifitas') return guruGetAktifitas();

    if (a === 'getSubjects') return { ok: true, rows: await rpc('app_get_subjects') };
    if (a === 'getModules') return { ok: true, rows: await rpc('app_get_modules', { p_subject_id: payload.subjectId }) };
    if (a === 'getMaterials') return { ok: true, rows: await rpc('app_get_materials', { p_module_id: payload.moduleId }) };
    if (a === 'getAssessments') return { ok: true, rows: await rpc('app_get_assessments', { p_topic_id: payload.topicId }) };
    if (a === 'getMaterial') return getMaterial(payload.id);

    /* alur pengerjaan LKPD/KUIS */
    if (a === 'startAttempt') return rpc('app_start_attempt', { p_code: payload.kode, p_partner: payload.partner || null, p_source: payload.source || 'portal' });
    if (a === 'saveAnswers') return rpc('app_save_answers', { p_attempt: payload.attemptId, p_answers: payload.answers });
    if (a === 'scoreAttempt') return rpc('app_score_attempt', { p_attempt: payload.attemptId });
    if (a === 'submitLegacy') return rpc('app_submit_legacy', { p_code: payload.kode, p_payload: payload });

    /* payload rekap lama (tipe LKPD/KUIS) -> alur baru */
    if (!a && (payload.tipe === 'LKPD' || payload.tipe === 'KUIS')) {
      var st = await rpc('app_start_attempt', { p_code: payload.kode, p_source: 'legacy' });
      if (!st.ok) return { status: 'error', msg: st.msg };
      await rpc('app_save_answers', {
        p_attempt: st.attemptId,
        p_answers: { legacy: payload.jawaban || '', kuis: payload.tipe === 'KUIS' }
      });
      var sub = await rpc('app_submit_legacy', { p_code: payload.kode, p_payload: payload });
      return sub.ok ? { status: 'ok' } : { status: 'error', msg: sub.msg };
    }
    return { status: 'error', msg: 'Aksi tidak dikenal: ' + a };
  }

  async function post(payload) {
    try {
      return await route(payload || {});
    } catch (e) {
      console.error('[Transport]', e);
      return { ok: false, status: 'error', msg: (e && e.message) || String(e), rows: [] };
    }
  }

  window.Transport = { post: post, rpc: rpc, assessmentTarget: assessmentTarget };
})();
