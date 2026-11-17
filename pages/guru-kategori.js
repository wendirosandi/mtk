/* ============ pages/guru-kategori.js — kategori per mapel ============ */
Router.register('guru-kategori', async () => `
  <div class="page-wrap">
    <div id="gk-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="flex flex-wrap gap-2 items-center">
        <label class="card-sub" style="font-weight:700">Kelas</label>
        <select id="gk-class" class="border rounded-xl px-3 py-2 text-sm"></select>
        <label class="card-sub" style="font-weight:700">Mapel</label>
        <select id="gk-subject" class="border rounded-xl px-3 py-2 text-sm"></select>
        <div class="flex-1"></div>
        <button id="gk-refresh" type="button" class="btn btn-secondary btn-sm">Muat ulang</button>
      </div>
      <p class="card-sub" style="margin-top:8px">Hanya mapel/kelas yang Anda ampu. Kategori umum tetap dikelola Walas.</p>
    </div>
    <div id="gk-body">${UI.skeleton(4)}</div>
  </div>
`);

window.init_guru_kategori = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { rows: [], classes: [], subjects: [], classId: null, subjectId: null, students: [] };

  $('#gk-head').innerHTML = UI.pageHeader({
    title: 'Kategori Mapel',
    subtitle: 'Kategori akademik siswa per mata pelajaran yang Anda ampu.'
  });

  const kelas = await API.auth('guruKelas');
  state.rows = (kelas && kelas.rows) || [];
  if (!state.rows.length) {
    $('#gk-body').innerHTML = UI.empty('Belum ada penugasan', 'Anda belum memiliki kelas/mapel yang diampu.');
    return;
  }

  const seen = {};
  state.rows.forEach(r => {
    if (!seen[r.classId]) { seen[r.classId] = true; state.classes.push({ id: r.classId, label: r.kelas }); }
  });
  state.classId = state.classes[0].id;
  $('#gk-class').innerHTML = state.classes.map(c =>
    `<option value="${esc(c.id)}"${c.id === state.classId ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
  $('#gk-class').onchange = () => { state.classId = $('#gk-class').value; fillSubjects(); };

  function fillSubjects() {
    const list = state.rows.filter(r => r.classId === state.classId);
    const uniq = {}, subs = [];
    list.forEach(r => {
      if (!uniq[r.subjectId]) { uniq[r.subjectId] = true; subs.push({ id: r.subjectId, label: r.subjectCode + ' — ' + r.subjectName }); }
    });
    state.subjects = subs;
    state.subjectId = subs.length ? subs[0].id : null;
    $('#gk-subject').innerHTML = subs.map(s =>
      `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
    $('#gk-subject').onchange = () => { state.subjectId = $('#gk-subject').value; load(); };
    load();
  }

  function render() {
    const rows = state.students || [];
    $('#gk-body').innerHTML = rows.length
      ? '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
        + '<th class="p-2 text-left">Siswa</th><th class="p-2 text-left">Umum</th><th class="p-2 text-left">Kategori Mapel</th><th class="p-2"></th>'
        + '</tr></thead><tbody>' + rows.map(r => `<tr class="border-t">
            <td class="p-2"><b>${esc(r.full_name)}</b><span class="block text-[10px] text-gray-500">${esc(r.username)}</span></td>
            <td class="p-2">${r.kategori_umum ? UI.badge('Umum ' + r.kategori_umum, 'info') : '<span class="text-gray-400">—</span>'}</td>
            <td class="p-2"><select class="border rounded-lg px-2 py-1 text-xs" data-cat="${esc(r.profile_id)}">
              <option value="">—</option>
              ${['A','B','C'].map(c => `<option value="${c}"${r.kategori_mapel === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select></td>
            <td class="p-2 text-right"><button class="btn btn-secondary btn-sm" data-hist="${esc(r.profile_id)}" data-name="${esc(r.full_name)}">Riwayat</button></td>
          </tr>`).join('') + '</tbody></table></div>'
      : UI.empty('Belum ada siswa', 'Kelas ini belum memiliki anggota.');

    document.querySelectorAll('[data-cat]').forEach(sel => {
      sel.onchange = async () => {
        if (!sel.value) return;
        sel.disabled = true;
        const r = await API.auth('saveSubjectCategory', {
          profileId: sel.dataset.cat,
          subjectId: state.subjectId,
          category: sel.value,
          note: 'Diubah Guru mapel'
        });
        sel.disabled = false;
        if (r && r.ok) { API.toast('✅ Kategori mapel disimpan'); await load(); }
        else API.toast('❌ ' + ((r && r.msg) || 'Gagal'));
      };
    });
    document.querySelectorAll('[data-hist]').forEach(b => b.onclick = () => history(b.dataset.hist, b.dataset.name));
  }

  async function history(profileId, name) {
    const r = await API.auth('getCategoryHistory', { profileId: profileId, limit: 50 });
    const rows = (r && r.rows) || [];
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = '<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto">'
      + '<div class="flex items-center justify-between"><h3 style="font-weight:800;font-size:18px">Riwayat — ' + esc(name) + '</h3>'
      + '<button type="button" data-close class="btn btn-secondary btn-sm">Tutup</button></div>'
      + (rows.length ? '<div style="margin-top:12px;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
        + '<th class="p-2 text-left">Waktu</th><th class="p-2 text-left">Jenis</th><th class="p-2 text-left">Mapel</th><th class="p-2 text-left">Nilai</th></tr></thead><tbody>'
        + rows.map(h => `<tr class="border-t"><td class="p-2">${esc(h.changed_at ? new Date(h.changed_at).toLocaleString('id-ID') : '-')}</td>
            <td class="p-2">${esc(h.scope)}</td><td class="p-2">${esc(h.subject_name || '-')}</td>
            <td class="p-2">${h.previous_category ? esc(h.previous_category) + ' → ' : ''}<b>${esc(h.category)}</b></td></tr>`).join('')
        + '</tbody></table></div>' : '<p class="card-sub" style="margin-top:12px">Belum ada riwayat.</p>')
      + '</div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-close]').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
  }

  async function load() {
    if (!state.classId || !state.subjectId) return;
    $('#gk-body').innerHTML = UI.skeleton(3);
    const r = await API.auth('getClassSubjectCategories', {
      classId: state.classId, subjectId: state.subjectId
    });
    if (!r || !r.ok) {
      $('#gk-body').innerHTML = UI.empty('Gagal memuat kategori', (r && r.msg) || 'Coba lagi.');
      return;
    }
    state.students = r.rows || [];
    render();
  }

  $('#gk-refresh').onclick = load;
  fillSubjects();
};
