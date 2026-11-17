/* ============ pages/admin-dash.js ============ */
Router.register('admin-dash', async () => {
  const m = API.getMeta();
  const live = (route, ic, cls, label) =>
    `<a class="svc" href="#${route}" style="text-decoration:none">
       <div class="ic ${cls}"><i class="fas ${ic}"></i></div>${label}</a>`;
  const soon = (ic, cls, label) =>
    `<div class="svc opacity-50 cursor-not-allowed" title="Belum tersedia">
       <div class="ic ${cls}"><i class="fas ${ic}"></i></div>${label}
       <span class="block text-[9px] text-gray-400 mt-1">Segera</span></div>`;

  return `
    <div class="page-wrap">
      ${UI.pageHeader({
        title: 'Dashboard Admin',
        subtitle: (m.namaSekolah || '') + ' · ringkasan operasional sekolah'
      })}
      <div id="ad-stats">${UI.skeleton(3)}</div>
      <div class="grid grid-cols-2 gap-3 mt-4">
        ${live('admin-pengguna', 'fa-user-gear', 'bg-teal-100 text-teal-600', 'Pengguna')}
        ${live('admin-sekolah', 'fa-building', 'bg-sky-100 text-sky-700', 'Profil Sekolah')}
        ${live('admin-monitoring', 'fa-desktop', 'bg-cyan-100 text-cyan-600', 'Monitoring')}
        ${live('admin-akademik', 'fa-school', 'bg-amber-100 text-amber-600', 'Akademik')}
        ${live('admin-pengaturan', 'fa-sliders', 'bg-violet-100 text-violet-600', 'Pengaturan')}
        ${soon('fa-layer-group', 'bg-indigo-100 text-indigo-600', 'Kurikulum')}
      </div>
    </div>
  `;
});

window.init_admin_dash = async () => {
  const $ = s => document.querySelector(s);
  const r = await API.auth('adminDashboard');
  if (!r || !r.ok) {
    $('#ad-stats').innerHTML = UI.empty('Gagal memuat statistik', (r && r.msg) || 'Coba lagi.');
    return;
  }
  const s = r.stats || {};
  $('#ad-stats').innerHTML = UI.statGrid([
    { label: 'Pengguna', value: s.users || 0 },
    { label: 'Kelas', value: s.classes || 0 },
    { label: 'Mapel', value: s.subjects || 0 },
    { label: 'Modul', value: s.modules || 0 },
    { label: 'Asesmen', value: s.assessments || 0 },
    { label: 'Baris nilai', value: s.grades || 0 },
    { label: 'Aktivitas hari ini', value: s.activities || 0 },
    { label: 'Permintaan akun', value: s.requests || 0, hint: 'menunggu keputusan' }
  ]);
};
