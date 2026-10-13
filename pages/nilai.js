/* ============ pages/nilai.js — LKPD & Nilai Saya ============ */
Router.register('siswa-nilai', async () => {
  const m = API.getMeta();
  return `
    <div class="max-w-2xl mx-auto space-y-4">
      <button onclick="Router.go('siswa-dash')" class="text-sky-600 text-sm font-bold">← Kembali</button>
      <div class="bg-teal-50 border border-teal-200 rounded-xl p-3 text-base font-bold text-teal-900">
        ${m.nama} • ${m.kelas} • Kategori ${m.kategori}
      </div>
      <div class="bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <select id="nl-sem" class="border rounded-xl px-3 py-2 text-sm"></select>
          <div class="flex-1"></div>
          <button id="nl-refresh" class="text-sky-600 text-xl" title="Muat ulang">🔄</button>
        </div>

        <div class="border rounded-xl">
          <button id="nl-graph-toggle" class="w-full flex justify-between px-3 py-2 text-sm font-bold text-gray-700">
            📈 Progres Nilai (LKPD & Kuis)<span id="nl-chev">▸ tampilkan</span>
          </button>
          <div id="nl-graph-body" class="hidden px-3 pb-3">
            <div class="text-xs text-gray-500 mb-1">Rata-rata: <span id="nl-avg"></span></div>
            <div id="nl-legend" class="text-[10px] text-gray-600 mb-2"></div>
            <div id="nl-graph" class="flex items-end gap-2 overflow-x-auto" style="height:150px"></div>
          </div>
        </div>

        <div id="nl-cards" class="space-y-3"></div>

        <div class="flex items-center justify-between text-sm">
          <button id="nl-prev" class="px-3 py-1.5 border rounded-lg">←</button>
          <span id="nl-page" class="text-xs text-gray-500"></span>
          <button id="nl-next" class="px-3 py-1.5 border rounded-lg">→</button>
        </div>
      </div>
    </div>
    <div id="nl-modal-root"></div>
  `;
});

