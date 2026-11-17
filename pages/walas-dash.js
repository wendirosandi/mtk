/* ============ pages/walas-dash.js — kategori umum kelas walas ============ */
Router.register('guru-walas', async () => `
  <div class="page-wrap">
    <div id="wd-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="flex flex-wrap gap-2 items-center">
        <label for="wd-class" class="card-sub" style="font-weight:700">Kelas</label>
        <select id="wd-class" class="border rounded-xl px-3 py-2 text-sm"></select>
        <div class="flex-1"></div>
        <button id="wd-refresh" type="button" class="btn btn-secondary btn-sm">Muat ulang</button>
      </div>
      <p class="card-sub" style="margin-top:8px">Kategori umum dikelola Walas. Kategori mapel dikelola Guru pengampu.</p>
    </div>
    <div id="wd-body">${UI.skeleton(4)}</div>
  </div>
`);

window.init_guru_walas = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { classes: [], classId: null, rows: [] };

  $('#wd-head').innerHTML = UI.pageHeader({
    title: 'Walas',
    subtitle: 'Kategori umum siswa di kelas yang menjadi tanggung jawab Anda.'
  });

  function renderClasses() {
    $('#wd-class').innerHTML = state.classes.map(c =>
      `<option value="${esc(c.id)}"${c.id === state.classId ? ' selected' : ''}>${esc(c.label)} · ${esc(c.tahun)} (${c.studentCount} siswa)</option>`
    ).join('');
    $('#wd-class').onchange = () => { state.classId = $('#wd-class').value; loadStudents(); };
  }

  function render() {
    const rows = state.rows || [];
    $('#wd-body').innerHTML = rows.length
      ? '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
        + '<th class="p-2 text-left">Siswa</th><th class="p-2 text-left">Kategori Umum</th><th class="p-2 text-left">Diperbarui</th><th class="p-2"></th>'
        + '</tr></thead><tbody>' + rows.map(r => `<tr class="border-t">
            <td class="p-2"><b>${esc(r.full_name)}</b><span class="block text-[10px] text-gray-500">${esc(r.username)}</span></td>
            <td class="p-2">
              <select class="border rounded-lg px-2 py-1 text-xs" data-cat="${esc(r.profile_id)}">
                <option value="">—</option>
                ${['A','B','C'].map(c => `<option value="${c}"${r.category === c ? ' selected' : ''}>${c}</option>`).join('')}
              </select>
            </td>
            <td class="p-2 text-gray-500">${esc(r.updated_at ? new Date(r.updated_at).toLocaleString('id-ID') : '-')}</td>
            <td class="p-2 text-right"><button class="btn btn-secondary btn-sm" data-hist="${esc(r.profile_id)}" data-name="${esc(r.full_name)}">Riwayat</button></td>
          </tr>`).join('') + '</tbody></table></div>'
      : UI.empty('Belum ada siswa', 'Kelas ini belum memiliki anggota aktif.');

    document.querySelectorAll('[data-cat]').forEach(sel => {
      sel.onchange = async () => {
        if (!sel.value) return;
        sel.disabled = true;
        const r = await API.auth('saveGeneralCategory', {
          profileId: sel.dataset.cat, category: sel.value, note: 'Diubah Walas'
        });
        sel.disabled = false;
        if (r && r.ok) { API.toast('✅ Kategori umum disimpan'); await loadStudents(); }
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
        + '<th class="p-2 text-left">Waktu</th><th class="p-2 text-left">Jenis</th><th class="p-2 text-left">Mapel</th>'
        + '<th class="p-2 text-left">Nilai</th><th class="p-2 text-left">Oleh</th></tr></thead><tbody>'
        + rows.map(h => `<tr class="border-t"><td class="p-2">${esc(h.changed_at ? new Date(h.changed_at).toLocaleString('id-ID') : '-')}</td>
            <td class="p-2">${esc(h.scope)}</td><td class="p-2">${esc(h.subject_name || '-')}</td>
            <td class="p-2">${h.previous_category ? esc(h.previous_category) + ' → ' : ''}<b>${esc(h.category)}</b></td>
            <td class="p-2">${esc(h.changed_by_name || 'sistem')}</td></tr>`).join('')
        + '</tbody></table></div>' : '<p class="card-sub" style="margin-top:12px">Belum ada riwayat.</p>')
      + '</div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-close]').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
  }

  async function loadStudents() {
    $('#wd-body').innerHTML = UI.skeleton(3);
    const r = await API.auth('getClassGeneralCategories', { classId: state.classId });
    if (!r || !r.ok) {
      $('#wd-body').innerHTML = UI.empty('Gagal memuat siswa', (r && r.msg) || 'Coba lagi.');
      return;
    }
    state.rows = r.rows || [];
    render();
  }

  const r = await API.auth('walasClasses');
  state.classes = (r && r.rows) || [];
  if (!state.classes.length) {
    $('#wd-body').innerHTML = UI.empty('Anda belum menjadi Walas', 'Admin belum menetapkan kelas untuk Anda.');
    return;
  }
  state.classId = state.classes[0].id;
  renderClasses();
  $('#wd-refresh').onclick = loadStudents;
  await loadStudents();
};
