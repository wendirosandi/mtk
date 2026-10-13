/* ============ pages/profil-siswa.js ============ */
Router.register('siswa-profil', async () => {
  const m = API.getMeta();
  const prefix = String(m.kelas || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-';
  return `
    <div class="max-w-md mx-auto">
      <button onclick="Router.go('siswa-dash')" class="text-sky-600 text-sm font-bold">← Kembali</button>
      <div class="bg-white rounded-2xl shadow-xl p-5 mt-3 space-y-3">
        <h3 class="font-bold text-lg text-gray-800">👤 Profil Saya</h3>
        <div class="text-xs bg-slate-50 border rounded-xl p-3 space-y-1">
          <div>Username: <b>${m.username}</b></div>
          <div>Nama Lengkap: <b>${m.nama}</b></div>
          <div>Kelas: <b>${m.kelas}</b></div>
          <div>Kategori: <b>${m.kategori}</b></div>
        </div>

        <div class="border rounded-xl">
          <button id="acc-pwd-head" class="w-full flex justify-between px-3 py-2.5 font-bold text-sm">🔒 Ganti Password <span id="acc-pwd-chev">▸</span></button>
          <div id="acc-pwd-body" class="hidden px-3 pb-3 space-y-2">
            <input id="pf-old" type="password" placeholder="Password lama" class="w-full border rounded-lg px-3 py-2 text-sm">
            <input id="pf-new" type="password" placeholder="Password baru" class="w-full border rounded-lg px-3 py-2 text-sm">
            <input id="pf-new2" type="password" placeholder="Konfirmasi password baru" class="w-full border rounded-lg px-3 py-2 text-sm">
            <button id="pf-pwd-save" class="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-sm">Simpan</button>
          </div>
        </div>

        <div class="border rounded-xl">
          <button id="acc-kat-head" class="w-full flex justify-between px-3 py-2.5 font-bold text-sm">🔄 Ubah Kategori <span id="acc-kat-chev">▸</span></button>
          <div id="acc-kat-body" class="hidden px-3 pb-3 space-y-2">
            <p class="text-xs text-gray-500">Kategori saat ini: <b>${m.kategori}</b></p>
            <select id="pf-kat-sel" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option ${m.kategori==='A'?'selected':''}>A</option>
              <option ${m.kategori==='B'?'selected':''}>B</option>
              <option ${m.kategori==='C'?'selected':''}>C</option>
            </select>
            <textarea id="pf-kat-alasan" rows="2" placeholder="Alasan (opsional)" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
            <button id="pf-kat-send" class="w-full bg-green-600 text-white font-bold py-2 rounded-lg text-sm">Kirim Permintaan</button>
          </div>
        </div>

        <div class="border rounded-xl">
          <button id="acc-user-head" class="w-full flex justify-between px-3 py-2.5 font-bold text-sm">🔑 Ganti Username <span id="acc-user-chev">▸</span></button>
          <div id="acc-user-body" class="hidden px-3 pb-3 space-y-2">
            <p class="text-xs text-gray-500">Username baru: <b>${prefix}</b><input id="pf-user-slug" class="border rounded-lg px-2 py-1 text-sm" placeholder="nama panggilan"></p>
            <textarea id="pf-user-alasan" rows="2" placeholder="Alasan (opsional)" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
            <button id="pf-user-send" class="w-full bg-violet-600 text-white font-bold py-2 rounded-lg text-sm">Kirim Permintaan</button>
          </div>
        </div>
      </div>
    </div>
  `;
});

window.init_siswa_profil = async () => {
  const $ = s => document.querySelector(s);
  function pfOpen(acc) {
    ['pwd', 'kat', 'user'].forEach(a => {
      const open = (a === acc);
      $('#acc-' + a + '-body').classList.toggle('hidden', !open);
      $('#acc-' + a + '-chev').textContent = open ? '▾' : '▸';
    });
  }

  $('#acc-pwd-head').onclick = () => pfOpen('pwd');
  $('#acc-kat-head').onclick = () => pfOpen('kat');
  $('#acc-user-head').onclick = () => pfOpen('user');

  $('#pf-pwd-save').onclick = async () => {
    const o = $('#pf-old').value, n = $('#pf-new').value, n2 = $('#pf-new2').value;
    if (!o || !n) return API.toast('Isi password lama & baru.');
    if (n !== n2) return API.toast('Konfirmasi tidak sama.');
        const r = await API.auth('siswaGantiPassword', { oldP: o, newP: n });
    if (r.ok) { API.toast('✅ Password diganti.'); pfOpen(null); }
    else API.toast('❌ ' + r.msg);
  };

  $('#pf-kat-send').onclick = async () => {
    const r = await API.auth('siswaRequestAkun', {
      jenis: 'Kategori',
      nilaiBaru: $('#pf-kat-sel').value,
      alasan: $('#pf-kat-alasan').value
    });
    if (r.ok) API.toast('✅ Permintaan kategori terkirim');
    else API.toast('❌ ' + r.msg);
  };

  $('#pf-user-send').onclick = async () => {
    const r = await API.auth('siswaRequestAkun', {
      jenis: 'Username',
      panggilan: $('#pf-user-slug').value,
      alasan: $('#pf-user-alasan').value
    });
    if (r.ok) API.toast('✅ Username baru → ' + r.nilaiBaru);
    else API.toast('❌ ' + r.msg);
  };
};