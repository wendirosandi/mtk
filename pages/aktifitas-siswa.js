/* ============ pages/aktifitas-siswa.js ============ */
Router.register('siswa-aktifitas', async () => {
  return `
    <div class="max-w-2xl mx-auto">
      <button onclick="Router.go('siswa-dash')" class="text-sky-600 text-sm font-bold">← Kembali</button>
      <div class="bg-white rounded-2xl shadow-xl p-5 mt-3">
        <h2 class="font-bold text-lg mb-3">📈 Aktifitas Saya</h2>
        <div class="flex gap-2 mb-3">
          <select id="as-app" class="border rounded-xl px-3 py-2 text-sm"><option value="">Semua App</option></select>
          <select id="as-jenis" class="border rounded-xl px-3 py-2 text-sm">
            <option value="">Semua Jenis</option><option>section</option><option>submit</option>
          </select>
        </div>
        <div id="as-tbl" class="space-y-2"></div>
      </div>
    </div>
  `;
});

window.init_siswa_aktifitas = async () => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const AS = { rows: [] };

  async function load() {
    const r = await API.auth('siswaGetAktifitas', {});
    AS.rows = r.rows;
    $('#as-app').innerHTML = '<option value="">Semua App</option>'
      + [...new Set(r.rows.map(x => x.app))].map(a => '<option>' + a + '</option>').join('');
    render();
  }

  function render() {
    const rows = AS.rows.filter(x =>
      (!$('#as-app').value || x.app === $('#as-app').value) &&
      (!$('#as-jenis').value || x.jenis === $('#as-jenis').value)
    );
    $('#as-tbl').innerHTML = rows.length
      ? rows.map(r =>
          '<div class="border rounded-xl px-3 py-2 text-sm flex justify-between">'
          + '<span><b>' + r.section + '</b> '
          + '<span class="text-[10px] bg-sky-100 text-sky-700 px-1.5 rounded font-bold">' + r.jenis + '</span>'
          + '<span class="block text-[11px] text-gray-500">' + r.app + ' • ' + r.tanggal + '</span></span>'
          + '<span class="font-bold">' + r.durasi + 's' + (r.skor !== '' ? ' • ' + r.skor : '') + '</span></div>'
        ).join('')
      : '<p class="text-sm text-gray-500 text-center py-6">Belum ada aktifitas.</p>';
  }

  $('#as-app').onchange = render;
  $('#as-jenis').onchange = render;
  await load();
};