/* ============ pages/dash-guru.js ============ */
Router.register('guru-dash', async () => {
  const m = API.getMeta();
  const live = (route, ic, icCls, label) =>
    `<div class="svc" onclick="Router.go('${route}')">
       <div class="ic ${icCls}"><i class="fas ${ic}"></i></div>${label}</div>`;
  const soon = (ic, icCls, label) =>
    `<div class="svc opacity-50 cursor-not-allowed" title="Belum tersedia">
       <div class="ic ${icCls}"><i class="fas ${ic}"></i></div>${label}
       <span class="block text-[9px] text-gray-400 mt-1">Segera</span></div>`;
  return `
    <div class="max-w-md mx-auto">
      <div class="bg-indigo-700 text-white rounded-2xl p-5">
        <div class="text-xs opacity-80">🏫 Guru</div>
        <div class="text-lg font-extrabold">${m.namaGuru || m.nama || '-'}</div>
        <div class="text-sm opacity-90">${m.namaSekolah || ''}</div>
      </div>
      <div class="grid grid-cols-2 gap-3 mt-4">
        ${live('guru-rekap', 'fa-chart-simple', 'bg-teal-100 text-teal-600', 'Rekap Nilai')}
        ${live('guru-aktifitas', 'fa-wave-square', 'bg-cyan-100 text-cyan-600', 'Aktifitas')}
        ${soon('fa-star-half-stroke', 'bg-amber-100 text-amber-600', 'Performa')}
        ${soon('fa-handshake', 'bg-pink-100 text-pink-600', 'Kolaborasi')}
        ${soon('fa-user-plus', 'bg-green-100 text-green-600', 'Akses Susulan')}
        ${soon('fa-user-pen', 'bg-purple-100 text-purple-600', 'Permintaan Akun')}
        ${soon('fa-key', 'bg-orange-100 text-orange-600', 'Reset Password')}
        ${soon('fa-id-badge', 'bg-violet-100 text-violet-600', 'Profil')}
      </div>
      <button onclick="API.logout()" class="w-full mt-6 text-rose-600 font-bold py-3 bg-rose-50 rounded-xl">Keluar</button>
    </div>
  `;
});
window.init_guru_dash = async () => {};
