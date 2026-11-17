/* ============ pages/guru-bank.js — bank soal, pool, kisi-kisi ============ */
Router.register('guru-bank', async () => `
  <div class="page-wrap">
    <div id="gb-head"></div>
    <div class="flex flex-wrap gap-2" style="margin-bottom:12px">
      <button id="gb-tab-bank" type="button" class="btn btn-primary btn-sm">Bank Soal</button>
      <button id="gb-tab-pool" type="button" class="btn btn-secondary btn-sm">Pool</button>
      <button id="gb-tab-kisi" type="button" class="btn btn-secondary btn-sm">Kisi-kisi</button>
      <div class="flex-1"></div>
      <button id="gb-add" type="button" class="btn btn-primary btn-sm">+ Tambah</button>
    </div>
    <div id="gb-body">${UI.skeleton(5)}</div>
  </div>
`);

window.init_guru_bank = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { data: null, tab: 'bank', assessmentId: null };

  const KINDS = [
    { value: 'num', label: 'Numerik' }, { value: 'mc', label: 'Pilihan ganda' },
    { value: 'bs', label: 'Benar/Salah' }, { value: 'match', label: 'Menjodohkan' },
    { value: 'scaffold', label: 'Bertahap' }, { value: 'text', label: 'Uraian' }
  ];
  const DIFF = [{ value: '', label: '-' }, { value: 'A', label: 'A (sulit)' }, { value: 'B', label: 'B (sedang)' }, { value: 'C', label: 'C (mudah)' }];

  $('#gb-head').innerHTML = UI.pageHeader({
    title: 'Bank Soal',
    subtitle: 'Kelola pool soal, bank item, dan kisi-kisi untuk menyusun paket asesmen.'
  });

  function modal(cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = '<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto">'
      + '<h3 style="font-weight:800;font-size:18px;margin-bottom:12px">' + esc(cfg.title) + '</h3>'
      + '<form id="gb-form" class="space-y-3">'
      + cfg.fields.map(f => {
          const label = '<label style="font-size:12px;font-weight:700">' + esc(f.label) + (f.required ? ' *' : '') + '</label>';
          if (f.type === 'textarea') return '<div>' + label + '<textarea name="' + esc(f.name) + '" rows="3" class="w-full border rounded-xl px-3 py-2 text-sm">' + esc(f.value || '') + '</textarea></div>';
          if (f.type === 'select') return '<div>' + label + '<select name="' + esc(f.name) + '" class="w-full border rounded-xl px-3 py-2 text-sm">'
            + (f.options || []).map(o => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(f.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('')
            + '</select></div>';
          return '<div>' + label + '<input name="' + esc(f.name) + '" type="' + esc(f.type || 'text') + '" value="' + esc(f.value || '') + '" class="w-full border rounded-xl px-3 py-2 text-sm"></div>';
        }).join('')
      + (cfg.extra || '')
      + '<div class="flex gap-2" style="margin-top:16px"><button type="submit" class="btn btn-primary flex-1">Simpan</button>'
      + '<button type="button" data-cancel class="btn btn-secondary">Batal</button></div></form></div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-cancel]').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
    wrap.querySelector('#gb-form').onsubmit = async e => {
      e.preventDefault();
      const f = wrap.querySelector('#gb-form');
      const v = {};
      cfg.fields.forEach(x => { v[x.name] = f.querySelector('[name="' + x.name + '"]').value.trim(); });
      if (cfg.collect) cfg.collect(v, f);
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      const r = await cfg.onSubmit(v);
      if (r && r.ok) { close(); API.toast('✅ Tersimpan'); await load(); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); btn.disabled = false; btn.textContent = 'Simpan'; }
    };
    return wrap;
  }

  function extraHtml(kind, p) {
    p = p || {};
    if (kind === 'num') return `<div class="grid grid-cols-2 gap-2"><div><label style="font-size:12px;font-weight:700">Kunci</label>
      <input name="answer" type="number" step="any" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(p.answer != null ? p.answer : '')}"></div>
      <div><label style="font-size:12px;font-weight:700">Toleransi</label>
      <input name="tol" type="number" step="any" min="0" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(p.tol != null ? p.tol : 0)}"></div></div>`;
    if (kind === 'mc' || kind === 'bs') return `<div><label style="font-size:12px;font-weight:700">Pilihan (pisah |)</label>
      <input name="options" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc((p.options || []).join(' | '))}"></div>
      <div><label style="font-size:12px;font-weight:700">Kunci</label>
      <input name="key" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(p.key || '')}"></div>`;
    if (kind === 'match') return `<div><label style="font-size:12px;font-weight:700">Kunci berurutan (pisah koma)</label>
      <input name="keys" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc((p.keys || []).join(', '))}"></div>`;
    if (kind === 'scaffold') return `<div><label style="font-size:12px;font-weight:700">Jawaban berurutan (angka, pisah koma)</label>
      <input name="answers" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc((p.answers || []).join(', '))}"></div>`;
    return '<p class="card-sub">Soal uraian dinilai manual.</p>';
  }

  function subjectOptions() {
    return (state.data.subjects || []).map(s => ({ value: s.id, label: s.name + ' (' + s.code + ')' }));
  }
  function poolOptions(extraAll) {
    const arr = (state.data.pools || []).map(p => ({ value: p.id, label: p.title }));
    return extraAll ? [{ value: '', label: 'Tanpa pool' }].concat(arr) : arr;
  }
  function assessOptions() {
    return (state.data.assessments || []).map(a => ({ value: a.id, label: a.code + ' — ' + a.title + (a.frozen ? ' (frozen)' : '') }));
  }

  function renderBank() {
    const subject = $('#gb-subject') ? $('#gb-subject').value : '';
    const pool = $('#gb-pool') ? $('#gb-pool').value : '';
    const rows = (state.data.items || []).filter(x => (!subject || x.subject_id === subject) && (!pool || x.pool_id === pool));
    const poolName = {};
    (state.data.pools || []).forEach(p => { poolName[p.id] = p.title; });
    return `<div class="card" style="margin-bottom:12px"><div class="flex flex-wrap gap-2">
        <select id="gb-subject" class="border rounded-xl px-3 py-2 text-sm">
          <option value="">Semua mapel</option>${subjectOptions().map(o => `<option value="${esc(o.value)}"${o.value === subject ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>
        <select id="gb-pool" class="border rounded-xl px-3 py-2 text-sm">
          <option value="">Semua pool</option>${(state.data.pools || []).map(p => `<option value="${esc(p.id)}"${p.id === pool ? ' selected' : ''}>${esc(p.title)}</option>`).join('')}
        </select>
        <span class="card-sub" style="align-self:center">${rows.length} soal</span>
      </div></div>`
      + (rows.length ? '<div class="space-y-2">' + rows.map(it => `<div class="card">
          <div class="flex items-start justify-between gap-3">
            <div><div style="font-weight:700;font-size:14px">${esc((it.payload || {}).prompt || '(tanpa teks)')}</div>
              <div class="card-sub">${esc(it.kind)}${it.difficulty ? ' · ' + esc(it.difficulty) : ''}${it.pool_id ? ' · ' + esc(poolName[it.pool_id] || '') : ''}${it.indicator ? ' · ' + esc(it.indicator) : ''}</div>
            </div>${UI.badge(it.status, it.status === 'active' ? 'success' : it.status === 'draft' ? 'warning' : '')}
          </div>
          <div class="flex gap-1" style="margin-top:8px">
            <button class="btn btn-secondary btn-sm" data-edit-item="${esc(it.id)}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del-item="${esc(it.id)}">Hapus</button>
          </div></div>`).join('') + '</div>'
        : UI.empty('Belum ada soal', 'Tambahkan soal ke bank.'));
  }

  function renderPool() {
    const rows = state.data.pools || [];
    const counts = {};
    (state.data.items || []).forEach(i => { if (i.pool_id) counts[i.pool_id] = (counts[i.pool_id] || 0) + 1; });
    return rows.length ? '<div class="space-y-2">' + rows.map(p => `<div class="card">
        <div class="flex items-start justify-between gap-3">
          <div><div class="card-title">${esc(p.title)}</div><div class="card-sub">${esc(p.description || '')}</div>
            <div class="card-sub">${esc(counts[p.id] || 0)} soal</div></div>
          <div class="flex gap-1"><button class="btn btn-secondary btn-sm" data-edit-pool="${esc(p.id)}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del-pool="${esc(p.id)}">Hapus</button></div>
        </div></div>`).join('') + '</div>'
      : UI.empty('Belum ada pool', 'Pool membantu mengelompokkan soal.');
  }

  function renderKisi() {
    if (!state.assessmentId && (state.data.assessments || []).length) state.assessmentId = state.data.assessments[0].id;
    const a = (state.data.assessments || []).find(x => x.id === state.assessmentId);
    const rows = (state.data.kisi || []).filter(k => k.assessment_id === state.assessmentId);
    const poolName = {};
    (state.data.pools || []).forEach(p => { poolName[p.id] = p.title; });
    return `<div class="card" style="margin-bottom:12px"><div class="flex flex-wrap gap-2 items-center">
        <select id="gb-assess" class="border rounded-xl px-3 py-2 text-sm">
          ${(state.data.assessments || []).map(x => `<option value="${esc(x.id)}"${x.id === state.assessmentId ? ' selected' : ''}>${esc(x.code)} — ${esc(x.title)}</option>`).join('')}
        </select>
        <button id="gb-build" type="button" class="btn btn-primary btn-sm"${a && a.frozen ? ' disabled' : ''}>Susun Paket</button>
        <span class="card-sub">${a ? esc(a.questionCount) + ' soal saat ini' + (a.frozen ? ' · paket beku' : '') : ''}</span>
      </div></div>`
      + (rows.length ? '<div class="card" style="padding:0;overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100">'
        + '<th class="p-2 text-left">Indikator</th><th class="p-2 text-left">Kesulitan</th><th class="p-2 text-left">Jenis</th>'
        + '<th class="p-2 text-left">Pool</th><th class="p-2">Jumlah</th><th class="p-2">Bobot</th><th class="p-2"></th></tr></thead><tbody>'
        + rows.map(k => `<tr class="border-t"><td class="p-2">${esc(k.indicator || '-')}</td><td class="p-2">${esc(k.difficulty || '-')}</td>
            <td class="p-2">${esc(k.kind || '-')}</td><td class="p-2">${esc(poolName[k.pool_id] || '-')}</td>
            <td class="p-2 text-center">${esc(k.count)}</td><td class="p-2 text-center">${esc(k.weight)}</td>
            <td class="p-2 text-right"><button class="btn btn-danger btn-sm" data-del-kisi="${esc(k.id)}">Hapus</button></td></tr>`).join('')
        + '</tbody></table></div>'
        : UI.empty('Belum ada kisi-kisi', 'Tambahkan baris kisi-kisi untuk menyusun paket.'));
  }

  function render() {
    const body = $('#gb-body');
    if (state.tab === 'bank') { body.innerHTML = renderBank(); bindBank(); }
    else if (state.tab === 'pool') { body.innerHTML = renderPool(); bindPool(); }
    else { body.innerHTML = renderKisi(); bindKisi(); }
  }

  function bindBank() {
    const sub = $('#gb-subject'); if (sub) sub.onchange = render;
    const pool = $('#gb-pool'); if (pool) pool.onchange = render;
    document.querySelectorAll('[data-edit-item]').forEach(b => b.onclick = () => {
      const it = state.data.items.find(x => x.id === b.dataset.editItem); if (it) itemForm(it);
    });
    document.querySelectorAll('[data-del-item]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus soal dari bank?')) return;
      const r = await API.auth('guruBankItemDelete', { id: b.dataset.delItem });
      if (r && r.ok) { API.toast('✅ Dihapus'); await load(); } else API.toast('❌ Gagal');
    });
  }

  function bindPool() {
    document.querySelectorAll('[data-edit-pool]').forEach(b => b.onclick = () => {
      const p = state.data.pools.find(x => x.id === b.dataset.editPool); if (p) poolForm(p);
    });
    document.querySelectorAll('[data-del-pool]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus pool? Soal tetap ada tanpa pool.')) return;
      const r = await API.auth('guruPoolDelete', { id: b.dataset.delPool });
      if (r && r.ok) { API.toast('✅ Dihapus'); await load(); } else API.toast('❌ Gagal');
    });
  }

  function bindKisi() {
    const sel = $('#gb-assess');
    if (sel) sel.onchange = () => { state.assessmentId = sel.value; render(); };
    const build = $('#gb-build');
    if (build) build.onclick = async () => {
      const r = await API.auth('guruBuildPackage', { id: state.assessmentId });
      if (r && r.ok) { API.toast('✅ Paket disusun: ' + r.added + ' soal' + (r.generator_skipped ? ', ' + r.generator_skipped + ' generator ditunda' : '')); await load(); }
      else API.toast('❌ ' + ((r && r.msg) || 'Gagal menyusun'));
    };
    document.querySelectorAll('[data-del-kisi]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus baris kisi-kisi?')) return;
      const r = await API.auth('guruKisiDelete', { id: b.dataset.delKisi });
      if (r && r.ok) { API.toast('✅ Dihapus'); await load(); } else API.toast('❌ Gagal');
    });
  }

  function poolForm(p) {
    modal({
      title: p ? 'Edit Pool' : 'Tambah Pool',
      fields: [
        { name: 'title', label: 'Judul pool', required: true, value: p ? p.title : '' },
        { name: 'description', label: 'Deskripsi', type: 'textarea', value: p ? p.description || '' : '' },
        { name: 'subjectId', label: 'Mapel', type: 'select', options: subjectOptions(), value: p ? p.subject_id : '' }
      ],
      onSubmit: v => API.auth('guruPoolSave', { id: p ? p.id : null, title: v.title, description: v.description, subjectId: v.subjectId })
    });
  }

  function itemForm(it) {
    const kind = it ? it.kind : 'num';
    const p = it ? (it.payload || {}) : {};
    const wrap = modal({
      title: it ? 'Edit Soal Bank' : 'Tambah Soal Bank',
      fields: [
        { name: 'subjectId', label: 'Mapel', type: 'select', options: subjectOptions(), value: it ? it.subject_id : '' },
        { name: 'poolId', label: 'Pool', type: 'select', options: poolOptions(true), value: it && it.pool_id ? it.pool_id : '' },
        { name: 'indicator', label: 'Indikator', value: it ? it.indicator || '' : '' },
        { name: 'kind', label: 'Jenis', type: 'select', options: KINDS, value: kind },
        { name: 'difficulty', label: 'Kesulitan', type: 'select', options: DIFF, value: it ? it.difficulty || '' : '' },
        { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Aktif' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Arsip' }], value: it ? it.status : 'active' },
        { name: 'prompt', label: 'Teks soal', type: 'textarea', value: p.prompt || '' }
      ],
      extra: '<div id="gb-extra"></div>',
      onSubmit: v => API.auth('guruBankItemSave', Object.assign({ id: it ? it.id : null }, v))
    });
    const extra = document.getElementById('gb-extra');
    const kindSel = document.querySelector('[name=kind]');
    extra.innerHTML = extraHtml(kind, p);
    kindSel.onchange = () => { extra.innerHTML = extraHtml(kindSel.value, {}); };
    // Ambil nilai extra saat submit
    const form = document.getElementById('gb-form');
    const old = form.onsubmit;
    form.onsubmit = e => {
      e.preventDefault();
      const ex = id => { const el = extra.querySelector('[name="' + id + '"]'); return el ? el.value : ''; };
      const k = form.kind.value;
      if (k === 'num') { form.dataset.answer = ex('answer'); form.dataset.tol = ex('tol'); }
      if (k === 'mc' || k === 'bs') { form.dataset.key = ex('key'); form.dataset.options = ex('options'); }
      if (k === 'match') form.dataset.keys = ex('keys');
      if (k === 'scaffold') form.dataset.answers = ex('answers');
      const v = {};
      ['subjectId','poolId','indicator','kind','difficulty','status','prompt'].forEach(n => { v[n] = form.querySelector('[name="' + n + '"]').value.trim(); });
      if (k === 'num') { v.answer = form.dataset.answer; v.tol = form.dataset.tol; }
      if (k === 'mc' || k === 'bs') { v.key = form.dataset.key; v.options = form.dataset.options; }
      if (k === 'match') v.keys = form.dataset.keys;
      if (k === 'scaffold') v.answers = form.dataset.answers;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      API.auth('guruBankItemSave', Object.assign({ id: it ? it.id : null }, v)).then(r => {
        if (r && r.ok) { wrap.remove(); API.toast('✅ Tersimpan'); load(); }
        else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); btn.disabled = false; btn.textContent = 'Simpan'; }
      });
    };
  }

  function kisiForm() {
    if (!state.assessmentId) { API.toast('❌ Pilih asesmen'); return; }
    modal({
      title: 'Tambah Kisi-kisi',
      fields: [
        { name: 'indicator', label: 'Indikator', value: '' },
        { name: 'difficulty', label: 'Kesulitan', type: 'select', options: DIFF, value: '' },
        { name: 'kind', label: 'Jenis', type: 'select', options: [{ value: '', label: 'Semua' }].concat(KINDS), value: '' },
        { name: 'poolId', label: 'Pool', type: 'select', options: poolOptions(true), value: '' },
        { name: 'count', label: 'Jumlah soal', type: 'number', value: 1 },
        { name: 'weight', label: 'Bobot', type: 'number', value: 1 },
        { name: 'sortOrder', label: 'Urutan', type: 'number', value: 0 }
      ],
      onSubmit: v => API.auth('guruKisiSave', Object.assign({ assessmentId: state.assessmentId }, v))
    });
  }

  async function load() {
    const r = await API.auth('guruBankData');
    if (!r || !r.ok) {
      $('#gb-body').innerHTML = UI.empty('Gagal memuat bank soal', (r && r.msg) || 'Coba lagi.');
      return;
    }
    state.data = r;
    render();
  }

  function show(tab) {
    state.tab = tab;
    $('#gb-tab-bank').className = 'btn btn-sm ' + (tab === 'bank' ? 'btn-primary' : 'btn-secondary');
    $('#gb-tab-pool').className = 'btn btn-sm ' + (tab === 'pool' ? 'btn-primary' : 'btn-secondary');
    $('#gb-tab-kisi').className = 'btn btn-sm ' + (tab === 'kisi' ? 'btn-primary' : 'btn-secondary');
    render();
  }

  $('#gb-tab-bank').onclick = () => show('bank');
  $('#gb-tab-pool').onclick = () => show('pool');
  $('#gb-tab-kisi').onclick = () => show('kisi');
  $('#gb-add').onclick = () => {
    if (state.tab === 'bank') itemForm(null);
    else if (state.tab === 'pool') poolForm(null);
    else kisiForm();
  };

  await load();
  show('bank');
};
