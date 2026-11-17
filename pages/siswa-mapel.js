/* ============ pages/siswa-mapel.js — Mapel → Modul → Materi ============ */
Router.register('siswa-mapel', async () => `
  <div class="page-wrap">
    <div id="mp-crumb"></div>
    <div id="mp-head"></div>
    <div id="mp-body"></div>
  </div>
`);

window.init_siswa_mapel = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const S = { view: 'subjects', subject: null, module: null, rows: [] };

  const ICON = {
    video: 'fa-video', pdf: 'fa-file-pdf', app: 'fa-rocket',
    geogebra: 'fa-shapes', lkpd_ref: 'fa-file-pen', dokumen: 'fa-file-lines'
  };
  const STATUS_TONE = { active: 'success', exambro: 'warning', inactive: 'warning', locked: 'danger', archived: 'info' };

  function head(title, subtitle) {
    $('#mp-head').innerHTML = UI.pageHeader({ title: title, subtitle: subtitle || '' });
  }

  function crumb() {
    const items = [{ label: 'Mapel', route: S.view === 'subjects' ? null : 'siswa-mapel' }];
    if (S.subject) items.push({ label: S.subject.code, route: S.view === 'materials' ? 'siswa-mapel' : null });
    if (S.module) items.push({ label: S.module.title });
    $('#mp-crumb').innerHTML = UI.crumbs(items);
    UI.bindBack($('#mp-crumb'));
    $('#mp-crumb').querySelectorAll('[data-crumb]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.crumb === 'siswa-mapel') { S.view = 'subjects'; S.subject = null; S.module = null; loadSubjects(); }
      };
    });
  }

  function openUrl(url) {
    const safe = UI.safeUrl(url);
    if (!safe) { API.toast('❌ Tautan tidak valid'); return; }
    window.open(safe, '_blank', 'noopener');
  }

  async function loadSubjects() {
    S.view = 'subjects'; S.subject = null; S.module = null;
    head('Mata Pelajaran', 'Pilih mata pelajaran untuk mulai belajar.');
    crumb();
    $('#mp-body').innerHTML = UI.skeleton(3);
    const r = await API.auth('getSubjects');
    const rows = (r && r.rows) || [];
    if (!rows.length) {
      $('#mp-body').innerHTML = UI.empty('Belum ada mata pelajaran', 'Hubungi guru atau admin sekolah.');
      return;
    }
    $('#mp-body').innerHTML = '<div class="grid gap-3 sm:grid-cols-2">' + rows.map(s => `
      <button type="button" class="card text-left hover:border-teal-500" data-subject="${esc(s.id)}">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="card-title">${esc(s.name || s.code)}</div>
            <div class="card-sub">${esc(s.code)} • Tingkat ${esc(s.grade_level_label || '-')}</div>
          </div>
          <span class="badge badge--info">${esc(s.code)}</span>
        </div>
      </button>`).join('') + '</div>';

    $('#mp-body').querySelectorAll('[data-subject]').forEach(b => {
      b.onclick = () => {
        S.subject = rows.find(x => String(x.id) === b.dataset.subject) || { id: b.dataset.subject };
        loadModules(S.subject.id);
      };
    });
  }

  async function loadModules(subjectId) {
    S.view = 'modules';
    head(S.subject.name || 'Modul', 'Pilih modul/BAB yang ingin dipelajari.');
    crumb();
    $('#mp-body').innerHTML = UI.skeleton(3);
    const r = await API.auth('getModules', { subjectId: subjectId });
    const rows = (r && r.rows) || [];
    if (!rows.length) {
      $('#mp-body').innerHTML = UI.empty('Belum ada modul', 'Modul untuk mapel ini belum disiapkan guru.');
      return;
    }
    $('#mp-body').innerHTML = '<div class="space-y-3">' + rows.map(m => `
      <button type="button" class="card w-full text-left hover:border-teal-500" data-module="${esc(m.id)}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="card-title">${esc(m.title)}</div>
            <div class="card-sub">${esc(m.description || 'Tanpa deskripsi')}</div>
          </div>
          <span class="badge">${esc(m.assessment_count)} asesmen</span>
        </div>
        <div class="card-sub" style="margin-top:6px">${esc(m.topic_count)} topik • ${esc(m.material_count)} materi</div>
      </button>`).join('') + '</div>';

    $('#mp-body').querySelectorAll('[data-module]').forEach(b => {
      b.onclick = () => {
        S.module = rows.find(x => String(x.id) === b.dataset.module) || { id: b.dataset.module, title: 'Modul' };
        loadMaterials(S.module.id);
      };
    });
  }

  async function loadMaterials(moduleId) {
    S.view = 'materials';
    head(S.module.title || 'Materi', 'Materi, aplikasi, dan asesmen pada modul ini.');
    crumb();
    $('#mp-body').innerHTML = UI.skeleton(4);
    const r = await API.auth('getMaterials', { moduleId: moduleId });
    const rows = (r && r.rows) || [];
    if (!rows.length) {
      $('#mp-body').innerHTML = UI.empty('Modul masih kosong', 'Guru belum menambahkan materi atau asesmen.');
      return;
    }

    const topics = new Map();
    rows.forEach(row => {
      if (!row.topic_id) return;
      if (!topics.has(row.topic_id)) {
        topics.set(row.topic_id, { title: row.topic_title, materials: new Map(), assessments: new Map() });
      }
      const t = topics.get(row.topic_id);
      if (row.material_id && !t.materials.has(row.material_id)) {
        t.materials.set(row.material_id, {
          id: row.material_id, title: row.material_title,
          kind: row.material_kind, url: row.material_url
        });
      }
      if (row.assessment_code && !t.assessments.has(row.assessment_code)) {
        t.assessments.set(row.assessment_code, {
          code: row.assessment_code, title: row.assessment_title,
          kind: row.assessment_kind, status: row.assessment_status
        });
      }
    });

    if (!topics.size) {
      $('#mp-body').innerHTML = UI.empty('Belum ada topik', 'Isi modul belum tersedia.');
      return;
    }

    let html = '';
    topics.forEach(t => {
      html += `<section class="card"><div class="card-title">${esc(t.title)}</div>`;

      html += '<div class="space-y-2" style="margin-top:10px">';
      t.materials.forEach(m => {
        const icon = ICON[m.kind] || 'fa-file-lines';
        const isApp = m.kind === 'app' || m.kind === 'geogebra';
        const canOpen = !!UI.safeUrl(m.url);
        html += `<div class="flex items-center gap-3 border rounded-xl p-3" style="border-color:var(--border)">
          <span class="badge badge--info"><i class="fas ${icon}"></i></span>
          <div class="flex-1 min-w-0">
            <div style="font-weight:700;font-size:14px">${esc(m.title)}</div>
            <div class="card-sub">${esc(m.kind)}</div>
          </div>
          ${canOpen
            ? `<button type="button" class="btn btn-secondary btn-sm" data-open="${esc(UI.safeUrl(m.url))}" data-kind="${esc(m.kind)}" data-title="${esc(m.title)}">${isApp ? 'Buka aplikasi' : 'Buka'}</button>`
            : '<span class="badge">Tautan belum ada</span>'}
        </div>`;
      });
      html += '</div>';

      if (t.assessments.size) {
        html += '<div class="card-sub" style="margin-top:14px;font-weight:800;color:var(--text)">Asesmen</div>'
          + '<div class="space-y-2" style="margin-top:8px">';
        t.assessments.forEach(a => {
          const target = window.Transport.assessmentTarget
            ? Transport.assessmentTarget(a.code, '') : '';
          const tone = STATUS_TONE[a.status] || '';
          html += `<div class="flex items-center gap-3 border rounded-xl p-3" style="border-color:var(--border)">
            <span class="badge badge--info"><i class="fas fa-file-pen"></i></span>
            <div class="flex-1 min-w-0">
              <div style="font-weight:700;font-size:14px">${esc(a.title || a.code)}</div>
              <div class="card-sub">${esc(a.code)} • ${esc(a.kind || '')} ${UI.badge(a.status || '-', tone)}</div>
            </div>
            ${target
              ? `<button type="button" class="btn btn-primary btn-sm" data-open="${esc(target)}">Kerjakan</button>`
              : '<span class="badge">Belum terhubung</span>'}
          </div>`;
        });
        html += '</div>';
      }
      html += '</section>';
    });

    $('#mp-body').innerHTML = html;

    $('#mp-body').querySelectorAll('[data-open]').forEach(btn => {
      btn.onclick = () => {
        const url = btn.dataset.open;
        const kind = btn.dataset.kind;
        if (kind && kind !== 'app' && kind !== 'geogebra') {
          API.auth('logAktifitas', {
            namaApp: 'LMS-MATERI', section: (kind || 'MATERI').toUpperCase(),
            jenis: 'section', durasi: 30
          }).catch(() => {});
        }
        openUrl(url);
      };
    });
  }

  await loadSubjects();
};
