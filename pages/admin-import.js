/* ============ pages/admin-import.js — import data sekolah (CSV) ============ */
Router.register('admin-import', async () => `
  <div class="page-wrap">
    <div id="ai-head"></div>

    <div class="card" style="margin-bottom:12px">
      <div class="flex flex-wrap gap-2 items-end">
        <div style="flex:1;min-width:220px">
          <label style="font-size:12px;font-weight:700">Jenis data</label>
          <select id="ai-kind" class="w-full border rounded-xl px-3 py-2 text-sm"></select>
        </div>
        <button id="ai-template" type="button" class="btn btn-secondary btn-sm">Unduh Template</button>
        <button id="ai-history" type="button" class="btn btn-secondary btn-sm">Riwayat Import</button>
      </div>
      <div id="ai-kind-info" class="card-sub" style="margin-top:8px"></div>
    </div>

    <div class="card" id="ai-upload-card" style="margin-bottom:12px">
      <div class="card-title">1. Unggah CSV</div>
      <div class="card-sub" style="margin-bottom:8px">UTF-8, maksimal 2 MB / 2.000 baris. Jangan pernah menaruh password di CSV.</div>
      <input id="ai-file" type="file" accept=".csv,text/csv" class="text-sm">
      <div id="ai-file-info" class="card-sub" style="margin-top:8px"></div>
    </div>

    <div id="ai-map-wrap" class="hidden" style="margin-bottom:12px">
      <div class="card">
        <div class="card-title">2. Pemetaan Kolom</div>
        <div class="card-sub" style="margin-bottom:8px">Kolom wajib bertanda *. Pemetaan otomatis bisa dikoreksi.</div>
        <div id="ai-map"></div>
        <div id="ai-preview" style="margin-top:12px;overflow-x:auto"></div>
      </div>
    </div>

    <div id="ai-validate-wrap" class="hidden" style="margin-bottom:12px">
      <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="card-title">3. Validasi &amp; Dry Run</div>
            <div class="card-sub">Validasi di server. Tidak ada data yang ditulis pada langkah ini.</div>
          </div>
          <button id="ai-validate" type="button" class="btn btn-primary btn-sm">Validasi Sekarang</button>
        </div>
        <div id="ai-validate-result" style="margin-top:12px"></div>
      </div>
    </div>

    <div id="ai-commit-wrap" class="hidden" style="margin-bottom:12px">
      <div class="card">
        <div class="card-title">4. Konfirmasi Import</div>
        <div id="ai-commit-summary" class="card-sub" style="margin:8px 0"></div>
        <label class="flex items-start gap-2 text-sm" style="margin-bottom:10px">
          <input id="ai-confirm" type="checkbox" style="margin-top:3px">
          <span>Saya sudah memeriksa hasil validasi dan memahami bahwa data akan disimpan.</span>
        </label>
        <button id="ai-commit" type="button" class="btn btn-primary" disabled>Import Sekarang</button>
      </div>
    </div>

    <div id="ai-result" class="hidden" style="margin-bottom:12px"></div>
    <div id="ai-history-wrap" class="hidden"></div>
  </div>
`);

