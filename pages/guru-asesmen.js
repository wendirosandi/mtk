/* ============ pages/guru-asesmen.js — daftar LKPD/Kuis ============ */
Router.register('guru-asesmen', async () => `
  <div class="page-wrap">
    <div id="ga-head"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="flex flex-wrap gap-2 items-center">
        <select id="as-kind" class="border rounded-xl px-3 py-2 text-sm">
          <option value="">Semua jenis</option>
          <option value="lkpd">LKPD</option>
          <option value="kuis">Kuis</option>
          <option value="tugas">Tugas</option>
          <option value="projek">Projek</option>
        </select>
        <select id="as-status" class="border rounded-xl px-3 py-2 text-sm">
          <option value="">Semua status</option>
          <option value="draft">Draft</option>
          <option value="active">Aktif</option>
          <option value="exambro">Exambro</option>
          <option value="archived">Arsip</option>
        </select>
        <div class="flex-1"></div>
        <button id="as-new" type="button" class="btn btn-primary btn-sm">+ Asesmen</button>
      </div>
    </div>
    <div id="as-body">${UI.skeleton(3)}</div>
  </div>
`);

window.init_guru_asesmen = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const state = { rows: [], context: null };

  const KIND_LABEL = { lkpd: 'LKPD', kuis: 'Kuis', tugas: 'Tugas', projek: 'Projek' };
  const TONE = { draft: 'warning', active: 'success', exambro: 'info', archived: '', deleted: 'danger' };

  $('#ga-head').innerHTML = UI.pageHeader({
    title: 'Asesmen',
    subtitle: 'Kelola LKPD, kuis, tugas, dan projek untuk mapel yang Anda ampu.'
  });

  function render() {
    const kind = $('#as-kind').value;
    const status = $('#as-status').value;
    const rows = state.rows.filter(r => (!kind || r.kind === kind) && (!status || r.status === status));
    if (!rows.length) {
      $('#as-body').innerHTML = UI.empty('Belum ada asesmen', 'Buat asesmen pertama atau ubah filter.');
      return;
    }
    $('#as-body').innerHTML = '<div class="space-y-3">' + rows.map(a => `
      <div class="card">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="card-title">${esc(a.title)}</div>
            <div class="card-sub">${esc(a.code)} · ${esc(KIND_LABEL[a.kind] || a.kind)}
              ${a.topic ? ' · ' + esc(a.topic.title) : ''}</div>
          </div>
          <div class="flex flex-col items-end gap-1">
            ${UI.badge(a.status, TONE[a.status] || '')}
            ${a.frozen ? UI.badge('Frozen', 'info') : ''}
          </div>
        </div>
        <div class="card-sub" style="margin-top:8px">${a.questionCount} soal · Semester ${esc(a.semester || '-')}
          ${a.publishedAt ? ' · terbit ' + esc(a.publishedAt) : ''}</div>
        <div class="flex flex-wrap gap-2" style="margin-top:12px">
          <a class="btn btn-primary btn-sm" href="#guru-asesmen-edit?id=${encodeURIComponent(a.id)}">Buka builder</a>
          ${a.status === 'draft' ? `<button class="btn btn-secondary btn-sm" data-publish="${esc(a.id)}" data-count="${a.questionCount}">Terbitkan</button>` : ''}
          ${a.status === 'active' ? `<button class="btn btn-secondary btn-sm" data-archive="${esc(a.id)}">Arsipkan</button>` : ''}
        </div>
      </div>`).join('') + '</div>';

    $('#as-body').querySelectorAll('[data-publish]').forEach(b => b.onclick = async () => {
      if (Number(b.dataset.count) === 0) { API.toast('❌ Tambahkan soal terlebih dahulu'); return; }
      b.disabled = true;
      const r = await API.auth('guruAssessmentPublish', { id: b.dataset.publish });
      if (r && r.ok) { API.toast('✅ Asesmen diterbitkan'); await load(); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); b.disabled = false; }
    });
    $('#as-body').querySelectorAll('[data-archive]').forEach(b => b.onclick = async () => {
      if (!confirm('Arsipkan asesmen ini?')) return;
      const r = await API.auth('guruAssessmentArchive', { id: b.dataset.archive });
      if (r && r.ok) { API.toast('✅ Diarsipkan'); await load(); }
      else API.toast('❌ ' + ((r && r.msg) || 'Gagal'));
    });
  }

  async function load() {
    const r = await API.auth('guruAssessments');
    state.rows = (r && r.rows) || [];
    render();
  }

  function createModal() {
    const ctx = state.context || { subjects: [], years: [] };
    if (!ctx.subjects.length || !ctx.years.length) { API.toast('❌ Mapel/tahun belum tersedia'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div style="background:#fff;border-radius:20px;padding:20px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto">
      <h3 style="font-weight:800;font-size:18px;margin-bottom:12px">Asesmen Baru</h3>
      <form id="as-form" class="space-y-3">
        <div><label style="font-size:12px;font-weight:700">Kode *</label>
          <input name="code" class="w-full border rounded-xl px-3 py-2 text-sm" value="MTK-${String(Date.now()).slice(-5)}"></div>
        <div><label style="font-size:12px;font-weight:700">Judul *</label>
          <input name="title" class="w-full border rounded-xl px-3 py-2 text-sm"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label style="font-size:12px;font-weight:700">Jenis</label>
            <select name="kind" class="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="lkpd">LKPD</option><option value="kuis">Kuis</option>
              <option value="tugas">Tugas</option><option value="projek">Projek</option>
            </select></div>
          <div><label style="font-size:12px;font-weight:700">Semester</label>
            <select name="semester" class="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="1">1</option><option value="2">2</option>
            </select></div>
        </div>
        <div><label style="font-size:12px;font-weight:700">Mata pelajaran</label>
          <select name="subjectId" class="w-full border rounded-xl px-3 py-2 text-sm">
            ${ctx.subjects.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.code)})</option>`).join('')}
          </select></div>
        <div><label style="font-size:12px;font-weight:700">Tahun pelajaran</label>
          <select name="academicYearId" class="w-full border rounded-xl px-3 py-2 text-sm">
            ${ctx.years.map(y => `<option value="${esc(y.id)}">${esc(y.label)}</option>`).join('')}
          </select></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label style="font-size:12px;font-weight:700">Kolaborasi</label>
            <select name="collabMode" class="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="none">Tidak ada</option><option value="optional">Opsional</option>
              <option value="required">Wajib</option><option value="required_fixed">Wajib (fix)</option>
            </select></div>
          <div><label style="font-size:12px;font-weight:700">Pengiriman</label>
            <select name="delivery" class="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="portal">Portal</option><option value="exambro">Exambro</option>
              <option value="direct">Direct</option>
            </select></div>
        </div>
        <div class="flex gap-2" style="margin-top:16px">
          <button type="submit" class="btn btn-primary flex-1">Buat & Buka Builder</button>
          <button type="button" data-cancel class="btn btn-secondary">Batal</button>
        </div>
      </form></div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-cancel]').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
    wrap.querySelector('#as-form').onsubmit = async e => {
      e.preventDefault();
      const f = wrap.querySelector('#as-form');
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Membuat...';
      const r = await API.auth('guruAssessmentCreate', {
        code: f.code.value, title: f.title.value, kind: f.kind.value,
        semester: f.semester.value, subjectId: f.subjectId.value,
        academicYearId: f.academicYearId.value, collabMode: f.collabMode.value,
        delivery: f.delivery.value
      });
      if (r && r.ok) { close(); Router.go('guru-asesmen-edit', { id: r.id }); }
      else { API.toast('❌ ' + ((r && r.msg) || 'Gagal')); btn.disabled = false; btn.textContent = 'Buat & Buka Builder'; }
    };
  }

  const ctx = await API.auth('guruContext');
  state.context = (ctx && ctx.ok) ? ctx : { subjects: [], years: [] };
  $('#as-new').onclick = createModal;
  $('#as-kind').onchange = render;
  $('#as-status').onchange = render;
  await load();
};
