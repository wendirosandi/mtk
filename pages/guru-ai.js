/* ============ pages/guru-ai.js — wizard draft AI (Bank Soal) ============ */
Router.register('guru-ai', async () => `
  <div class="page-wrap page-narrow">
    <div id="ai-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">Generator Draft AI</div>
      <p class="card-sub">Hasil selalu berupa draft di Bank Soal. Tinjau sebelum menerbitkan.</p>
      <div class="grid gap-2" style="margin-top:10px">
        <select id="ai-subject" class="w-full border rounded-xl px-3 py-2 text-sm"></select>
        <input id="ai-topic" class="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Topik (mis. Teorema Pythagoras)">
        <input id="ai-indicator" class="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Indikator pembelajaran">
        <div class="grid grid-cols-3 gap-2">
          <select id="ai-kind" class="border rounded-xl px-3 py-2 text-sm">
            <option value="num">Numerik</option><option value="mc">Pilihan ganda</option>
            <option value="bs">Benar/Salah</option><option value="match">Menjodohkan</option>
            <option value="scaffold">Bertahap</option><option value="text">Uraian</option>
          </select>
          <select id="ai-diff" class="border rounded-xl px-3 py-2 text-sm">
            <option value="A">A (sulit)</option><option value="B" selected>B (sedang)</option>
            <option value="C">C (mudah)</option>
          </select>
          <input id="ai-items" type="number" min="1" max="30" value="5" class="border rounded-xl px-3 py-2 text-sm">
        </div>
        <textarea id="ai-instructions" rows="2" class="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Instruksi tambahan (opsional)"></textarea>
        <button id="ai-run" type="button" class="btn btn-primary">Generate Draft</button>
      </div>
      <p id="ai-status" class="card-sub" style="margin-top:8px"></p>
    </div>
    <div id="ai-result"></div>
  </div>
`);

window.init_guru_ai = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  $('#ai-head').innerHTML = UI.pageHeader({
    title: 'AI Guru (Beta)',
    subtitle: 'Buat draft soal berbantuan AI. Wajib ditinjau guru.'
  });

  const ctx = await API.auth('guruContext');
  const subjects = (ctx && ctx.subjects) || [];
  $('#ai-subject').innerHTML = subjects.length
    ? subjects.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.code)})</option>`).join('')
    : '<option value="">Tidak ada mapel</option>';

  $('#ai-run').onclick = async () => {
    const btn = $('#ai-run');
    const subjectId = $('#ai-subject').value;
    if (!subjectId) { API.toast('❌ Mapel belum tersedia'); return; }
    btn.disabled = true; btn.textContent = 'Menghubungi AI...';
    $('#ai-status').textContent = 'Memproses...';
    $('#ai-result').innerHTML = '';
    const body = {
      kind: 'bank',
      params: {
        subject_id: subjectId,
        subject_name: ($('#ai-subject').selectedOptions[0] || {}).textContent || '',
        topic: $('#ai-topic').value.trim(),
        indicator: $('#ai-indicator').value.trim(),
        difficulty: $('#ai-diff').value,
        item_kind: $('#ai-kind').value,
        items: Number($('#ai-items').value) || 5,
        instructions: $('#ai-instructions').value.trim()
      }
    };
    const r = await LMS.supabase.functions.invoke('ai-content', { body });
    btn.disabled = false; btn.textContent = 'Generate Draft';
    if (r.error) {
      $('#ai-status').textContent = '❌ ' + r.error.message;
      API.toast('❌ ' + r.error.message);
      return;
    }
    if (!r.data || !r.data.ok) {
      const msg = (r.data && r.data.msg) || 'Gagal';
      $('#ai-status').textContent = '❌ ' + msg;
      API.toast('❌ ' + msg);
      return;
    }
    $('#ai-status').textContent = '✅ ' + r.data.count + ' draft dibuat (job ' + r.data.job_id + ')';
    const ids = (r.data.drafts || []).map(x => x.id);
    if (ids.length) {
      const q = await LMS.supabase.from('bank_items').select('id,payload,kind,difficulty,status').in('id', ids);
      $('#ai-result').innerHTML = '<div class="card"><div class="card-title">Draft yang dihasilkan</div>'
        + (q.data || []).map((x, i) => `<div class="border rounded-xl p-3" style="border-color:var(--border);margin-top:8px">
            <div style="font-weight:700">${i + 1}. ${esc((x.payload || {}).prompt || '')}</div>
            <div class="card-sub">${esc(x.kind)} · ${esc(x.difficulty || '-')} · ${UI.badge(x.status, 'warning')}</div>
          </div>`).join('')
        + '<p class="card-sub" style="margin-top:10px">Buka <a href="#guru-bank" style="color:var(--info);font-weight:700">Bank Soal</a> untuk meninjau/mengedit.</p></div>';
    }
  };
};
