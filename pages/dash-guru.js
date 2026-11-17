/* ============ pages/dash-guru.js ============ */
Router.register('guru-dash', async () => {
  const m = API.getMeta();
  const live = (route, ic, icCls, label) =>
    `<a class="svc" href="#${route}" style="text-decoration:none">
       <div class="ic ${icCls}"><i class="fas ${ic}"></i></div>${label}</a>`;
  const soon = (ic, icCls, label) =>
    `<div class="svc opacity-50 cursor-not-allowed" title="Belum tersedia">
       <div class="ic ${icCls}"><i class="fas ${ic}"></i></div>${label}
       <span class="block text-[9px] text-gray-400 mt-1">Segera</span></div>`;

  return `
    <div class="page-wrap">
      ${UI.pageHeader({
        title: m.namaGuru || m.nama || 'Dashboard Guru',
        subtitle: (m.namaSekolah || '') + ' · ringkasan kelas yang Anda ampu'
      })}
      <div id="gd-stats">${UI.skeleton(3)}</div>
      <div class="grid grid-cols-2 gap-3 mt-4">
        ${live('guru-kelas', 'fa-users', 'bg-teal-100 text-teal-600', 'Kelas Saya')}
        ${live('guru-kurikulum', 'fa-layer-group', 'bg-amber-100 text-amber-600', 'Kurikulum')}
        ${live('guru-rekap', 'fa-table-list', 'bg-sky-100 text-sky-700', 'Nilai')}
        ${live('guru-monitor', 'fa-desktop', 'bg-indigo-100 text-indigo-600', 'Monitoring')}
        ${live('guru-aktifitas', 'fa-wave-square', 'bg-cyan-100 text-cyan-600', 'Aktivitas')}
        ${live('guru-asesmen', 'fa-file-pen', 'bg-amber-100 text-amber-600', 'Asesmen')}
        ${live('guru-bank', 'fa-database', 'bg-pink-100 text-pink-600', 'Bank Soal')}
        ${soon('fa-handshake', 'bg-purple-100 text-purple-600', 'Kolaborasi')}
        ${soon('fa-inbox', 'bg-green-100 text-green-600', 'Permintaan')}
      </div>
    </div>
  `;
});

window.init_guru_dash = async () => {
  const $ = s => document.querySelector(s);
  const r = await API.auth('guruDashboard');
  if (!r || !r.ok) {
    $('#gd-stats').innerHTML = UI.empty('Gagal memuat ringkasan', (r && r.msg) || 'Coba lagi nanti.');
    return;
  }
  const s = r.stats || {};
  $('#gd-stats').innerHTML = UI.statGrid([
    { label: 'Kelas diampu', value: s.classes || 0 },
    { label: 'Siswa', value: s.students || 0 },
    { label: 'Asesmen', value: s.assessments || 0 },
    { label: 'Perlu dinilai', value: s.pendingGrades || 0, hint: 'attempt belum selesai' },
    { label: 'Baris nilai', value: s.grades || 0 },
    { label: 'Aktivitas hari ini', value: s.activityToday || 0 }
  ]);
};
