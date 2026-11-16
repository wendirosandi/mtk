/* ============ pages/guru-rekap.js — rekap nilai (RLS: kelas terassign) ============ */
Router.register('guru-rekap', async () => `
  <div class="max-w-4xl mx-auto space-y-4">
    <button onclick="Router.go('guru-dash')" class="text-sky-600 text-sm font-bold">← Kembali</button>
    <div class="bg-white rounded-2xl shadow-xl p-5 space-y-3">
      <h2 class="font-bold text-lg">📊 Rekap Nilai</h2>
      <div class="flex flex-wrap gap-2 items-center">
        <select id="gr-kelas" class="border rounded-xl px-3 py-2 text-sm"></select>
        <input id="gr-cari" class="border rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px]" placeholder="Cari nama / kode">
        <button id="gr-refresh" class="text-sky-600 text-xl" title="Muat ulang">🔄</button>
      </div>
      <p id="gr-info" class="text-xs text-gray-500"></p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-slate-100 text-left">
              <th class="p-2">Siswa</th><th class="p-2">Kelas</th>
              <th class="p-2">Asesmen</th><th class="p-2">Jenis</th>
              <th class="p-2 text-right">Nilai</th><th class="p-2">Sumber</th><th class="p-2">Diperbarui</th>
            </tr>
          </thead>
          <tbody id="gr-body"></tbody>
        </table>
      </div>
    </div>
  </div>
`);

window.init_guru_rekap = async () => {
  const $ = s => document.querySelector(s);
  const GR = { rows: [] };

  function render() {
    const k = $('#gr-kelas').value;
    const q = $('#gr-cari').value.trim().toLowerCase();
    const rows = GR.rows.filter(r =>
      (!k || r.kelas === k) &&
      (!q || (r.nama + ' ' + r.username + ' ' + r.kode + ' ' + r.judul).toLowerCase().indexOf(q) >= 0)
    );
    $('#gr-info').textContent = rows.length + ' baris nilai';
    $('#gr-body').innerHTML = rows.length
      ? rows.map(r =>
          '<tr class="border-t">'
          + '<td class="p-2"><b>' + r.nama + '</b><span class="block text-[10px] text-gray-500">' + r.username + '</span></td>'
          + '<td class="p-2">' + r.kelas + '</td>'
          + '<td class="p-2">' + r.kode + ' — ' + r.judul + '</td>'
          + '<td class="p-2 capitalize">' + r.jenis + '</td>'
          + '<td class="p-2 text-right font-bold">' + (r.skor == null ? '–' : r.skor) + '/' + r.maks + '</td>'
          + '<td class="p-2">' + r.sumber + '</td>'
          + '<td class="p-2 text-gray-500">' + r.waktu + '</td>'
          + '</tr>').join('')
      : '<tr><td colspan="7" class="p-6 text-center text-gray-500">Belum ada data nilai.</td></tr>';
  }

  async function load() {
    const r = await API.auth('guruGetRekap');
    GR.rows = (r && r.rows) || [];
    const kelas = [...new Set(GR.rows.map(x => x.kelas).filter(Boolean))].sort();
    $('#gr-kelas').innerHTML = '<option value="">Semua Kelas</option>'
      + kelas.map(k => '<option>' + k + '</option>').join('');
    render();
  }

  $('#gr-kelas').onchange = render;
  $('#gr-cari').oninput = render;
  $('#gr-refresh').onclick = () => { API.toast('🔄 Memuat ulang...'); load(); };
  await load();
};
