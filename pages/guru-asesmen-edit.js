/* ============ pages/guru-asesmen-edit.js — builder LKPD/Kuis ============ */
Router.register('guru-asesmen-edit', async () => `
  <div class="page-wrap" id="ae-root"></div>
`);

window.init_guru_asesmen_edit = async (params) => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const root = $('#ae-root');
  const state = { data: null };
  const id = params && params.id;

  const KIND_LABEL = { lkpd: 'LKPD', kuis: 'Kuis', tugas: 'Tugas', projek: 'Projek', num: 'Numerik', mc: 'Pilihan ganda', bs: 'Benar/Salah', match: 'Menjodohkan', scaffold: 'Bertahap', text: 'Uraian' };
  const TONE = { draft: 'warning', active: 'success', exambro: 'info', archived: '', deleted: 'danger' };

  if (!id) {
    root.innerHTML = UI.pageHeader({ title: 'Builder Asesmen' })
      + UI.empty('Asesmen tidak dipilih', 'Kembali ke daftar asesmen.');
    return;
  }

  function keySummary(q) {
    const p = q.payload || {};
    if (q.kind === 'num') return 'Kunci: ' + esc(p.answer) + (p.tol ? ' (tol ' + esc(p.tol) + ')' : '');
    if (q.kind === 'mc' || q.kind === 'bs') return 'Kunci: ' + esc(p.key || '-');
    if (q.kind === 'match') return 'Kunci: ' + esc((p.keys || []).join(' | '));
    if (q.kind === 'scaffold') return 'Jawaban: ' + esc((p.answers || []).join(', '));
    return 'Dinilai guru';
  }

  function modal(html) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = '<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto">' + html + '</div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelectorAll('[data-cancel]').forEach(b => b.onclick = close);
    wrap.onclick = e => { if (e.target === wrap) close(); };
    return { wrap, close };
  }

  function extraHtml(kind, p) {
    p = p || {};
    if (kind === 'num') {
      return `<div class="grid grid-cols-2 gap-2">
        <div><label style="font-size:12px;font-weight:700">Kunci (angka)</label>
          <input name="answer" type="number" step="any" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(p.answer != null ? p.answer : '')}"></div>
        <div><label style="font-size:12px;font-weight:700">Toleransi</label>
          <input name="tol" type="number" step="any" min="0" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(p.tol != null ? p.tol : 0)}"></div>
      </div>`;
    }
    if (kind === 'mc' || kind === 'bs') {
      return `<div><label style="font-size:12px;font-weight:700">Pilihan (pisah dengan |)</label>
        <input name="options" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc((p.options || []).join(' | '))}" placeholder="A | B | C | D">
        </div><div><label style="font-size:12px;font-weight:700">Kunci</label>
        <input name="key" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(p.key || '')}"></div>`;
    }
    if (kind === 'match') {
      return `<div><label style="font-size:12px;font-weight:700">Kunci berurutan (pisah koma)</label>
        <input name="keys" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc((p.keys || []).join(', '))}"></div>`;
    }
    if (kind === 'scaffold') {
      return `<div><label style="font-size:12px;font-weight:700">Jawaban berurutan (angka, pisah koma)</label>
        <input name="answers" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc((p.answers || []).join(', '))}"></div>`;
    }
    return '<p class="card-sub">Soal uraian akan dinilai manual oleh guru.</p>';
  }

  function questionModal(q) {
    const isEdit = !!q;
    const kind = q ? q.kind : 'num';
    const p = q ? (q.payload || {}) : {};
    const html = `<h3 style="font-weight:800;font-size:18px;margin-bottom:12px">${isEdit ? 'Edit Soal' : 'Tambah Soal'}</h3>
      <form id="ae-qform" class="space-y-3">
        <div><label style="font-size:12px;font-weight:700">Teks soal *</label>
          <textarea name="prompt" rows="3" class="w-full border rounded-xl px-3 py-2 text-sm">${esc(p.prompt || '')}</textarea></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label style="font-size:12px;font-weight:700">Jenis</label>
            <select name="kind" class="w-full border rounded-xl px-3 py-2 text-sm">
              ${['num','mc','bs','match','scaffold','text'].map(k => `<option value="${k}"${k === kind ? ' selected' : ''}>${KIND_LABEL[k]}</option>`).join('')}
            </select></div>
          <div><label style="font-size:12px;font-weight:700">Kesulitan</label>
            <select name="difficulty" class="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="">-</option>${['A','B','C'].map(d => `<option value="${d}"${q && q.difficulty === d ? ' selected' : ''}>${d}</option>`).join('')}
            </select></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label style="font-size:12px;font-weight:700">Bobot</label>
            <input name="weight" type="number" step="0.1" min="0" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(q ? q.weight : 1)}"></div>
          <div><label style="font-size:12px;font-weight:700">Urutan</label>
            <input name="sortOrder" type="number" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(q ? q.sort_order : 0)}"></div>
        </div>
        <div id="ae-extra" class="space-y-2">${extraHtml(kind, p)}</div>
        <div class="flex gap-2" style="margin-top:16px">
          <button type="submit" class="btn btn-primary flex-1">Simpan Soal</button>
          <button type="button" data-cancel class="btn btn-secondary">Batal</button>
        </div>
      </form>`;
    const m = modal(html);
    const form = m.wrap.querySelector('#ae-qform');
    const kindSel = form.querySelector('[name=kind]');
    kindSel.onchange = () => { m.wrap.querySelector('#ae-extra').innerHTML = extraHtml(kindSel.value, {}); };
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      const v = {
        assessmentId: id,
        id: q ? q.id : null,
        prompt: form.prompt.value,
        kind: form.kind.value,
        difficulty: form.difficulty.value,
        weight: form.weight.value,
        sortOrder: form.sortOrder.value
      };
      const extra = m.wrap.querySelector('#ae-extra');
      function val(name) { const el = extra.querySelector('[name="' + name + '"]'); return el ? el.value : ''; }
      if (v.kind === 'num') { v.answer = val('answer'); v.tol = val('tol'); }
      if (v.kind === 'mc' || v.kind === 'bs') { v.key = val('key'); v.options = val('options'); }
      if (v.kind === 'match') v.keys = val('keys');
      if (v.kind === 'scaffold') v.answers = val('answers');
      const r = await API.auth('guruQuestionSave', v);
      if (r && r.ok) { m.close(); API.toast('✅ Soal disimpan'); await load(); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); btn.disabled = false; btn.textContent = 'Simpan Soal'; }
    };
  }

  function metaModal(a) {
    const cands = state.data.candidates || [];
    const html = `<h3 style="font-weight:800;font-size:18px;margin-bottom:12px">Edit Metadata</h3>
      <form id="ae-mform" class="space-y-3">
        <div><label style="font-size:12px;font-weight:700">Judul *</label>
          <input name="title" class="w-full border rounded-xl px-3 py-2 text-sm" value="${esc(a.title)}"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label style="font-size:12px;font-weight:700">Jenis</label>
            <select name="kind" class="w-full border rounded-xl px-3 py-2 text-sm">
              ${['lkpd','kuis','tugas','projek'].map(k => `<option value="${k}"${a.kind === k ? ' selected' : ''}>${KIND_LABEL[k]}</option>`).join('')}
            </select></div>
          <div><label style="font-size:12px;font-weight:700">Semester</label>
            <select name="semester" class="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="1"${a.semester === 1 ? ' selected' : ''}>1</option>
              <option value="2"${a.semester === 2 ? ' selected' : ''}>2</option>
            </select></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label style="font-size:12px;font-weight:700">Kolaborasi</label>
            <select name="collabMode" class="w-full border rounded-xl px-3 py-2 text-sm">
              ${['none','optional','optional_fixed','required','required_fixed'].map(k => `<option value="${k}"${a.collab_mode === k ? ' selected' : ''}>${k}</option>`).join('')}
            </select></div>
          <div><label style="font-size:12px;font-weight:700">Pengiriman</label>
            <select name="delivery" class="w-full border rounded-xl px-3 py-2 text-sm">
              ${['portal','exambro','direct'].map(k => `<option value="${k}"${a.delivery === k ? ' selected' : ''}>${k}</option>`).join('')}
            </select></div>
        </div>
        <div><label style="font-size:12px;font-weight:700">Prasyarat</label>
          <select name="prerequisiteId" class="w-full border rounded-xl px-3 py-2 text-sm">
            <option value="">Tidak ada</option>
            ${cands.map(c => `<option value="${esc(c.id)}"${a.prerequisite_assessment_id === c.id ? ' selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`).join('')}
          </select></div>
        <div class="flex gap-2" style="margin-top:16px">
          <button type="submit" class="btn btn-primary flex-1">Simpan</button>
          <button type="button" data-cancel class="btn btn-secondary">Batal</button>
        </div>
      </form>`;
    const m = modal(html);
    const form = m.wrap.querySelector('#ae-mform');
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      const r = await API.auth('guruAssessmentUpdate', {
        id: id, title: form.title.value, kind: form.kind.value,
        semester: form.semester.value, collabMode: form.collabMode.value,
        delivery: form.delivery.value, prerequisiteId: form.prerequisiteId.value
      });
      if (r && r.ok) { m.close(); API.toast('✅ Metadata disimpan'); await load(); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); btn.disabled = false; btn.textContent = 'Simpan'; }
    };
  }

  async function load() {
    root.innerHTML = UI.skeleton(5);
    const r = await API.auth('guruAssessmentGet', { id: id });
    if (!r || !r.ok) {
      root.innerHTML = UI.pageHeader({ title: 'Builder Asesmen' })
        + UI.empty('Asesmen tidak ditemukan', (r && r.msg) || 'Periksa akses Anda.');
      return;
    }
    state.data = r;
    const a = r.assessment;
    const questions = r.questions || [];
    const frozen = !!a.package_frozen_at;

    let html = UI.pageHeader({
      title: a.title,
      subtitle: (a.subjects ? a.subjects.name + ' · ' : '') + a.code + (a.topics ? ' · ' + a.topics.title : ''),
      back: 'Asesmen'
    });

    html += '<div class="card" style="margin-bottom:12px">'
      + '<div class="flex flex-wrap items-center gap-2 justify-between">'
      + '<div>' + UI.badge(a.status, TONE[a.status] || '') + ' '
      + (frozen ? UI.badge('Paket beku', 'info') : '')
      + '<span class="card-sub" style="margin-left:8px">' + esc(KIND_LABEL[a.kind] || a.kind)
      + ' · Semester ' + esc(a.semester || '-') + ' · ' + questions.length + ' soal</span></div>'
      + '<div class="flex gap-2">'
      + (!frozen ? '<button class="btn btn-secondary btn-sm" id="ae-meta">Edit metadata</button>' : '')
      + (a.status === 'draft' ? '<button class="btn btn-primary btn-sm" id="ae-publish">Terbitkan</button>' : '')
      + (a.status === 'active' ? '<button class="btn btn-secondary btn-sm" id="ae-archive">Arsipkan</button>' : '')
      + '</div></div>'
      + (frozen ? '<p class="card-sub" style="margin-top:8px">Paket sudah dibekukan karena sudah ada percobaan siswa. Soal tidak dapat diubah.</p>' : '')
      + '</div>';

    html += '<div class="card"><div class="flex items-center justify-between gap-2" style="margin-bottom:10px">'
      + '<div class="card-title">Daftar Soal</div>'
      + (!frozen ? '<button class="btn btn-primary btn-sm" id="ae-add">+ Soal</button>' : '')
      + '</div>';

    if (!questions.length) {
      html += UI.empty('Belum ada soal', 'Tambahkan soal sebelum menerbitkan asesmen.');
    } else {
      html += '<div class="space-y-2">' + questions.map((q, i) => `
        <div class="border rounded-xl p-3" style="border-color:var(--border)">
          <div class="flex items-start justify-between gap-3">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px">${i + 1}. ${esc((q.payload || {}).prompt || '(tanpa teks)')}</div>
              <div class="card-sub">${esc(KIND_LABEL[q.kind] || q.kind)} · bobot ${esc(q.weight)}${q.difficulty ? ' · kesulitan ' + esc(q.difficulty) : ''}</div>
              <div class="card-sub" style="margin-top:4px">${keySummary(q)}</div>
            </div>
            ${!frozen ? `<div class="flex gap-1">
              <button class="btn btn-secondary btn-sm" data-edit-q="${esc(q.id)}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-q="${esc(q.id)}">Hapus</button>
            </div>` : ''}
          </div>
        </div>`).join('') + '</div>';
    }
    html += '</div>';

    root.innerHTML = html;
    const back = root.querySelector('[data-back]');
    if (back) back.onclick = () => Router.go('guru-asesmen');

    const metaBtn = $('#ae-meta');
    if (metaBtn) metaBtn.onclick = () => metaModal(a);
    const addBtn = $('#ae-add');
    if (addBtn) addBtn.onclick = () => questionModal(null);

    const pub = $('#ae-publish');
    if (pub) pub.onclick = async () => {
      if (!confirm('Terbitkan asesmen ini? Siswa akan dapat melihatnya.')) return;
      const x = await API.auth('guruAssessmentPublish', { id: id });
      if (x && x.ok) { API.toast('✅ Diterbitkan'); await load(); }
      else API.toast('❌ ' + ((x && x.msg) || 'Gagal'));
    };
    const ars = $('#ae-archive');
    if (ars) ars.onclick = async () => {
      if (!confirm('Arsipkan asesmen ini?')) return;
      const x = await API.auth('guruAssessmentArchive', { id: id });
      if (x && x.ok) { API.toast('✅ Diarsipkan'); await load(); }
      else API.toast('❌ ' + ((x && x.msg) || 'Gagal'));
    };

    root.querySelectorAll('[data-edit-q]').forEach(b => b.onclick = () => {
      const q = questions.find(x => x.id === b.dataset.editQ);
      if (q) questionModal(q);
    });
    root.querySelectorAll('[data-del-q]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus soal ini?')) return;
      const x = await API.auth('guruQuestionDelete', { id: b.dataset.delQ });
      if (x && x.ok) { API.toast('✅ Soal dihapus'); await load(); }
      else API.toast('❌ ' + ((x && x.msg) || 'Gagal'));
    });
  }

  await load();
};
