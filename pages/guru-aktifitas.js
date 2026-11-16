/* ============ pages/guru-aktifitas.js — log aktivitas (RLS: sekolah) ============ */
Router.register('guru-aktifitas', async () => `
  <div class="max-w-3xl mx-auto space-y-4">
    <button onclick="Router.go('guru-dash')" class="text-sky-600 text-sm font-bold">← Kembali</button>
    <div class="bg-white rounded-2xl shadow-xl p-5 space-y-3">
      <h2 class="font-bold text-lg">📈 Aktifitas Siswa</h2>
      <div class="flex flex-wrap gap-2">
        <select id="ga-app" class="border rounded-xl px-3 py-2 text-sm"></select>
        <select id="ga-jenis" class="border rounded-xl px-3 py-2 text-sm">
          <option value="">Semua Jenis</option><option>section</option><option>submit</option>
        </select>
        <div class="flex-1"></div>
        <button id="ga-refresh" class="text-sky-600 text-xl" title="Muat ulang">🔄</button>
      </div>
      <p id="ga-info" class="text-xs text-gray-500"></p>
      <div id="ga-list" class="space-y-2"></div>
    </div>
  </div>
`);

window.init_guru_aktifitas = async () => {
  const $ = s => document.querySelector(s);
  const GA = { rows: [] };

  function render() {
    const app = $('#ga-app').value;
    const jenis = $('#ga-jenis').value;
    const rows = GA.rows.filter(r => (!app || r.app === app) && (!jenis || r.jenis === jenis));
    $('#ga-info').textContent = rows.length + ' aktivitas terakhir';
    $('#ga-list').innerHTML = rows.length
      ? rows.map(r =>
          '<div class="border rounded-xl px-3 py-2 text-sm flex justify-between gap-2">'
          + '<div><div><b>' + r.nama + '</b> <span class="text-[10px] text-gray-500">' + r.username + '</span></div>'
          + '<div class="text-[11px] text-gray-600">' + r.section + ' • ' + r.app
          + ' <span class="bg-sky-100 text-sky-700 px-1.5 rounded font-bold">' + r.jenis + '</span></div>'
          + '<div class="text-[10px] text-gray-400">' + r.tanggal + '</div></div>'
          + '<span class="font-bold whitespace-nowrap">' + r.durasi + 's'
          + (r.skor !== '' ? ' • ' + r.skor : '') + '</span></div>').join('')
      : '<p class="text-sm text-gray-500 text-center py-6">Belum ada aktivitas.</p>';
  }

  async function load() {
    const r = await API.auth('guruGetAktifitas');
    GA.rows = (r && r.rows) || [];
    $('#ga-app').innerHTML = '<option value="">Semua App</option>'
      + [...new Set(GA.rows.map(x => x.app))].map(a => '<option>' + a + '</option>').join('');
    render();
  }

  $('#ga-app').onchange = render;
  $('#ga-jenis').onchange = render;
  $('#ga-refresh').onclick = () => { API.toast('🔄 Memuat ulang...'); load(); };
  await load();
};
