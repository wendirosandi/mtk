/* ============ pages/guru-kelas.js — mapel & kelas yang diampu ============ */
Router.register('guru-kelas', async () => `
  <div class="page-wrap">
    <div id="gk-head"></div>
    <div id="gk-body">${UI.skeleton(3)}</div>
  </div>
`);

window.init_guru_kelas = async () => {
  const $ = s => document.querySelector(s);
  $('#gk-head').innerHTML = UI.pageHeader({
    title: 'Kelas Saya',
    subtitle: 'Mata pelajaran dan kelas yang Anda ampu.'
  });

  const r = await API.auth('guruKelas');
  const rows = (r && r.rows) || [];
  if (!rows.length) {
    $('#gk-body').innerHTML = UI.empty('Belum ada penugasan', 'Hubungi admin untuk menetapkan mapel dan kelas.');
    return;
  }

  $('#gk-body').innerHTML = '<div class="grid gap-3 sm:grid-cols-2">' + rows.map(x => `
    <div class="card">
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="card-title">${UI.esc(x.subjectCode)} — ${UI.esc(x.subjectName)}</div>
          <div class="card-sub">Kelas ${UI.esc(x.kelas)}${x.tingkat ? ' · Tingkat ' + UI.esc(x.tingkat) : ''}</div>
        </div>
        ${UI.badge(x.tahun || 'Tahun aktif', 'info')}
      </div>
      <div class="card-sub" style="margin-top:8px">${UI.esc(x.studentCount)} siswa · ${UI.esc(x.assessmentCount)} asesmen</div>
      <div style="margin-top:12px">
        <a class="btn btn-primary btn-sm" href="#guru-rekap?class=${encodeURIComponent(x.classId)}">Lihat nilai</a>
      </div>
    </div>`).join('') + '</div>';
};