window.init_admin_import = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const S = window.ImportSchema;

  const state = {
    kind: 'sekolah',
    fileName: '',
    headers: [],
    rows: [],
    mapping: {},
    batchId: null,
    counts: null,
    result: null
  };

  $('#ai-head').innerHTML = UI.pageHeader({
    title: 'Import Data',
    subtitle: 'Unduh template, unggah CSV, validasi, lalu import secara terkontrol. Data uji gunakan fiktif.'
  });

  /* ---------- helper ---------- */
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function callImport(body) {
    return LMS.supabase.functions.invoke('admin-import', { body: body }).then(async r => {
      if (!r.error) return r.data || { ok: false, msg: 'Respons kosong' };
      let msg = r.error.message || 'Gagal memanggil server';
      try {
        const ctx = r.error.context;
        if (ctx && typeof ctx.json === 'function') {
          const j = await ctx.json();
          if (j && j.msg) msg = j.msg;
        }
      } catch (e) { /* biarkan */ }
      return { ok: false, msg: msg };
    }).catch(e => ({ ok: false, msg: e.message || 'Gagal koneksi' }));
  }

  function resetWizard() {
    state.fileName = ''; state.headers = []; state.rows = []; state.mapping = {};
    state.batchId = null; state.counts = null; state.result = null;
    $('#ai-file').value = '';
    $('#ai-file-info').textContent = '';
    $('#ai-map-wrap').classList.add('hidden');
    $('#ai-validate-wrap').classList.add('hidden');
    $('#ai-commit-wrap').classList.add('hidden');
    $('#ai-result').classList.add('hidden');
    $('#ai-validate-result').innerHTML = '';
    $('#ai-confirm').checked = false;
    $('#ai-commit').disabled = true;
  }

  /* ---------- jenis data ---------- */
  const kindSel = $('#ai-kind');
  kindSel.innerHTML = S.list().map(t =>
    `<option value="${esc(t.kind)}">${esc(t.label)}${t.supported ? '' : ' — belum aktif'}</option>`
  ).join('');

  function renderKindInfo() {
    const t = S.get(state.kind);
    if (!t) return;
    $('#ai-kind-info').innerHTML = esc(t.description)
      + (t.supported ? '' : ' <b style="color:#b45309">Jenis ini belum diaktifkan; validasi/commit akan ditolak.</b>')
      + ' <span class="card-sub">Urutan aman: sekolah → tahun → kelas → mapel → guru/siswa → wali/penugasan → keanggotaan → kategori.</span>';
  }

  kindSel.onchange = () => { state.kind = kindSel.value; resetWizard(); renderKindInfo(); };
  renderKindInfo();

  $('#ai-template').onclick = () => {
    const t = S.get(state.kind);
    if (!t) return;
    download('template_' + state.kind + '.csv', S.templateCsv(state.kind));
  };

  /* ---------- upload ---------- */
  $('#ai-file').onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { API.toast('❌ File melebihi 2 MB'); e.target.value = ''; return; }
    if (!window.Papa) { API.toast('❌ Parser CSV belum termuat'); return; }
    state.fileName = file.name;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => String(h || '').trim(),
      complete: res => {
        const rows = (res.data || []).filter(r => Object.keys(r).some(k => String(r[k] || '').trim() !== ''));
        if (res.errors && res.errors.length) {
          const fatal = res.errors.filter(x => x.type === 'Delimiter' || x.type === 'Quotes');
          if (fatal.length) { API.toast('❌ CSV tidak valid: ' + fatal[0].message); return; }
        }
        if (!rows.length) { API.toast('❌ File tidak berisi data'); return; }
        if (rows.length > 2000) { API.toast('❌ Maksimal 2.000 baris'); return; }
        state.headers = res.meta.fields || Object.keys(rows[0]);
        state.rows = rows;
        const am = S.autoMap(state.kind, state.headers);
        state.mapping = am.mapping;
        $('#ai-file-info').textContent = rows.length + ' baris, ' + state.headers.length + ' kolom.';
        renderMapping(am.missing);
        $('#ai-map-wrap').classList.remove('hidden');
        $('#ai-validate-wrap').classList.remove('hidden');
        $('#ai-commit-wrap').classList.add('hidden');
        $('#ai-result').classList.add('hidden');
        $('#ai-validate-result').innerHTML = '';
      },
      error: err => API.toast('❌ ' + err.message)
    });
  };

  function renderMapping(missing) {
    const t = S.get(state.kind);
    const head = '<div style="overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + '<th class="p-2 text-left">Kolom database</th><th class="p-2 text-left">Kolom CSV</th><th class="p-2 text-left">Status</th>'
      + '</tr></thead><tbody>';
    const body = t.fields.map(f => {
      const val = state.mapping[f.key] || '';
      const opts = '<option value="">— tidak dipetakan —</option>'
        + state.headers.map(h => `<option value="${esc(h)}"${h === val ? ' selected' : ''}>${esc(h)}</option>`).join('');
      const ok = !f.required || val;
      return `<tr class="border-t">
        <td class="p-2"><b>${esc(f.key)}</b>${f.required ? ' *' : ''}<div class="card-sub">${esc(f.hint || '')}</div></td>
        <td class="p-2"><select data-map="${esc(f.key)}" class="border rounded-lg px-2 py-1 text-xs">${opts}</select></td>
        <td class="p-2">${ok ? UI.badge('ok', 'success') : UI.badge('wajib', 'danger')}</td>
      </tr>`;
    }).join('');
    $('#ai-map').innerHTML = head + body + '</tbody></table></div>'
      + ((missing && missing.length)
        ? '<div class="card-sub" style="margin-top:8px;color:#b91c1c">Kolom wajib belum terpetakan: ' + esc(missing.join(', ')) + '</div>'
        : '');
    $('#ai-map').querySelectorAll('[data-map]').forEach(sel => {
      sel.onchange = () => { state.mapping[sel.dataset.map] = sel.value; renderPreview(); };
    });
    renderPreview();
  }

  function renderPreview() {
    const t = S.get(state.kind);
    const cols = t.fields.map(f => f.key);
    const rows = state.rows.slice(0, 5).map(r => {
      return '<tr class="border-t">' + cols.map(f => {
        const h = state.mapping[f];
        const v = h ? r[h] : '';
        return '<td class="p-2">' + esc(String(v == null ? '' : v).slice(0, 80)) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    $('#ai-preview').innerHTML = '<div class="card-sub" style="margin-bottom:4px">Pratinjau 5 baris pertama (setelah pemetaan)</div>'
      + '<table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + cols.map(c => '<th class="p-2 text-left">' + esc(c) + '</th>').join('')
      + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- validasi ---------- */
  $('#ai-validate').onclick = async () => {
    const t = S.get(state.kind);
    if (!t) return;
    if (!t.supported) { API.toast('❌ Jenis import ini belum diaktifkan'); return; }
    const missing = t.fields.filter(f => f.required && !state.mapping[f.key]);
    if (missing.length) {
      API.toast('❌ Kolom wajib belum dipetakan: ' + missing.map(f => f.key).join(', '));
      return;
    }
    const btn = $('#ai-validate');
    btn.disabled = true; btn.textContent = 'Memvalidasi...';
    $('#ai-validate-result').innerHTML = UI.skeleton(3);
    try {
      const r = await callImport({
        action: 'validate', kind: state.kind, fileName: state.fileName,
        mapping: state.mapping, rows: state.rows
      });
      if (!r.ok) { $('#ai-validate-result').innerHTML = '<div class="card-sub" style="color:#b91c1c">' + esc(r.msg || 'Gagal') + '</div>'; return; }
      state.batchId = r.batch_id;
      state.counts = r.counts || {};
      renderValidation(r);
    } finally {
      btn.disabled = false; btn.textContent = 'Validasi Sekarang';
    }
  };

  function renderValidation(r) {
    const rows = r.rows || [];
    const inv = rows.filter(x => x.status !== 'valid');
    const c = r.counts || {};
    const summary = UI.statGrid([
      { label: 'Total baris', value: c.total || rows.length },
      { label: 'Valid', value: c.valid || 0, hint: 'dapat diimport' },
      { label: 'Bermasalah', value: c.invalid || 0, hint: 'perbaiki dulu' },
      { label: 'Batch', value: String(r.batch_id || '').slice(0, 8) }
    ]);
    const table = '<div style="margin-top:10px;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + '<th class="p-2 text-left">Baris</th><th class="p-2 text-left">Status</th><th class="p-2 text-left">Aksi</th><th class="p-2 text-left">Catatan</th>'
      + '</tr></thead><tbody>'
      + rows.map(x => `<tr class="border-t">
          <td class="p-2">${esc(x.row_no)}</td>
          <td class="p-2">${UI.badge(x.status, x.status === 'valid' ? 'success' : 'danger')}</td>
          <td class="p-2">${esc(x.action || '-')}</td>
          <td class="p-2">${esc(x.error || '')}</td>
        </tr>`).join('')
      + '</tbody></table></div>';

    $('#ai-validate-result').innerHTML = summary + table
      + (inv.length ? '<div style="margin-top:8px"><button id="ai-dl-errors" type="button" class="btn btn-secondary btn-sm">Unduh Error CSV</button></div>' : '');

    if (inv.length) {
      $('#ai-dl-errors').onclick = () => {
        const lines = ['row_no,status,error'];
        inv.forEach(x => lines.push([x.row_no, x.status, S.csvCell(x.error || '')].join(',')));
        download('error_' + state.kind + '.csv', lines.join('\r\n'));
      };
    }

    const canCommit = (c.invalid || 0) === 0 && rows.length > 0;
    const t = S.get(state.kind);
    $('#ai-commit-wrap').classList.remove('hidden');
    $('#ai-commit').disabled = true;
    $('#ai-commit-summary').innerHTML = canCommit
      ? 'Siap mengimport <b>' + (c.valid || 0) + '</b> baris ke sekolah Anda.'
      : 'Perbaiki baris bermasalah lalu lakukan validasi ulang. Import tidak dapat dijalankan.';
    if (!t.supported) {
      $('#ai-commit-summary').innerHTML = 'Jenis import ini belum diaktifkan.';
      $('#ai-commit').disabled = true;
    }
  }

  $('#ai-confirm').onchange = e => {
    const t = S.get(state.kind);
    $('#ai-commit').disabled = !(e.target.checked && state.batchId && (state.counts || {}).invalid === 0 && t.supported);
  };

  /* ---------- commit ---------- */
  $('#ai-commit').onclick = async () => {
    if (!state.batchId) return;
    if (!$('#ai-confirm').checked) { API.toast('❌ Centang konfirmasi terlebih dahulu'); return; }
    const btn = $('#ai-commit');
    btn.disabled = true; btn.textContent = 'Mengimport...';
    try {
      const r = await callImport({ action: 'commit', batchId: state.batchId });
      state.result = r;
      renderResult(r);
      if (r.ok) API.toast('✅ Import selesai');
      else API.toast('❌ ' + (r.msg || 'Import gagal'));
    } finally {
      btn.textContent = 'Import Sekarang';
      btn.disabled = true;
    }
  };

  function renderResult(r) {
    const box = $('#ai-result');
    box.classList.remove('hidden');
    if (!r.ok) {
      box.innerHTML = '<div class="card"><div class="card-title" style="color:#b91c1c">Import gagal</div>'
        + '<div class="card-sub">' + esc(r.msg || 'Tidak ada detail') + '</div></div>';
      return;
    }
    const creds = r.credentials || [];
    box.innerHTML = '<div class="card">'
      + '<div class="card-title">Hasil Import</div>'
      + UI.statGrid([
        { label: 'Berhasil', value: r.inserted || 0 },
        { label: 'Diperbarui', value: r.updated || 0 },
        { label: 'Dilewati', value: r.skipped || 0 },
        { label: 'Gagal', value: r.failed || 0 }
      ])
      + '<div class="card-sub" style="margin-top:6px">Status batch: <b>' + esc(r.status || 'committed') + '</b></div>'
      + (creds.length
        ? '<div style="margin-top:12px;padding:10px;border:1px solid #f59e0b;border-radius:12px;background:#fffbeb">'
          + '<b>Kredensial sementara — hanya tampil sekali.</b>'
          + '<div class="card-sub">Simpan di tempat aman lalu bagikan satu per satu. Password tidak tersimpan di server/log.</div>'
          + '<div style="margin-top:8px"><button id="ai-dl-creds" type="button" class="btn btn-primary btn-sm">Unduh Kredensial CSV</button></div>'
          + '<div style="margin-top:8px;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
          + '<th class="p-2 text-left">Username</th><th class="p-2 text-left">Email login</th><th class="p-2 text-left">Password sementara</th>'
          + '</tr></thead><tbody>'
          + creds.map(c => '<tr class="border-t"><td class="p-2">' + esc(c.username) + '</td><td class="p-2">' + esc(c.email) + '</td><td class="p-2"><code>' + esc(c.temp_password) + '</code></td></tr>').join('')
          + '</tbody></table></div></div>'
        : '')
      + '</div>';
    if (creds.length) {
      $('#ai-dl-creds').onclick = () => {
        const lines = ['username,email,temp_password,role'];
        creds.forEach(c => lines.push([c.username, c.email, c.temp_password, c.role].map(S.csvCell).join(',')));
        download('kredensial_' + String(state.batchId).slice(0, 8) + '.csv', lines.join('\r\n'));
      };
    }
    loadHistory();
  }

  /* ---------- riwayat ---------- */
  async function loadHistory() {
    const box = $('#ai-history-wrap');
    box.classList.remove('hidden');
    box.innerHTML = '<div class="card">' + UI.skeleton(2) + '</div>';
    const r = await callImport({ action: 'history' });
    if (!r.ok) { box.innerHTML = '<div class="card"><div class="card-sub" style="color:#b91c1c">' + esc(r.msg || 'Gagal memuat riwayat') + '</div></div>'; return; }
    const rows = r.rows || [];
    box.innerHTML = '<div class="card"><div class="card-title">Riwayat Import</div>'
      + (rows.length
        ? '<div style="overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
          + '<th class="p-2 text-left">Waktu</th><th class="p-2 text-left">Jenis</th><th class="p-2 text-left">File</th>'
          + '<th class="p-2 text-left">Status</th><th class="p-2 text-left">Jumlah</th><th class="p-2"></th>'
          + '</tr></thead><tbody>'
          + rows.map(b => {
              const c = b.counts || {};
              const detail = (b.status === 'validated' || b.status === 'draft')
                ? `${c.total || 0} baris · ${c.valid || 0} valid · ${c.invalid || 0} invalid`
                : `+${c.inserted || 0} / ~${c.updated || 0} / -${c.skipped || 0} / !${c.failed || 0}`;
              return `<tr class="border-t">
                <td class="p-2">${esc((b.created_at || '').replace('T', ' ').slice(0, 16))}</td>
                <td class="p-2">${esc(b.kind)}</td>
                <td class="p-2">${esc(b.file_name || '-')}</td>
                <td class="p-2">${UI.badge(b.status, b.status === 'committed' ? 'success' : b.status === 'failed' ? 'danger' : 'warning')}</td>
                <td class="p-2">${esc(detail)}</td>
                <td class="p-2 text-right"><button class="btn btn-secondary btn-sm" data-detail="${esc(b.id)}">Detail</button></td>
              </tr>`;
            }).join('')
          + '</tbody></table></div>'
        : UI.empty('Belum ada import', 'Riwayat batch akan muncul setelah validasi/commit.'))
      + '<div id="ai-history-detail" style="margin-top:12px"></div></div>';
    box.querySelectorAll('[data-detail]').forEach(btn => {
      btn.onclick = () => showBatch(btn.dataset.detail);
    });
  }

  async function showBatch(id) {
    const el = $('#ai-history-detail');
    el.innerHTML = UI.skeleton(2);
    const r = await callImport({ action: 'batch', batchId: id });
    if (!r.ok) { el.innerHTML = '<div class="card-sub" style="color:#b91c1c">' + esc(r.msg || 'Gagal') + '</div>'; return; }
    const rows = r.rows || [];
    el.innerHTML = '<div class="card-sub">Batch ' + esc(String(id).slice(0, 8)) + ' • ' + esc((r.batch && r.batch.status) || '') + '</div>'
      + '<div style="overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
      + '<th class="p-2 text-left">Baris</th><th class="p-2 text-left">Status</th><th class="p-2 text-left">Aksi</th><th class="p-2 text-left">Error</th>'
      + '</tr></thead><tbody>'
      + rows.map(x => `<tr class="border-t"><td class="p-2">${esc(x.row_no)}</td><td class="p-2">${esc(x.status)}</td>`
        + `<td class="p-2">${esc(x.action || '-')}</td><td class="p-2">${esc(x.error || '')}</td></tr>`).join('')
      + '</tbody></table></div>';
  }

  $('#ai-history').onclick = loadHistory;

  await loadHistory();
};
