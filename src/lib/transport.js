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
  async function guruDashboard() {
    var meta = await currentMeta();
    var db = await sb();
    var ta = await db.from('teacher_assignments')
      .select('class_id,subject_id,academic_year_id')
      .eq('teacher_id', meta.id);
    if (ta.error) throw ta.error;

    var assignments = ta.data || [];
    var classIds = assignments.map(function (x) { return x.class_id; }).filter(Boolean);
    var yearsWithAll = assignments.filter(function (x) { return !x.class_id; })
      .map(function (x) { return x.academic_year_id; }).filter(Boolean);
    if (yearsWithAll.length) {
      var allCls = await db.from('classes').select('id').in('academic_year_id', yearsWithAll);
      classIds = classIds.concat((allCls.data || []).map(function (c) { return c.id; }));
    }
    classIds = Array.from(new Set(classIds));

    var subjectIds = Array.from(new Set(assignments.map(function (x) { return x.subject_id; }).filter(Boolean)));

    var students = 0, grades = 0, assessments = 0, pending = 0, activity = 0;
    if (classIds.length) {
      var s = await db.from('class_memberships').select('*', { count: 'exact', head: true })
        .in('class_id', classIds).is('left_at', null);
      students = s.count || 0;
      var g = await db.from('gradebook_entries').select('*', { count: 'exact', head: true })
        .in('class_id', classIds);
      grades = g.count || 0;
    }
    if (subjectIds.length) {
      var a = await db.from('assessments').select('id', { count: 'exact' })
        .in('subject_id', subjectIds).neq('status', 'deleted');
      assessments = a.count || 0;
      var aids = (a.data || []).map(function (x) { return x.id; });
      if (aids.length) {
        var p = await db.from('attempts').select('*', { count: 'exact', head: true })
          .in('assessment_id', aids).in('status', ['in_progress', 'submitted']);
        pending = p.count || 0;
      }
    }
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var act = await db.from('activity_logs').select('*', { count: 'exact', head: true })
      .gte('logged_at', today.toISOString());
    activity = act.count || 0;

    return {
      ok: true,
      stats: {
        classes: classIds.length, students: students, assessments: assessments,
        pendingGrades: pending, grades: grades, activityToday: activity
      }
    };
  }

  async function guruKelas() {
    var meta = await currentMeta();
    var db = await sb();
    var ta = await db.from('teacher_assignments')
      .select('id,class_id,subject_id,academic_year_id,subjects(code,name),classes(id,label,grade_levels(label)),academic_years(label)')
      .eq('teacher_id', meta.id);
    if (ta.error) throw ta.error;

    var assignments = ta.data || [];
    var allRows = [];
    var yearsWithAll = assignments.filter(function (x) { return !x.class_id; })
      .map(function (x) { return x.academic_year_id; }).filter(Boolean);
    var allClasses = [];
    if (yearsWithAll.length) {
      var ac = await db.from('classes')
        .select('id,label,academic_year_id,grade_levels(label)')
        .in('academic_year_id', yearsWithAll);
      allClasses = ac.data || [];
    }

    assignments.forEach(function (a) {
      var clsList = a.class_id
        ? [a.classes || { id: a.class_id, label: '-' }]
        : allClasses.filter(function (c) { return c.academic_year_id === a.academic_year_id; });
      clsList.forEach(function (c) {
        if (!c) return;
        allRows.push({
          assignmentId: a.id,
          classId: c.id,
          kelas: c.label || '-',
          tingkat: c.grade_levels ? c.grade_levels.label : '',
          subjectId: a.subject_id,
          subjectCode: a.subjects ? a.subjects.code : '-',
          subjectName: a.subjects ? a.subjects.name : '-',
          tahun: a.academic_years ? a.academic_years.label : ''
        });
      });
    });

    var classIds = Array.from(new Set(allRows.map(function (r) { return r.classId; }).filter(Boolean)));
    var subjectIds = Array.from(new Set(allRows.map(function (r) { return r.subjectId; }).filter(Boolean)));
    var memberCount = {}, assessCount = {};

    if (classIds.length) {
      var cm = await db.from('class_memberships').select('class_id').in('class_id', classIds).is('left_at', null);
      (cm.data || []).forEach(function (r) { memberCount[r.class_id] = (memberCount[r.class_id] || 0) + 1; });
    }
    if (subjectIds.length) {
      var as = await db.from('assessments').select('subject_id,id').in('subject_id', subjectIds).neq('status', 'deleted');
      (as.data || []).forEach(function (r) { assessCount[r.subject_id] = (assessCount[r.subject_id] || 0) + 1; });
    }

    allRows.forEach(function (r) {
      r.studentCount = memberCount[r.classId] || 0;
      r.assessmentCount = assessCount[r.subjectId] || 0;
    });

    return { ok: true, rows: allRows };
  }

  async function guruNilaiMatrix(payload) {
    var meta = await currentMeta();
    var db = await sb();

    var ta = await db.from('teacher_assignments')
      .select('class_id,subject_id,academic_year_id')
      .eq('teacher_id', meta.id);
    if (ta.error) throw ta.error;
    var assignments = ta.data || [];

    var classId = payload && payload.classId;
    if (!classId) {
      var first = assignments.filter(function (a) { return a.class_id; })[0];
      if (first) classId = first.class_id;
    }
    if (!classId) return { ok: true, class: null, students: [], assessments: [], scores: [] };

    var cls = await db.from('classes')
      .select('id,label,academic_year_id,school_id,grade_levels(label)')
      .eq('id', classId).single();
    if (cls.error) throw cls.error;

    var subjectIds = Array.from(new Set(assignments.filter(function (a) {
      return a.class_id === classId || (!a.class_id && a.academic_year_id === cls.data.academic_year_id);
    }).map(function (a) { return a.subject_id; }).filter(Boolean)));

    if (!subjectIds.length) return { ok: true, class: cls.data, students: [], assessments: [], scores: [] };

    var members = await db.from('class_memberships')
      .select('profile_id,profiles(id,username,full_name)')
      .eq('class_id', classId).is('left_at', null);
    if (members.error) throw members.error;

    var assessments = await db.from('assessments')
      .select('id,code,title,subject_id,kind')
      .in('subject_id', subjectIds)
      .in('status', ['active', 'exambro', 'archived'])
      .order('title');
    if (assessments.error) throw assessments.error;

    var aids = (assessments.data || []).map(function (a) { return a.id; });
    var scores = [];
    if (aids.length) {
      var sc = await db.from('gradebook_entries')
        .select('assessment_id,profile_id,score,source,updated_at')
        .eq('class_id', classId).eq('entry_kind', 'assessment').in('assessment_id', aids);
      if (sc.error) throw sc.error;
      scores = sc.data || [];
    }

    return {
      ok: true,
      class: cls.data,
      students: (members.data || []).map(function (m) { return m.profiles; }).filter(Boolean),
      assessments: assessments.data || [],
      scores: scores
    };
  }

  async function guruSaveScore(payload) {
    var meta = await currentMeta();
    var db = await sb();
    var score = payload.score === '' || payload.score == null ? null : Number(payload.score);
    if (score != null && (isNaN(score) || score < 0 || score > 100)) {
      return { ok: false, msg: 'Nilai harus 0–100' };
    }
    if (!payload.classId || !payload.profileId || !payload.assessmentId) {
      return { ok: false, msg: 'Data nilai tidak lengkap' };
    }

    var cls = await db.from('classes')
      .select('id,school_id,academic_year_id').eq('id', payload.classId).single();
    if (cls.error) throw cls.error;

    var upd = await db.from('gradebook_entries')
      .update({ score: score, source: 'manual', updated_at: new Date().toISOString() })
      .eq('class_id', payload.classId)
      .eq('profile_id', payload.profileId)
      .eq('assessment_id', payload.assessmentId)
      .eq('entry_kind', 'assessment')
      .select('id');
    if (upd.error) throw upd.error;
    if (upd.data && upd.data.length) return { ok: true, updated: true };

    var ins = await db.from('gradebook_entries').insert({
      school_id: cls.data.school_id,
      academic_year_id: cls.data.academic_year_id,
      class_id: payload.classId,
      profile_id: payload.profileId,
      entry_kind: 'assessment',
      assessment_id: payload.assessmentId,
      score: score,
      max_score: 100,
      source: 'manual',
      created_by: meta.id
    }).select('id');
    if (ins.error) throw ins.error;
    return { ok: true, inserted: true };
  }

  async function guruMonitor() {
    var db = await sb();
    var r = await db.from('attempts')
      .select('id,status,started_at,submitted_at,client_duration_sec,flags,profiles!attempts_profile_id_fkey(full_name,username),assessments(code,title)')
      .order('started_at', { ascending: false })
      .limit(200);
    if (r.error) throw r.error;
    return {
      ok: true,
      rows: (r.data || []).map(function (a) {
        return {
          id: a.id,
          nama: (a.profiles && a.profiles.full_name) || '-',
          username: (a.profiles && a.profiles.username) || '-',
          kode: (a.assessments && a.assessments.code) || '-',
          judul: (a.assessments && a.assessments.title) || '-',
          status: a.status,
          mulai: fmtDate(a.started_at),
          selesai: fmtDate(a.submitted_at),
          durasi: a.client_duration_sec == null ? '' : a.client_duration_sec,
          flags: a.flags || {}
        };
      })
    };
  }

  async function guruGetRekap() {
    var db = await sb();
    var r = await db.from('gradebook_entries')
      .select('score,max_score,score_kind,source,updated_at,profiles!gradebook_entries_profile_id_fkey(full_name,username),classes(label),assessments(code,title)')
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

  /* ---------- kurikulum: CRUD modul/topik/materi (guru) ---------- */
  async function guruModulesList(payload) {
    var db = await sb();
    var q = db.from('modules')
      .select('id,title,description,sort_order,grade_level_id,subject_id')
      .eq('subject_id', payload.subjectId)
      .order('sort_order').order('title');
    if (payload.gradeLevelId) q = q.eq('grade_level_id', payload.gradeLevelId);
    var r = await q;
    if (r.error) throw r.error;
    return { ok: true, rows: r.data || [] };
  }

  async function guruModuleSave(payload) {
    var meta = await currentMeta();
    var db = await sb();
    var title = String(payload.title || '').trim();
    if (!title) return { ok: false, msg: 'Judul modul wajib diisi' };
    var row = {
      title: title,
      description: String(payload.description || '').trim() || null,
      sort_order: Number(payload.sortOrder) || 0
    };
    if (payload.id) {
      var u = await db.from('modules').update(row).eq('id', payload.id).select('id');
      if (u.error) throw u.error;
      if (!u.data || !u.data.length) return { ok: false, msg: 'Modul tidak ditemukan / bukan wewenang Anda' };
      return { ok: true, id: payload.id };
    }
    if (!payload.subjectId || !payload.gradeLevelId) return { ok: false, msg: 'Mapel/tingkat belum dipilih' };
    row.school_id = meta.school_id;
    row.subject_id = payload.subjectId;
    row.grade_level_id = payload.gradeLevelId;
    var ins = await db.from('modules').insert(row).select('id').single();
    if (ins.error) throw ins.error;
    return { ok: true, id: ins.data.id };
  }

  async function guruTopicSave(payload) {
    var db = await sb();
    var title = String(payload.title || '').trim();
    if (!title) return { ok: false, msg: 'Judul topik wajib diisi' };
    var row = { title: title, sort_order: Number(payload.sortOrder) || 0 };
    if (payload.id) {
      var u = await db.from('topics').update(row).eq('id', payload.id).select('id');
      if (u.error) throw u.error;
      if (!u.data || !u.data.length) return { ok: false, msg: 'Topik tidak ditemukan' };
      return { ok: true, id: payload.id };
    }
    if (!payload.moduleId) return { ok: false, msg: 'Modul belum dipilih' };
    row.module_id = payload.moduleId;
    var ins = await db.from('topics').insert(row).select('id').single();
    if (ins.error) throw ins.error;
    return { ok: true, id: ins.data.id };
  }

  async function guruTopicDelete(payload) {
    var db = await sb();
    if (!payload.id) return { ok: false, msg: 'ID topik kosong' };
    var r = await db.from('topics').delete().eq('id', payload.id).select('id');
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) return { ok: false, msg: 'Topik tidak dapat dihapus' };
    return { ok: true };
  }

  async function guruMaterialSave(payload) {
    var db = await sb();
    var title = String(payload.title || '').trim();
    if (!title) return { ok: false, msg: 'Judul materi wajib diisi' };
    var kind = String(payload.kind || 'dokumen');
    if (['dokumen', 'video', 'app', 'geogebra', 'pdf', 'lkpd_ref'].indexOf(kind) < 0) {
      return { ok: false, msg: 'Jenis materi tidak dikenal' };
    }
    var url = String(payload.url || '').trim() || null;
    if (url) {
      var isHttp = /^https?:\/\//i.test(url);
      var isPath = url.charAt(0) === '/' && url.indexOf('//') !== 0;
      if (!isHttp && !isPath) return { ok: false, msg: 'URL harus http(s) atau path relatif' };
    }
    var row = {
      title: title, kind: kind, url: url,
      meta: payload.meta || {}, sort_order: Number(payload.sortOrder) || 0
    };
    if (payload.id) {
      var u = await db.from('materials').update(row).eq('id', payload.id).select('id');
      if (u.error) throw u.error;
      if (!u.data || !u.data.length) return { ok: false, msg: 'Materi tidak ditemukan' };
      return { ok: true, id: payload.id };
    }
    if (!payload.topicId) return { ok: false, msg: 'Topik belum dipilih' };
    row.topic_id = payload.topicId;
    var ins = await db.from('materials').insert(row).select('id').single();
    if (ins.error) throw ins.error;
    return { ok: true, id: ins.data.id };
  }

  async function guruMaterialDelete(payload) {
    var db = await sb();
    if (!payload.id) return { ok: false, msg: 'ID materi kosong' };
    var r = await db.from('materials').delete().eq('id', payload.id).select('id');
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) return { ok: false, msg: 'Materi tidak dapat dihapus' };
    return { ok: true };
  }

  /* ---------- asesmen: daftar, builder, soal ---------- */
  async function guruContext() {
    var meta = await currentMeta();
    var db = await sb();
    var r = await db.from('teacher_assignments')
      .select('subject_id,academic_year_id,subjects(code,name),academic_years(id,label)')
      .eq('teacher_id', meta.id);
    if (r.error) throw r.error;
    var subjects = {}, years = {};
    (r.data || []).forEach(function (a) {
      if (a.subject_id) subjects[a.subject_id] = a.subjects || { code: '-', name: '-' };
      if (a.academic_year_id) years[a.academic_year_id] = a.academic_years || { label: '-' };
    });
    return {
      ok: true,
      subjects: Object.keys(subjects).map(function (id) { return { id: id, code: subjects[id].code, name: subjects[id].name }; }),
      years: Object.keys(years).map(function (id) { return { id: id, label: years[id].label }; })
    };
  }

  async function guruAssessments() {
    var ctx = await guruContext();
    var db = await sb();
    var subjectIds = ctx.subjects.map(function (s) { return s.id; });
    if (!subjectIds.length) return { ok: true, rows: [] };
    var r = await db.from('assessments')
      .select('id,code,title,kind,status,semester,delivery,published_at,package_frozen_at,subject_id,academic_year_id,subjects(code,name),topics(title)')
      .in('subject_id', subjectIds)
      .neq('status', 'deleted')
      .order('title');
    if (r.error) throw r.error;
    var ids = (r.data || []).map(function (a) { return a.id; });
    var counts = {};
    if (ids.length) {
      var q = await db.from('question_items').select('assessment_id').in('assessment_id', ids);
      (q.data || []).forEach(function (x) { counts[x.assessment_id] = (counts[x.assessment_id] || 0) + 1; });
    }
    return {
      ok: true,
      rows: (r.data || []).map(function (a) {
        return {
          id: a.id, code: a.code, title: a.title, kind: a.kind, status: a.status,
          semester: a.semester, delivery: a.delivery, publishedAt: fmtDate(a.published_at),
          frozen: !!a.package_frozen_at, subject: a.subjects, topic: a.topics,
          questionCount: counts[a.id] || 0
        };
      })
    };
  }

  async function guruAssessmentGet(id) {
    var db = await sb();
    var a = await db.from('assessments')
      .select('id,code,title,kind,status,semester,delivery,collab_mode,published_at,package_frozen_at,subject_id,module_id,topic_id,academic_year_id,prerequisite_assessment_id,subjects(code,name),topics(title),modules(title),academic_years(label)')
      .eq('id', id).single();
    if (a.error) throw a.error;
    var qs = await db.from('question_items')
      .select('id,item_key,kind,difficulty,payload,weight,sort_order')
      .eq('assessment_id', id).order('sort_order');
    if (qs.error) throw qs.error;
    var cand = await db.from('assessments')
      .select('id,code,title')
      .eq('subject_id', a.data.subject_id)
      .neq('id', id).neq('status', 'deleted').order('title');
    return { ok: true, assessment: a.data, questions: qs.data || [], candidates: cand.data || [] };
  }

  async function guruAssessmentCreate(payload) {
    var meta = await currentMeta();
    var db = await sb();
    var code = String(payload.code || '').trim().toUpperCase();
    var title = String(payload.title || '').trim();
    if (!code || !title) return { ok: false, msg: 'Kode dan judul wajib diisi' };
    if (!payload.subjectId || !payload.academicYearId) return { ok: false, msg: 'Mapel/tahun belum dipilih' };
    var row = {
      school_id: meta.school_id,
      code: code,
      title: title,
      kind: payload.kind || 'lkpd',
      status: 'draft',
      subject_id: payload.subjectId,
      academic_year_id: payload.academicYearId,
      semester: payload.semester ? Number(payload.semester) : null,
      collab_mode: payload.collabMode || 'none',
      delivery: payload.delivery || 'portal',
      module_id: payload.moduleId || null,
      topic_id: payload.topicId || null,
      prerequisite_assessment_id: payload.prerequisiteId || null,
      created_by: meta.id
    };
    var r = await db.from('assessments').insert(row).select('id').single();
    if (r.error) {
      if (String(r.error.code) === '23505') return { ok: false, msg: 'Kode asesmen sudah dipakai' };
      throw r.error;
    }
    return { ok: true, id: r.data.id };
  }

  async function guruAssessmentUpdate(payload) {
    var db = await sb();
    var cur = await db.from('assessments').select('id,package_frozen_at').eq('id', payload.id).single();
    if (cur.error) throw cur.error;
    if (cur.data.package_frozen_at) return { ok: false, msg: 'Paket sudah beku; metadata tidak dapat diubah' };
    var title = String(payload.title || '').trim();
    if (!title) return { ok: false, msg: 'Judul wajib diisi' };
    var row = {
      title: title,
      kind: payload.kind || 'lkpd',
      semester: payload.semester ? Number(payload.semester) : null,
      collab_mode: payload.collabMode || 'none',
      delivery: payload.delivery || 'portal'
    };
    if (Object.prototype.hasOwnProperty.call(payload, 'prerequisiteId')) row.prerequisite_assessment_id = payload.prerequisiteId || null;
    if (Object.prototype.hasOwnProperty.call(payload, 'moduleId')) row.module_id = payload.moduleId || null;
    if (Object.prototype.hasOwnProperty.call(payload, 'topicId')) row.topic_id = payload.topicId || null;
    var upd = await db.from('assessments').update(row).eq('id', payload.id).select('id');
    if (upd.error) throw upd.error;
    if (!upd.data || !upd.data.length) return { ok: false, msg: 'Asesmen tidak ditemukan' };
    return { ok: true };
  }

  async function guruAssessmentPublish(id) {
    var db = await sb();
    var q = await db.from('question_items').select('id', { count: 'exact', head: true }).eq('assessment_id', id);
    if (!q.count) return { ok: false, msg: 'Tambahkan minimal satu soal sebelum menerbitkan' };
    var r = await db.from('assessments').update({ status: 'active', published_at: new Date().toISOString() })
      .eq('id', id).select('id');
    if (r.error) throw r.error;
    return { ok: true };
  }

  async function guruAssessmentArchive(id) {
    var db = await sb();
    var r = await db.from('assessments').update({ status: 'archived' }).eq('id', id).select('id');
    if (r.error) throw r.error;
    return { ok: true };
  }

  async function guruQuestionSave(payload) {
    var db = await sb();
    if (!payload.assessmentId) return { ok: false, msg: 'Asesmen belum dipilih' };
    var a = await db.from('assessments').select('id,package_frozen_at').eq('id', payload.assessmentId).single();
    if (a.error) throw a.error;
    if (a.data.package_frozen_at) return { ok: false, msg: 'Paket sudah beku; soal tidak dapat diubah' };

    var prompt = String(payload.prompt || '').trim();
    if (!prompt) return { ok: false, msg: 'Teks soal wajib diisi' };
    var kind = payload.kind || 'text';
    var body = { prompt: prompt };
    if (kind === 'num') {
      if (payload.answer === '' || payload.answer == null || isNaN(Number(payload.answer))) return { ok: false, msg: 'Kunci numerik wajib' };
      body.answer = Number(payload.answer);
      body.tol = payload.tol === '' || payload.tol == null ? 0 : Number(payload.tol);
      if (isNaN(body.tol) || body.tol < 0) return { ok: false, msg: 'Toleransi tidak valid' };
    } else if (kind === 'mc' || kind === 'bs') {
      if (!String(payload.key || '').trim()) return { ok: false, msg: 'Kunci jawaban wajib' };
      body.key = String(payload.key).trim();
      if (payload.options) body.options = String(payload.options).split('|').map(function (x) { return x.trim(); }).filter(Boolean);
    } else if (kind === 'match') {
      var keys = String(payload.keys || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!keys.length) return { ok: false, msg: 'Daftar kunci menjodohkan wajib' };
      body.keys = keys;
    } else if (kind === 'scaffold') {
      var ans = String(payload.answers || '').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
      if (!ans.length || ans.some(function (x) { return isNaN(Number(x)); })) return { ok: false, msg: 'Jawaban scaffold harus angka dipisah koma' };
      body.answers = ans.map(Number);
      body.tol = 0;
    }

    var weight = payload.weight === '' || payload.weight == null ? 1 : Number(payload.weight);
    if (isNaN(weight) || weight < 0) return { ok: false, msg: 'Bobot tidak valid' };
    var sort = payload.sortOrder === '' || payload.sortOrder == null ? 0 : Number(payload.sortOrder);

    if (payload.id) {
      var u = await db.from('question_items').update({
        kind: kind, difficulty: payload.difficulty || null, payload: body, weight: weight, sort_order: sort
      }).eq('id', payload.id).select('id');
      if (u.error) throw u.error;
      return { ok: true, id: payload.id };
    }

    var itemKey = 'q-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    var ins = await db.from('question_items').insert({
      assessment_id: payload.assessmentId, item_key: itemKey, kind: kind,
      difficulty: payload.difficulty || null, payload: body, weight: weight, sort_order: sort
    }).select('id').single();
    if (ins.error) throw ins.error;
    return { ok: true, id: ins.data.id };
  }

  async function guruQuestionDelete(id) {
    var db = await sb();
    var q = await db.from('question_items').select('id,assessment_id').eq('id', id).single();
    if (q.error) throw q.error;
    var d = await db.from('question_items').delete().eq('id', id).select('id');
    if (d.error) throw d.error;
    return { ok: true };
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
    if (a === 'guruDashboard') return guruDashboard();
    if (a === 'guruKelas') return guruKelas();
    if (a === 'guruNilaiMatrix') return guruNilaiMatrix(payload);
    if (a === 'guruSaveScore') return guruSaveScore(payload);
    if (a === 'guruMonitor') return guruMonitor();
    if (a === 'guruModuleSave') return guruModuleSave(payload);
    if (a === 'guruModulesList') return guruModulesList(payload);    if (a === 'guruTopicSave') return guruTopicSave(payload);
    if (a === 'guruTopicDelete') return guruTopicDelete(payload);
    if (a === 'guruMaterialSave') return guruMaterialSave(payload);
    if (a === 'guruMaterialDelete') return guruMaterialDelete(payload);
    if (a === 'guruContext') return guruContext();
    if (a === 'guruAssessments') return guruAssessments();
    if (a === 'guruAssessmentGet') return guruAssessmentGet(payload.id);
    if (a === 'guruAssessmentCreate') return guruAssessmentCreate(payload);
    if (a === 'guruAssessmentUpdate') return guruAssessmentUpdate(payload);
    if (a === 'guruAssessmentPublish') return guruAssessmentPublish(payload.id);
    if (a === 'guruAssessmentArchive') return guruAssessmentArchive(payload.id);
    if (a === 'guruQuestionSave') return guruQuestionSave(payload);
    if (a === 'guruQuestionDelete') return guruQuestionDelete(payload.id);

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
