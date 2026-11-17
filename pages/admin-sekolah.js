/* ============ pages/admin-sekolah.js — profil & pengaturan sekolah ============ */
Router.register('admin-sekolah', async () => `
  <div class="page-wrap page-narrow">
    <div id="ask-head"></div>
    <div id="ask-body">${UI.skeleton(5)}</div>
  </div>
`);

window.init_admin_sekolah = async () => {
  const $ = s => document.querySelector(s);
  $('#ask-head').innerHTML = UI.pageHeader({
    title: 'Profil Sekolah',
    subtitle: 'Identitas sekolah dan pengaturan aktivitas belajar.'
  });

  const r = await API.auth('adminSchoolGet');
  if (!r || !r.ok) {
    $('#ask-body').innerHTML = UI.empty('Gagal memuat sekolah', (r && r.msg) || 'Coba lagi.');
    return;
  }
  const s = r.school || {};
  const st = s.settings || {};
  const act = st.activity || {};

  $('#ask-body').innerHTML = `<div class="card">
    <form id="ask-form" class="space-y-3">
      <div><label class="card-sub" style="font-weight:700">Kode sekolah</label>
        <input class="w-full border rounded-xl px-3 py-2 text-sm" value="${UI.esc(s.code || '')}" disabled></div>
      <div><label class="card-sub" style="font-weight:700">Nama sekolah *</label>
        <input name="name" class="w-full border rounded-xl px-3 py-2 text-sm" value="${UI.esc(s.name || '')}"></div>
      <div><label class="card-sub" style="font-weight:700">Kepala sekolah</label>
        <input name="headmaster" class="w-full border rounded-xl px-3 py-2 text-sm" value="${UI.esc(s.headmaster || '')}"></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="card-sub" style="font-weight:700">Semester aktif</label>
          <select name="semester"><option${st.semester_active === 'Ganjil' ? ' selected' : ''}>Ganjil</option>
          <option${st.semester_active === 'Genap' ? ' selected' : ''}>Genap</option></select></div>
        <div><label class="card-sub" style="font-weight:700">Tahun aktif</label>
          <input name="ta" class="w-full border rounded-xl px-3 py-2 text-sm" value="${UI.esc(st.ta_active || '')}" placeholder="2025/2026"></div>
      </div>
      <div class="card-sub" style="font-weight:800;color:var(--text);margin-top:8px">Aturan aktivitas</div>
      <div class="grid grid-cols-3 gap-2">
        <div><label class="card-sub" style="font-weight:700">Min (detik)</label>
          <input name="min" type="number" min="0" class="w-full border rounded-xl px-3 py-2 text-sm" value="${UI.esc(act.min_sec != null ? act.min_sec : 30)}"></div>
        <div><label class="card-sub" style="font-weight:700">Maks (detik)</label>
          <input name="max" type="number" min="0" class="w-full border rounded-xl px-3 py-2 text-sm" value="${UI.esc(act.max_sec != null ? act.max_sec : 150)}"></div>
        <div><label class="card-sub" style="font-weight:700">Maks/hari</label>
          <input name="cap" type="number" min="0" class="w-full border rounded-xl px-3 py-2 text-sm" value="${UI.esc(act.max_per_day != null ? act.max_per_day : 3)}"></div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%">Simpan Pengaturan</button>
    </form>
  </div>`;

  const f = $('#ask-form');
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const settings = Object.assign({}, st, {
      semester_active: f.semester.value,
      ta_active: f.ta.value.trim(),
      activity: {
        min_sec: Number(f.min.value) || 0,
        max_sec: Number(f.max.value) || 0,
        max_per_day: Number(f.cap.value) || 0
      }
    });
    const r2 = await API.auth('adminSchoolSave', {
      name: f.name.value, headmaster: f.headmaster.value, settings: settings
    });
    if (r2 && r2.ok) {
      API.toast('✅ Pengaturan disimpan');
      setTimeout(() => location.reload(), 700);
    } else {
      API.toast('❌ ' + ((r2 && r2.msg) || 'Gagal'));
      btn.disabled = false; btn.textContent = 'Simpan Pengaturan';
    }
  };
};
