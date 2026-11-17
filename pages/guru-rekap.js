/* ============ pages/guru-rekap.js — matriks nilai & input manual ============ */
Router.register('guru-rekap', async () => `
  <div class="page-wrap">
    <div id="gr-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="flex flex-wrap gap-2 items-center">
        <label for="gr-kelas" class="card-sub" style="font-weight:700">Kelas</label>
        <select id="gr-kelas" class="border rounded-xl px-3 py-2 text-sm"></select>
        <div class="flex-1"></div>
        <button id="gr-refresh" type="button" class="btn btn-secondary btn-sm">Muat ulang</button>
      </div>
      <p id="gr-info" class="card-sub" style="margin-top:8px"></p>
    </div>
    <div id="gr-matrix"></div>
  </div>
`);

window.init_guru_rekap = async (params) => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  $('#gr-head').innerHTML = UI.pageHeader({
    title: 'Nilai',
    subtitle: 'Matriks nilai per kelas. Perubahan disimpan otomatis sebagai nilai manual.'
  });

  $('#gr-matrix').innerHTML = UI.skeleton(5);

  const kelas = await API.auth('guruKelas');
  const rows = (kelas && kelas.rows) || [];
  const seen = {};
  const options = [];
  rows.forEach(r => {
    if (!r.classId || seen[r.classId]) return;
    seen[r.classId] = true;
    options.push({ id: r.classId, label: r.kelas + ' · ' + r.subjectCode });
  });

  if (!options.length) {
    $('#gr-kelas').innerHTML = '<option>—</option>';
    $('#gr-matrix').innerHTML = UI.empty('Belum ada kelas', 'Minta admin menetapkan penugasan mengajar.');
    return;
  }

  const wanted = params && params.class;
  const active = options.some(o => o.id === wanted) ? wanted : options[0].id;
  $('#gr-kelas').innerHTML = options.map(o =>
    `<option value="${esc(o.id)}"${o.id === active ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  $('#gr-kelas').onchange = () => Router.go('guru-rekap', { class: $('#gr-kelas').value });

  const m = await API.auth('guruNilaiMatrix', { classId: active });
  if (!m || !m.ok) {
    $('#gr-matrix').innerHTML = UI.empty('Gagal memuat nilai', (m && m.msg) || 'Coba lagi.');
    return;
  }

  const cls = m.class || {};
  const students = m.students || [];
  const assessments = m.assessments || [];
  const scoreMap = {};
  (m.scores || []).forEach(s => { scoreMap[s.assessment_id + '|' + s.profile_id] = s; });

  $('#gr-info').textContent = 'Kelas ' + (cls.label || '-') + ' · ' + students.length + ' siswa · '
    + assessments.length + ' asesmen';

  if (!students.length || !assessments.length) {
    $('#gr-matrix').innerHTML = UI.empty(
      !students.length ? 'Belum ada siswa di kelas ini' : 'Belum ada asesmen untuk mapel ini',
      'Data akan muncul setelah admin/guru melengkapi kelas dan asesmen.'
    );
    return;
  }

  let html = '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs">'
    + '<thead><tr class="bg-slate-100"><th class="p-2 text-left" style="min-width:160px">Siswa</th>';
  assessments.forEach(a => {
    html += `<th class="p-2 text-center" title="${esc(a.title || '')}" style="min-width:88px">${esc(a.code || a.title)}</th>`;
  });
  html += '</tr></thead><tbody>';

  students.forEach(st => {
    html += '<tr class="border-t"><td class="p-2"><b>' + esc(st.full_name) + '</b>'
      + '<span class="block text-[10px] text-gray-500">' + esc(st.username) + '</span></td>';
    assessments.forEach(a => {
      const s = scoreMap[a.id + '|' + st.id];
      const val = s && s.score != null ? s.score : '';
      html += `<td class="p-2 text-center">
        <input type="number" min="0" max="100" step="1" inputmode="numeric"
          class="border rounded-lg px-2 py-1 text-center"
          style="width:64px" value="${esc(val)}"
          data-score data-profile="${esc(st.id)}" data-assessment="${esc(a.id)}"
          aria-label="Nilai ${esc(st.username)} untuk ${esc(a.code)}">
      </td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  $('#gr-matrix').innerHTML = html;

  $('#gr-matrix').querySelectorAll('[data-score]').forEach(inp => {
    inp.onchange = async () => {
      const v = inp.value.trim();
      if (v !== '' && (Number(v) < 0 || Number(v) > 100 || isNaN(Number(v)))) {
        inp.style.borderColor = '#ef4444';
        API.toast('❌ Nilai harus 0–100');
        return;
      }
      inp.disabled = true;
      const r = await API.auth('guruSaveScore', {
        classId: active,
        profileId: inp.dataset.profile,
        assessmentId: inp.dataset.assessment,
        score: v === '' ? null : Number(v)
      });
      inp.disabled = false;
      if (r && r.ok) {
        inp.style.borderColor = '#10b981';
        API.toast('✅ Nilai disimpan');
      } else {
        inp.style.borderColor = '#ef4444';
        API.toast('❌ ' + ((r && r.msg) || 'Gagal menyimpan'));
      }
    };
  });

  $('#gr-refresh').onclick = () => Router.go('guru-rekap', { class: active });
};
