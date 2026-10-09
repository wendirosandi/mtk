/* ============ pages/dash-guru.js ============ */
Router.register('guru-dash', async () => {
  const m = API.getMeta();
  return `
    <div class="max-w-md mx-auto">
      <div class="bg-indigo-700 text-white rounded-2xl p-5">
        <div class="text-xs opacity-80">🏫 Guru</div>
        <div class="text-lg font-extrabold">${m.namaGuru||'-'}</div>
        <div class="text-sm opacity-90">${m.namaSekolah||''}</div>
      </div>
      <div class="grid grid-cols-2 gap-3 mt-4">
        <div class="svc" onclick="Router.go('guru-rekap')"><div class="ic bg-teal-100 text-teal-600"><i class="fas fa-chart-simple"></i></div>Rekap Nilai</div>
        <div class="svc" onclick="Router.go('guru-performa')"><div class="ic bg-amber-100 text-amber-600"><i class="fas fa-star-half-stroke"></i></div>Performa</div>
        <div class="svc" onclick="Router.go('guru-kolab')"><div class="ic bg-pink-100 text-pink-600"><i class="fas fa-handshake"></i></div>Kolaborasi</div>
        <div class="svc" onclick="Router.go('guru-akses')"><div class="ic bg-green-100 text-green-600"><i class="fas fa-user-plus"></i></div>Akses Susulan</div>
        <div class="svc" onclick="Router.go('guru-aktifitas')"><div class="ic bg-cyan-100 text-cyan-600"><i class="fas fa-wave-square"></i></div>Aktifitas</div>
        <div class="svc" onclick="Router.go('guru-akun')"><div class="ic bg-purple-100 text-purple-600"><i class="fas fa-user-pen"></i></div>Permintaan Akun</div>
        <div class="svc" onclick="Router.go('guru-reset')"><div class="ic bg-orange-100 text-orange-600"><i class="fas fa-key"></i></div>Reset Password</div>
        <div class="svc" onclick="Router.go('guru-profil')"><div class="ic bg-violet-100 text-violet-600"><i class="fas fa-id-badge"></i></div>Profil</div>
      </div>
      <button onclick="API.logout()" class="w-full mt-6 text-rose-600 font-bold py-3 bg-rose-50 rounded-xl">Keluar</button>
    </div>
  `;
});
window.init_guru_dash = async () => {};