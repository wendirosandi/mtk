/* ============ pages/guru-kurikulum.js — CRUD modul, topik, materi ============ */
Router.register('guru-kurikulum', async () => `
  <div class="page-wrap">
    <div id="kur-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="flex flex-wrap gap-2 items-center">
        <label for="kur-subject" class="card-sub" style="font-weight:700">Mapel / Tingkat</label>
        <select id="kur-subject" class="border rounded-xl px-3 py-2 text-sm"></select>
        <div class="flex-1"></div>
        <button id="kur-add-module" type="button" class="btn btn-primary btn-sm">+ Modul</button>
      </div>
      <p class="card-sub" style="margin-top:8px">Susun Modul → Topik → Materi. Asesmen dikelola terpisah.</p>
    </div>
    <div id="kur-body">${UI.skeleton(4)}</div>
  </div>
`);

window.init_guru_kurikulum = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { subjects: [], subjectId: null, gradeLevelId: null, moduleId: null };

  $('#kur-head').innerHTML = UI.pageHeader({
    title: 'Kurikulum',
    subtitle: 'Kelola modul, topik, dan materi untuk mapel yang Anda ampu.'
  });

  const KINDS = [
    { value: 'dokumen', label: 'Dokumen' },
    { value: 'video', label: 'Video' },
    { value: 'pdf', label: 'PDF' },
    { value: 'app', label: 'Aplikasi' },
    { value: 'geogebra', label: 'GeoGebra' },
    { value: 'lkpd_ref', label: 'Referensi LKPD' }
  ];

  function openForm(cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = '<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">'
      + '<h3 style="font-weight:800;font-size:18px;margin-bottom:12px">' + esc(cfg.title) + '</h3>'
      + '<form id="kur-form" class="space-y-3">'
      + cfg.fields.map(f => {
          const label = '<label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">' + esc(f.label) + (f.required ? ' *' : '') + '</label>';
          if (f.type === 'textarea') {
            return '<div>' + label + '<textarea name="' + esc(f.name) + '" rows="3" class="w-full border rounded-xl px-3 py-2 text-sm" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea></div>';
          }
          if (f.type === 'select') {
            return '<div>' + label + '<select name="' + esc(f.name) + '" class="w-full border rounded-xl px-3 py-2 text-sm">'
              + (f.options || []).map(o => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(f.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('')
              + '</select></div>';
          }
          return '<div>' + label + '<input name="' + esc(f.name) + '" type="' + esc(f.type || 'text') + '" value="' + esc(f.value || '') + '" class="w-full border rounded-xl px-3 py-2 text-sm" placeholder="' + esc(f.placeholder || '') + '"></div>';
        }).join('')
      + '<div class="flex gap-2" style="margin-top:16px">'
      + '<button type="submit" class="btn btn-primary flex-1">' + esc(cfg.submit || 'Simpan') + '</button>'
      + '<button type="button" data-cancel class="btn btn-secondary">Batal</button>'
      + '</div></form></div>';
    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelector('[data-cancel]').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
    setTimeout(() => { const f = wrap.querySelector('input,textarea,select'); if (f) f.focus(); }, 50);

    wrap.querySelector('#kur-form').onsubmit = async e => {
      e.preventDefault();
      const values = {};
      cfg.fields.forEach(f => { values[f.name] = wrap.querySelector('[name="' + f.name + '"]').value.trim(); });
      const btn = wrap.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      const r = await cfg.onSubmit(values);
      if (r && r.ok) {
        close();
        API.toast('✅ ' + (cfg.success || 'Tersimpan'));
        await refresh();
      } else {
        API.toast('❌ ' + ((r && r.msg) || 'Gagal menyimpan'));
        btn.disabled = false; btn.textContent = cfg.submit || 'Simpan';
      }
    };
  }

  function subjectOptions() {
    const seen = {};
    return state.subjects.filter(s => {
      const key = s.id + '|' + s.grade_level_id;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function bindSubjectSelect() {
    const opts = subjectOptions();
    $('#kur-subject').innerHTML = opts.map(s =>
      `<option value="${esc(s.id)}|${esc(s.grade_level_id)}"${s.id === state.subjectId && s.grade_level_id === state.gradeLevelId ? ' selected' : ''}>${esc(s.name)} · Tingkat ${esc(s.grade_level_label || '-')}</option>`
    ).join('');
    $('#kur-subject').onchange = () => {
      const p = $('#kur-subject').value.split('|');
      state.subjectId = p[0]; state.gradeLevelId = p[1]; state.moduleId = null;
      refresh();
    };
  }

  async function refresh() {
    const body = $('#kur-body');
    body.innerHTML = UI.skeleton(4);
    const mods = await API.auth('guruModulesList', {
      subjectId: state.subjectId, gradeLevelId: state.gradeLevelId
    });
    const modules = (mods && mods.rows) || [];

    let rows = [];
    if (state.moduleId) {
      const m = await API.auth('getMaterials', { moduleId: state.moduleId });
      rows = (m && m.rows) || [];
    }

    const topics = new Map();
    rows.forEach(r => {
      if (!r.topic_id) return;
      if (!topics.has(r.topic_id)) topics.set(r.topic_id, { id: r.topic_id, title: r.topic_title, materials: new Map(), assessments: new Map() });
      const t = topics.get(r.topic_id);
      if (r.material_id) t.materials.set(r.material_id, { id: r.material_id, title: r.material_title, kind: r.material_kind, url: r.material_url });
      if (r.assessment_code) t.assessments.set(r.assessment_code, { code: r.assessment_code, title: r.assessment_title, status: r.assessment_status });
    });

    if (!modules.length) {
      body.innerHTML = UI.empty('Belum ada modul', 'Tambahkan modul pertama untuk mapel/tingkat ini.');
      return;
    }

    body.innerHTML = '<div class="space-y-3">' + modules.map(m => {
      const open = state.moduleId === m.id;
      return `<div class="card">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="card-title">${esc(m.title)}</div>
            <div class="card-sub">${esc(m.description || 'Tanpa deskripsi')}</div>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-secondary btn-sm" data-open-module="${esc(m.id)}">${open ? 'Tutup' : 'Kelola'}</button>
            <button class="btn btn-secondary btn-sm" data-edit-module="${esc(m.id)}">Edit</button>
          </div>
        </div>
        ${open ? renderDetails(topics, m) : ''}
      </div>`;
    }).join('') + '</div>';

    body.querySelectorAll('[data-open-module]').forEach(b => b.onclick = () => {
      state.moduleId = state.moduleId === b.dataset.openModule ? null : b.dataset.openModule;
      refresh();
    });
    body.querySelectorAll('[data-edit-module]').forEach(b => b.onclick = () => {
      const m = modules.find(x => x.id === b.dataset.editModule);
      if (m) editModule(m);
    });
    body.querySelectorAll('[data-add-topic]').forEach(b => b.onclick = () => addTopic(b.dataset.addTopic));
    body.querySelectorAll('[data-edit-topic]').forEach(b => b.onclick = () => editTopic(b.dataset.editTopic, topics.get(b.dataset.editTopic)));
    body.querySelectorAll('[data-del-topic]').forEach(b => b.onclick = () => deleteTopic(b.dataset.delTopic));
    body.querySelectorAll('[data-add-material]').forEach(b => b.onclick = () => addMaterial(b.dataset.addMaterial));
    body.querySelectorAll('[data-edit-material]').forEach(b => b.onclick = () => editMaterial(b.dataset.editMaterial, rows));
    body.querySelectorAll('[data-del-material]').forEach(b => b.onclick = () => deleteMaterial(b.dataset.delMaterial));
  }

  function renderDetails(topics, m) {
    let html = '<div class="border-t" style="margin-top:12px;padding-top:12px">';
    if (!topics.size) html += '<div class="card-sub" style="margin-bottom:8px">Belum ada topik.</div>';
    topics.forEach(t => {
      html += `<div class="border rounded-xl p-3" style="border-color:var(--border);margin-bottom:8px">
        <div class="flex items-start justify-between gap-2">
          <b style="font-size:14px">${esc(t.title)}</b>
          <div class="flex gap-1">
            <button class="btn btn-secondary btn-sm" data-edit-topic="${esc(t.id)}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del-topic="${esc(t.id)}">Hapus</button>
          </div>
        </div>
        <div style="margin-top:6px">`;
      t.materials.forEach(mat => {
        html += `<div class="flex items-center gap-2 border rounded-lg p-2" style="border-color:var(--border);margin-top:6px">
          <span class="badge badge--info">${esc(mat.kind)}</span>
          <span style="flex:1;font-size:13px">${esc(mat.title)}</span>
          <button class="btn btn-secondary btn-sm" data-edit-material="${esc(mat.id)}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del-material="${esc(mat.id)}">Hapus</button>
        </div>`;
      });
      t.assessments.forEach(a => {
        html += `<div class="flex items-center gap-2 border rounded-lg p-2" style="border-color:var(--border);margin-top:6px">
          <span class="badge badge--warning">asesmen</span>
          <span style="flex:1;font-size:13px">${esc(a.title || a.code)} <span class="card-sub">${esc(a.code)}</span></span>
          <span class="badge">${esc(a.status)}</span>
        </div>`;
      });
      html += `</div>
        <div style="margin-top:8px"><button class="btn btn-secondary btn-sm" data-add-material="${esc(t.id)}">+ Materi</button></div>
      </div>`;
    });
    html += `<button class="btn btn-secondary btn-sm" data-add-topic="${esc(m.id)}">+ Topik</button></div>`;
    return html;
  }

  function addModule() {
    openForm({
      title: 'Tambah Modul', success: 'Modul ditambahkan',
      fields: [
        { name: 'title', label: 'Judul modul', required: true },
        { name: 'description', label: 'Deskripsi', type: 'textarea' },
        { name: 'sortOrder', label: 'Urutan', type: 'number', value: 0 }
      ],
      onSubmit: v => API.auth('guruModuleSave', {
        subjectId: state.subjectId, gradeLevelId: state.gradeLevelId,
        title: v.title, description: v.description, sortOrder: v.sortOrder
      })
    });
  }

  function editModule(m) {
    openForm({
      title: 'Edit Modul', success: 'Modul diperbarui',
      fields: [
        { name: 'title', label: 'Judul modul', required: true, value: m.title },
        { name: 'description', label: 'Deskripsi', type: 'textarea', value: m.description || '' },
        { name: 'sortOrder', label: 'Urutan', type: 'number', value: m.sort_order || 0 }
      ],
      onSubmit: v => API.auth('guruModuleSave', { id: m.id, title: v.title, description: v.description, sortOrder: v.sortOrder })
    });
  }

  function addTopic(moduleId) {
    openForm({
      title: 'Tambah Topik', success: 'Topik ditambahkan',
      fields: [
        { name: 'title', label: 'Judul topik', required: true },
        { name: 'sortOrder', label: 'Urutan', type: 'number', value: 0 }
      ],
      onSubmit: v => API.auth('guruTopicSave', { moduleId: moduleId, title: v.title, sortOrder: v.sortOrder })
    });
  }

  function editTopic(id, t) {
    if (!t) return;
    openForm({
      title: 'Edit Topik', success: 'Topik diperbarui',
      fields: [
        { name: 'title', label: 'Judul topik', required: true, value: t.title },
        { name: 'sortOrder', label: 'Urutan', type: 'number', value: 0 }
      ],
      onSubmit: v => API.auth('guruTopicSave', { id: id, title: v.title, sortOrder: v.sortOrder })
    });
  }

  async function deleteTopic(id) {
    if (!confirm('Hapus topik beserta materi di dalamnya?')) return;
    const r = await API.auth('guruTopicDelete', { id: id });
    if (r && r.ok) { API.toast('✅ Topik dihapus'); await refresh(); }
    else API.toast('❌ ' + ((r && r.msg) || 'Gagal menghapus'));
  }

  function addMaterial(topicId) {
    openForm({
      title: 'Tambah Materi', success: 'Materi ditambahkan',
      fields: [
        { name: 'title', label: 'Judul materi', required: true },
        { name: 'kind', label: 'Jenis', type: 'select', options: KINDS, value: 'dokumen' },
        { name: 'url', label: 'URL / path', placeholder: '/mtk/... atau https://...' },
        { name: 'sortOrder', label: 'Urutan', type: 'number', value: 0 }
      ],
      onSubmit: v => API.auth('guruMaterialSave', {
        topicId: topicId, title: v.title, kind: v.kind, url: v.url, sortOrder: v.sortOrder
      })
    });
  }

  function editMaterial(id, rows) {
    const mat = rows.find(r => r.material_id === id);
    if (!mat) return;
    openForm({
      title: 'Edit Materi', success: 'Materi diperbarui',
      fields: [
        { name: 'title', label: 'Judul materi', required: true, value: mat.material_title },
        { name: 'kind', label: 'Jenis', type: 'select', options: KINDS, value: mat.material_kind },
        { name: 'url', label: 'URL / path', value: mat.material_url || '' },
        { name: 'sortOrder', label: 'Urutan', type: 'number', value: 0 }
      ],
      onSubmit: v => API.auth('guruMaterialSave', {
        id: id, title: v.title, kind: v.kind, url: v.url, sortOrder: v.sortOrder
      })
    });
  }

  async function deleteMaterial(id) {
    if (!confirm('Hapus materi ini?')) return;
    const r = await API.auth('guruMaterialDelete', { id: id });
    if (r && r.ok) { API.toast('✅ Materi dihapus'); await refresh(); }
    else API.toast('❌ ' + ((r && r.msg) || 'Gagal menghapus'));
  }

  const subs = await API.auth('getSubjects');
  state.subjects = (subs && subs.rows) || [];
  if (!state.subjects.length) {
    $('#kur-body').innerHTML = UI.empty('Belum ada mapel', 'Minta admin menetapkan mapel/kelas Anda.');
    return;
  }
  state.subjectId = state.subjects[0].id;
  state.gradeLevelId = state.subjects[0].grade_level_id;
  bindSubjectSelect();
  $('#kur-add-module').onclick = addModule;
  await refresh();
};
