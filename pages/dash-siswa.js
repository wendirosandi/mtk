/* ============ pages/dash-siswa.js ============ */
Router.register('siswa-dash', async () => {
  const m = API.getMeta();
  return `
    <div class="max-w-md mx-auto">
      <div class="bg-teal-700 text-white rounded-2xl p-5">
        <div class="text-xs opacity-80">👨‍🎓 Siswa</div>
        <div class="text-lg font-extrabold">${m.nama||'-'}</div>
        <div class="text-sm opacity-90">${m.kelas||''} • Kategori ${m.kategori||''}</div>
      </div>
      <div class="grid grid-cols-2 gap-3 mt-4">
        <div class="svc" onclick="Router.go('siswa-nilai')"><div class="ic bg-teal-100 text-teal-600"><i class="fas fa-chart-line"></i></div>LKPD & Nilai</div>
        <div class="svc" onclick="Router.go('siswa-aktifitas')"><div class="ic bg-cyan-100 text-cyan-600"><i class="fas fa-wave-square"></i></div>Aktifitas</div>
        <div class="svc" onclick="window.openToolsMath()"><div class="ic bg-sky-100 text-sky-700"><i class="fas fa-calculator"></i></div>Tools Math</div>
        <div class="svc" onclick="Router.go('siswa-profil')"><div class="ic bg-violet-100 text-violet-600"><i class="fas fa-user-graduate"></i></div>Profil</div>
      </div>
      <button onclick="API.logout()" class="w-full mt-6 text-rose-600 font-bold py-3 bg-rose-50 rounded-xl">Keluar</button>
    </div>
  `;
});
window.init_siswa_dash = async () => {
  window.openToolsMath = () => {
    const m = API.getMeta();
    const p = new URLSearchParams({nama:m.nama,kelas:m.kelas,username:API.sess()});
    window.open('https://wendirosandi.github.io/mtk/toolsmathpro/index.html?'+p.toString());
  };
};