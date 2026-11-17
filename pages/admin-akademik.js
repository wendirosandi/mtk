/* ============ pages/admin-akademik.js — tahun, kelas, mapel, penugasan ============ */
Router.register('admin-akademik', async () => `
  <div class="page-wrap">
    <div id="ak-head"></div>
    <div class="flex flex-wrap gap-2" style="margin-bottom:12px">
      <button id="ak-tab-year" type="button" class="btn btn-primary btn-sm">Tahun</button>
      <button id="ak-tab-class" type="button" class="btn btn-secondary btn-sm">Kelas</button>
      <button id="ak-tab-subject" type="button" class="btn btn-secondary btn-sm">Mapel</button>
      <button id="ak-tab-assign" type="button" class="btn btn-secondary btn-sm">Penugasan</button>
      <div class="flex-1"></div>
      <button id="ak-add" type="button" class="btn btn-primary btn-sm">+ Tambah</button>
    </div>
    <div id="ak-body">${UI.skeleton(5)}</div>
  </div>
`);

window.init_admin_akademik = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { data: null, tab: 'year' };

  $('#ak-head').innerHTML = UI.pageHeader({
    title: 'Akademik',
    subtitle: 'Tahun pelajaran, kelas, mata pelajaran, dan penugasan guru.'
  });

  function modal(cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = '<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto">'
      + '<h3 style="font-weight:800;font-size:18px;margin-bottom:12px">' + esc(cfg.title) + '</h3>'
      + '<form id="ak-form" class="space-y-3">'
      + cfg.fields.map(f => {
          const label = '<label style="font-size:12px;font-weight:700">' + esc(f.label) + (f.required ? ' *' : '') + '</label>';
          if (f.type === 'select') {
            return '<div>' + label + '<select name="' + esc(f.name) + '" class="w-full border rounded-xl px-3 py-2 text-sm">'
              + (f.options || []).map(o => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(f.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('')
              + '</select></div>';
          }
          return '<div>' + label + '<input name="' + esc(f.name) + '" type="' + esc(f.type || 'text') + '" value="' + esc(f.value || '') + '" class="w-full border rounded-xl px-3 py-2 text-sm"></div>';
        }).join('')
      + '<div class="flex gap-2" style="margin-top:16px"><button type="submit" class="btn btn-primary flex-1">Simpan</button>'
      + '<button type="button" data-cancel class="btn btn-secondary">Batal</button></div></form></div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-cancel]').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
    wrap.querySelector('#ak-form').onsubmit = async e => {
      e.preventDefault();
      const f = wrap.querySelector('#ak-form');
      const v = {};
      cfg.fields.forEach(x => { v[x.name] = f.querySelector('[name="' + x.name + '"]').value.trim(); });
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      const r = await cfg.onSubmit(v);
      if (r && r.ok) { close(); API.toast('✅ Tersimpan'); await load(); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); btn.disabled = false; btn.textContent = 'Simpan'; }
    };
  }

  function yearOptions() {
    return (state.data.years || []).map(y => ({ value: y.id, label: y.label + (y.is_active ? ' (aktif)' : '') }));
  }
  function gradeOptions() {
    return (state.data.grades || []).map(g => ({ value: g.id, label: 'Tingkat ' + g.label }));
  }
  function teacherOptions() {
    return (state.data.teachers || []).map(t => ({ value: t.id, label: t.full_name + ' (' + t.username + ')' }));
  }
  function subjectOptions() {
    return (state.data.subjects || []).map(s => ({ value: s.id, label: s.code + ' — ' + s.name }));
  }
  function classOptions() {
    return [{ value: '', label: 'Semua kelas (mapel/tahun)' }].concat((state.data.classes || []).map(c => ({ value: c.id, label: c.label })));
  }

  function renderYears() {
    const rows = state.data.years || [];
    return '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + '<th class="p-2 text-left">Tahun</th><th class="p-2 text-left">Mulai</th><th class="p-2 text-left">Selesai</th>'
      + '<th class="p-2 text-left">Status</th><th class="p-2 text-left">Aksi</th></tr></thead><tbody>'
      + rows.map(y => `<tr class="border-t"><td class="p-2"><b>${esc(y.label)}</b></td>
        <td class="p-2">${esc(y.start_date)}</td><td class="p-2">${esc(y.end_date)}</td>
        <td class="p-2">${y.is_active ? UI.badge('Aktif', 'success') : UI.badge('Tidak aktif')}</td>
        <td class="p-2"><div class="flex gap-1">
          ${!y.is_active ? `<button class="btn btn-secondary btn-sm" data-activate="${esc(y.id)}">Aktifkan</button>` : ''}
          <button class="btn btn-secondary btn-sm" data-edit-year="${esc(y.id)}">Edit</button>
        </div></td></tr>`).join('')
      + '</tbody></table></div>';
  }

  function renderClasses() {
    const rows = state.data.classes || [];
    return '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + '<th class="p-2 text-left">Kelas</th><th class="p-2 text-left">Tahun</th><th class="p-2 text-left">Tingkat</th>'
      + '<th class="p-2 text-left">Wali</th><th class="p-2"></th></tr></thead><tbody>'
      + rows.map(c => `<tr class="border-t"><td class="p-2"><b>${esc(c.label)}</b></td>
        <td class="p-2">${esc(c.academic_years ? c.academic_years.label : '-')}</td>
        <td class="p-2">${esc(c.grade_levels ? c.grade_levels.label : '-')}</td>
        <td class="p-2">${esc(c.profiles ? c.profiles.full_name : '-')}</td>
        <td class="p-2 text-right"><button class="btn btn-secondary btn-sm" data-edit-class="${esc(c.id)}">Edit</button></td></tr>`).join('')
      + '</tbody></table></div>';
  }

  function renderSubjects() {
    const rows = state.data.subjects || [];
    return '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + '<th class="p-2 text-left">Kode</th><th class="p-2 text-left">Nama</th><th class="p-2"></th></tr></thead><tbody>'
      + rows.map(s => `<tr class="border-t"><td class="p-2"><b>${esc(s.code)}</b></td><td class="p-2">${esc(s.name)}</td>
        <td class="p-2 text-right"><button class="btn btn-secondary btn-sm" data-edit-subject="${esc(s.id)}">Edit</button></td></tr>`).join('')
      + '</tbody></table></div>';
  }

  function renderAssignments() {
    const rows = state.data.assignments || [];
    return '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + '<th class="p-2 text-left">Guru</th><th class="p-2 text-left">Mapel</th><th class="p-2 text-left">Tahun</th>'
      + '<th class="p-2 text-left">Kelas</th><th class="p-2"></th></tr></thead><tbody>'
      + rows.map(a => `<tr class="border-t"><td class="p-2"><b>${esc(a.profiles ? a.profiles.full_name : '-')}</b></td>
        <td class="p-2">${esc(a.subjects ? a.subjects.code : '-')} — ${esc(a.subjects ? a.subjects.name : '')}</td>
        <td class="p-2">${esc(a.academic_years ? a.academic_years.label : '-')}</td>
        <td class="p-2">${esc(a.classes ? a.classes.label : 'Semua kelas')}</td>
        <td class="p-2 text-right"><button class="btn btn-danger btn-sm" data-del-assign="${esc(a.id)}">Hapus</button></td></tr>`).join('')
      + '</tbody></table></div>';
  }

  function render() {
    const body = $('#ak-body');
    if (state.tab === 'year') body.innerHTML = renderYears();
    if (state.tab === 'class') body.innerHTML = renderClasses();
    if (state.tab === 'subject') body.innerHTML = renderSubjects();
    if (state.tab === 'assign') body.innerHTML = renderAssignments();
    bind();
  }

  function bind() {
    document.querySelectorAll('[data-activate]').forEach(b => b.onclick = async () => {
      if (!confirm('Jadikan tahun ini aktif?')) return;
      const r = await API.auth('adminYearActivate', { id: b.dataset.activate });
      if (r && r.ok) { API.toast('✅ Tahun diaktifkan'); await load(); }
      else API.toast('❌ ' + ((r && r.msg) || 'Gagal'));
    });
    document.querySelectorAll('[data-edit-year]').forEach(b => b.onclick = () => {
      const y = (state.data.years || []).find(x => x.id === b.dataset.editYear);
      if (y) yearForm(y);
    });
    document.querySelectorAll('[data-edit-class]').forEach(b => b.onclick = () => {
      const c = (state.data.classes || []).find(x => x.id === b.dataset.editClass);
      if (c) classForm(c);
    });
    document.querySelectorAll('[data-edit-subject]').forEach(b => b.onclick = () => {
      const s = (state.data.subjects || []).find(x => x.id === b.dataset.editSubject);
      if (s) subjectForm(s);
    });
    document.querySelectorAll('[data-del-assign]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus penugasan ini?')) return;
      const r = await API.auth('adminAssignmentDelete', { id: b.dataset.delAssign });
      if (r && r.ok) { API.toast('✅ Dihapus'); await load(); }
      else API.toast('❌ ' + ((r && r.msg) || 'Gagal'));
    });
  }

  function yearForm(y) {
    modal({
      title: y ? 'Edit Tahun' : 'Tambah Tahun',
      fields: [
        { name: 'label', label: 'Label', required: true, value: y ? y.label : '', placeholder: '2026/2027' },
        { name: 'start', label: 'Mulai', type: 'date', required: true, value: y ? y.start_date : '' },
        { name: 'end', label: 'Selesai', type: 'date', required: true, value: y ? y.end_date : '' }
      ],
      onSubmit: v => API.auth('adminYearSave', { id: y ? y.id : null, label: v.label, start: v.start, end: v.end })
    });
  }

  function classForm(c) {
    modal({
      title: c ? 'Edit Kelas' : 'Tambah Kelas',
      fields: [
        { name: 'label', label: 'Label kelas', required: true, value: c ? c.label : '', placeholder: '8.A' },
        { name: 'yearId', label: 'Tahun pelajaran', type: 'select', options: yearOptions(), value: c ? c.academic_year_id : '' },
        { name: 'gradeId', label: 'Tingkat', type: 'select', options: gradeOptions(), value: c ? c.grade_level_id : '' },
        { name: 'homeroomId', label: 'Wali kelas', type: 'select', options: [{ value: '', label: '-' }].concat(teacherOptions()), value: c && c.homeroom_id ? c.homeroom_id : '' }
      ],
      onSubmit: v => API.auth('adminClassSave', { id: c ? c.id : null, label: v.label, yearId: v.yearId, gradeId: v.gradeId, homeroomId: v.homeroomId })
    });
  }

  function subjectForm(s) {
    modal({
      title: s ? 'Edit Mapel' : 'Tambah Mapel',
      fields: [
        { name: 'code', label: 'Kode', required: true, value: s ? s.code : '', placeholder: 'MTK' },
        { name: 'name', label: 'Nama mapel', required: true, value: s ? s.name : '', placeholder: 'Matematika' }
      ],
      onSubmit: v => API.auth('adminSubjectSave', { id: s ? s.id : null, code: v.code, name: v.name })
    });
  }

  function assignmentForm() {
    modal({
      title: 'Tambah Penugasan',
      fields: [
        { name: 'teacherId', label: 'Guru', type: 'select', options: teacherOptions() },
        { name: 'subjectId', label: 'Mapel', type: 'select', options: subjectOptions() },
        { name: 'yearId', label: 'Tahun', type: 'select', options: yearOptions() },
        { name: 'classId', label: 'Kelas', type: 'select', options: classOptions() }
      ],
      onSubmit: v => API.auth('adminAssignmentSave', v)
    });
  }

  async function load() {
    const r = await API.auth('adminAcademic');
    if (!r || !r.ok) {
      $('#ak-body').innerHTML = UI.empty('Gagal memuat data akademik', (r && r.msg) || 'Coba lagi.');
      return;
    }
    state.data = r;
    render();
  }

  const tabs = {
    year: $('#ak-tab-year'), class: $('#ak-tab-class'),
    subject: $('#ak-tab-subject'), assign: $('#ak-tab-assign')
  };
  function show(tab) {
    state.tab = tab;
    Object.keys(tabs).forEach(k => {
      tabs[k].className = 'btn btn-sm ' + (k === tab ? 'btn-primary' : 'btn-secondary');
    });
    render();
  }
  Object.keys(tabs).forEach(k => { tabs[k].onclick = () => show(k); });
  $('#ak-add').onclick = () => {
    if (state.tab === 'year') yearForm(null);
    else if (state.tab === 'class') classForm(null);
    else if (state.tab === 'subject') subjectForm(null);
    else assignmentForm();
  };

  await load();
  show('year');
};