window.init_siswa_nilai = async () => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const NL = {
    rows: [],
    page: 1,
    size: 5,
    sem: '',
    graphOpen: localStorage.getItem('NL_GRAPH') === '1'
  };

  const okVal = v => !isNaN(Number(v)) && v !== 'X' && v !== '?' && v !== '';
  const chip = v => v === 'X' ? '<span class="text-rose-600 font-extrabold">X</span>'
                  : v === '?' ? '<span class="text-amber-600 font-extrabold">?</span>'
                  : '<span class="text-green-700 font-extrabold">' + v + '</span>';

  const filtered = () => NL.rows.filter(x => !NL.sem || x.semester === NL.sem);

  async function load() {
    const r = await API.auth('siswaGetNilai');
    NL.rows = r.rows;
    const sems = [...new Set(NL.rows.map(x => x.semester).filter(Boolean))];
    $('#nl-sem').innerHTML = '<option value="">Semua Semester</option>'
      + sems.map(s => '<option>' + s + '</option>').join('');
    render();
  }

  function card(x) {
    const det = (j, ada) => ada
      ? '<button class="nl-det text-sky-600 text-sm font-bold" data-kode="'+x.kode+'" data-jenis="'+j+'">🔍</button>'
      : '<span class="text-gray-300 text-sm">🔍</span>';
    const icon = x.lengkap
      ? '<span class="nl-info cursor-pointer text-green-700 font-bold text-xs bg-green-50 border border-green-200 rounded-full px-2 py-1" data-kode="'+x.kode+'">✅ LENGKAP</span>'
      : '<span class="nl-info cursor-pointer text-amber-700 font-bold text-xs bg-amber-50 border border-amber-200 rounded-full px-2 py-1" data-kode="'+x.kode+'">⏳ '+x.lengkapCnt+'/7</span>';
    let btn = '';
    if (x.locked) btn = '<p class="text-sm text-gray-400 mt-2">🔒 Dikunci'+(x.nilaiLkpd!=='X'?' — nilai tersimpan':'')+'</p>';
    else if (x.status === 'Tidak Aktif' || x.status === 'Exambro')
      btn = '<button class="nl-buka w-full mt-2 bg-slate-700 text-white text-sm font-bold py-2 rounded-xl" data-kode="'+x.kode+'">🔑 Via Login Ujian</button>';
    else if (x.target)
      btn = '<button class="nl-buka w-full mt-2 bg-sky-600 text-white text-sm font-bold py-2 rounded-xl" data-kode="'+x.kode+'">'
          + (x.readOnly ? '🔗 Buka (mode baca)' : (x.nilaiLkpd === 'X' ? '🔗 Kerjakan Sekarang' : '🔗 Buka LKPD'))
          + '</button>';
    return '<div class="border rounded-xl p-4 text-base">'
      + '<div class="flex items-start justify-between gap-2"><div>'
      + '<p class="font-extrabold text-gray-800">'+x.kode+' — '+x.nama+'</p>'
      + '<p class="text-xs text-gray-500">['+x.status+']'+(x.semester?' • '+x.semester+' '+x.ta:'')+' • '+x.materi+'</p>'
      + '</div>'+icon+'</div>'
      + '<div class="mt-2">Nilai LKPD: '+chip(x.nilaiLkpd)+' '+det('L',x.jawabanL)+' • Nilai Kuis: '+chip(x.nilaiKuis)+' '+det('K',x.jawabanK)+'</div>'
      + '<div class="mt-1 text-xs text-gray-600">Performa: <button class="nl-info text-sky-600 font-bold" data-kode="'+x.kode+'">ℹ️ '+[x.performa.diri,x.performa.lkpd,x.performa.sikap,x.performa.pen,x.performa.ket].filter(Boolean).length+'/5</button></div>'
      + btn + '</div>';
  }

  function renderGraph(rows) {
    const aL = rows.filter(x => okVal(x.nilaiLkpd)).map(x => Number(x.nilaiLkpd));
    const aK = rows.filter(x => okVal(x.nilaiKuis)).map(x => Number(x.nilaiKuis));
    const avg = a => a.length ? Math.round(a.reduce((s,b) => s+b, 0) / a.length) : '-';
    $('#nl-avg').innerHTML = 'LKPD <b>'+avg(aL)+'</b> • Kuis <b>'+avg(aK)+'</b>';
    $('#nl-legend').innerHTML = '<span class="inline-flex items-center gap-1 mr-3"><span style="width:10px;height:10px;background:#0d9488;display:inline-block;border-radius:2px"></span>LKPD</span>'
      + '<span class="inline-flex items-center gap-1"><span style="width:10px;height:10px;background:#4f46e5;display:inline-block;border-radius:2px"></span>Kuis</span>';
    $('#nl-graph').innerHTML = rows.map(x => {
      const bar = (v, c) => {
        const g = okVal(v), val = Number(v), h = g ? Math.max(6, val) : 6;
        return '<div class="flex flex-col items-center justify-end gap-1" style="width:34%;height:100%">'
          + '<span class="text-[9px] font-bold '+(g?'text-gray-700':'text-gray-400')+'">'+(g?val:v)+'</span>'
          + '<div style="width:100%;height:'+h+'%;background:'+(g?c:'#e5e7eb')+';border-radius:4px 4px 0 0"></div></div>';
      };
      return '<div class="flex flex-col items-center gap-1" style="height:100%;min-width:56px;flex:1">'
        + '<div class="flex items-end gap-1 w-full" style="height:100%">'
        + bar(x.nilaiLkpd,'#0d9488') + bar(x.nilaiKuis,'#4f46e5')
        + '</div><span class="text-[9px] text-gray-500">'+x.kode.replace('MTK-','')+'</span></div>';
    }).join('');
  }

  function render() {
    const all = filtered();
    const pages = Math.max(1, Math.ceil(all.length / NL.size));
    NL.page = Math.min(NL.page, pages);
    const rows = all.slice((NL.page - 1) * NL.size, NL.page * NL.size);
    $('#nl-page').textContent = 'Hal ' + NL.page + '/' + pages + ' (' + all.length + ' LKPD)';
    $('#nl-cards').innerHTML = rows.length ? rows.map(card).join('') : '<p class="text-sm text-gray-500 text-center py-6">Belum ada LKPD.</p>';
    $$('.nl-det').forEach(b => b.onclick = () => openDetail(b.dataset.kode, b.dataset.jenis));
    $$('.nl-info').forEach(b => b.onclick = () => openPerf(b.dataset.kode));
    $$('.nl-buka').forEach(b => b.onclick = () => buka(all.find(x => x.kode === b.dataset.kode)));
    renderGraph(all);
  }

  function buka(x) {
    if (!x) return;
    if (x.status === 'Tidak Aktif' || x.status === 'Exambro') {
          window.open(new URL('LKPD/LoginDirect.html', location.href).href, '_blank');
      return;
    }
    /* buka dengan token sesi di URL */
    window.open(x.target + '?s=' + API.sess(), '_blank');
  }

  function parseDetail(str) {
    const s = String(str || '').trim();
    if (!s || s === '-') return { rows: [], raw: s };
    if (s.indexOf(';;') >= 0 && s.indexOf('kunci:') >= 0) {
      return { rows: s.split(';;').map(seg => {
        const p = seg.split('|').map(x => x.trim());
        let l = '', j = '', k = '', st = '';
        p.forEach(x => {
          if (x.indexOf('kunci:') === 0) k = x.substring(6);
          else if (x === '✅' || x === '❌') st = x;
          else { const m = x.match(/^([^:]+):\s*(.*)$/); if (m) { l = m[1]; j = m[2]; } }
        });
        return { label: l, jawaban: j, kunci: k, status: st };
      }), raw: s };
    }
    if (/No\.\d+/.test(s) && s.indexOf('Jawab:') >= 0) {
      return { rows: s.split('|').map(p => p.trim()).filter(Boolean).map(p => {
        const m = p.match(/^(No\.\d+):\s*(✅|❌)\s*\(Jawab:\s*([^,]*),\s*Kunci:\s*([^)]*)\)/);
        return m ? { label: m[1], jawaban: m[3], kunci: m[4], status: m[2] } : { label: p, jawaban: '', kunci: '', status: '' };
      }), raw: s };
    }
    if (/^Q\d+:/.test(s) && s.indexOf('kunci:') < 0) {
      return { rows: s.split('|').map(p => p.trim()).filter(Boolean).map(p => {
        const m = p.match(/^(Q\d+):\s*(.*)$/);
        return m ? { label: m[1], jawaban: m[2], kunci: '', status: '' } : { label: p, jawaban: '', kunci: '', status: '' };
      }), raw: s };
    }
    if (s.indexOf(':') >= 0) {
      return { rows: s.split('|').map(p => p.trim()).filter(Boolean).map(p => {
        const m = p.match(/^([^:]+):\s*(.*)$/);
        return m ? { label: m[1], jawaban: m[2], kunci: '', status: '' } : { label: p, jawaban: '', kunci: '', status: '' };
      }), raw: s };
    }
    return { rows: [], raw: s };
  }

  function openDetail(kode, jenis) {
    const x = NL.rows.find(r => r.kode === kode);
    if (!x) return;
    const str = jenis === 'L' ? x.jawabanL : x.jawabanK;
    const d = parseDetail(str);
    const hk = d.rows.some(r => r.kunci);
    $('#nl-modal-root').innerHTML = '<div class="modal-bg"><div class="bg-white rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto">'
      + '<h3 class="font-bold mb-1">🔍 Detail ' + (jenis === 'L' ? 'Jawaban LKPD' : 'Jawaban Kuis') + ' — ' + kode + '</h3>'
      + '<p class="text-xs text-gray-500 mb-2">Skor: <b>' + (jenis === 'L' ? x.nilaiLkpd : x.nilaiKuis) + '</b> • ' + (jenis === 'L' ? x.waktuL : x.waktuK) + '</p>'
      + (d.rows.length
          ? '<table class="w-full text-xs"><thead><tr class="bg-gray-100"><th class="p-2 text-left">Soal</th><th class="p-2 text-left">Jawaban</th>'
            + (hk ? '<th class="p-2 text-left">Kunci</th>' : '') + '<th></th></tr></thead><tbody>'
            + d.rows.map(r => '<tr class="border-t"><td class="p-2 font-bold">' + r.label + '</td><td class="p-2">' + (r.jawaban || '-') + '</td>'
            + (hk ? '<td class="p-2">' + (r.kunci || '-') + '</td>' : '') + '<td class="p-1">' + (r.status || '') + '</td></tr>').join('')
            + '</tbody></table>'
          : '<p class="text-xs text-gray-500">Format tidak dikenali.</p>')
      + '<div id="dd-raw" class="hidden"><pre class="text-[10px] bg-gray-50 border rounded p-2 whitespace-pre-wrap break-all">'
        + String(str || '-').replace(/</g, '&lt;') + '</pre></div>'
      + '<div class="flex gap-2 mt-3"><button id="dd-t" class="flex-1 bg-gray-200 font-bold py-2 rounded-xl text-xs">Teks Mentah</button>'
      + '<button id="dd-c" class="flex-1 text-gray-500 py-2 text-xs">Tutup</button></div></div></div>';
    $('#dd-c').onclick = () => $('#nl-modal-root').innerHTML = '';
    $('#dd-t').onclick = () => $('#dd-raw').classList.toggle('hidden');
  }

  function openPerf(kode) {
    const x = NL.rows.find(r => r.kode === kode);
    if (!x) return;
    const p = x.performa;
    const SC = ['Kurang', 'Cukup', 'Baik', 'Sangat Baik'];
    const row = (l, v, o) => '<tr class="border-t"><td class="p-2 text-xs">' + l + '</td><td class="p-2 text-xs font-bold ' + (v ? 'text-green-700' : 'text-gray-400') + '">' + (v || '–') + '</td><td class="p-2 text-[10px] text-gray-500">' + o + '</td></tr>';
    const form = (x.nilaiLkpd !== 'X' && !p.diri)
      ? '<div class="mt-3 space-y-2">'
        + '<select id="pp-d" class="w-full border rounded-xl px-3 py-2 text-sm">' + SC.map(s => '<option>' + s + '</option>').join('') + '</select>'
        + '<select id="pp-l" class="w-full border rounded-xl px-3 py-2 text-sm">' + SC.map(s => '<option>' + s + '</option>').join('') + '</select>'
        + '<button id="pp-s" class="w-full bg-violet-600 text-white font-bold py-2 rounded-xl text-sm">💾 Simpan Performa</button></div>'
      : (x.nilaiLkpd === 'X' ? '<p class="text-xs text-gray-500 mt-2">Kirim LKPD dulu untuk menilai performa.</p>' : '');
    $('#nl-modal-root').innerHTML = '<div class="modal-bg"><div class="bg-white rounded-2xl p-5 w-full max-w-sm">'
      + '<h3 class="font-bold mb-2">ℹ️ Performa — ' + kode + '</h3>'
      + '<table class="w-full"><tbody>' + row('Performa Diri', p.diri, 'Siswa') + row('Performa LKPD', p.lkpd, 'Siswa')
      + row('Sikap', p.sikap, 'Guru') + row('Pengetahuan', p.pen, 'Guru') + row('Keterampilan', p.ket, 'Guru') + '</tbody></table>'
      + form
      + '<button id="pp-c" class="w-full mt-3 text-gray-500 text-sm py-2">Tutup</button></div></div>';
    $('#pp-c').onclick = () => $('#nl-modal-root').innerHTML = '';
    const sv = document.getElementById('pp-s');
    if (sv) sv.onclick = async () => {
      const r = await API.auth('siswaSavePerforma', {
        kode: kode,
        diri: $('#pp-d').value,
        lkpd: $('#pp-l').value
      });
      if (r.ok) { API.toast('✅ Tersimpan.'); $('#nl-modal-root').innerHTML = ''; load(); }
      else API.toast('❌ ' + r.msg);
    };
  }

  $('#nl-sem').onchange = () => { NL.sem = $('#nl-sem').value; NL.page = 1; render(); };
  $('#nl-prev').onclick = () => { NL.page = Math.max(1, NL.page - 1); render(); };
  $('#nl-next').onclick = () => { NL.page++; render(); };
  $('#nl-refresh').onclick = () => { API.toast('🔄 Memuat ulang...'); load(); };
  $('#nl-graph-toggle').onclick = () => {
    NL.graphOpen = !NL.graphOpen;
    localStorage.setItem('NL_GRAPH', NL.graphOpen ? '1' : '0');
    $('#nl-graph-body').classList.toggle('hidden', !NL.graphOpen);
    $('#nl-chev').textContent = NL.graphOpen ? '▾ sembunyikan' : '▸ tampilkan';
    if (NL.graphOpen) renderGraph(filtered());
  };
  if (NL.graphOpen) {
    $('#nl-graph-body').classList.remove('hidden');
    $('#nl-chev').textContent = '▾ sembunyikan';
  }
  await load();
  if (NL.graphOpen) renderGraph(filtered());
};