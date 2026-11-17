/* ============ pages/siswa-materi.js — detail & peluncur materi ============ */
Router.register('siswa-materi', async () => `
  <div class="page-wrap page-narrow" id="mt-root"></div>
`);

window.init_siswa_materi = async (params) => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  const root = $('#mt-root');
  const unwrap = v => Array.isArray(v) ? v[0] : v;

  const id = params && params.id;
  if (!id) {
    root.innerHTML = UI.pageHeader({ title: 'Materi' })
      + UI.empty('Materi tidak dipilih', 'Kembali ke daftar mapel untuk memilih materi.');
    return;
  }

  root.innerHTML = UI.skeleton(4);
  const r = await API.auth('getMaterial', { id: id });
  const m = r && r.material;
  if (!m) {
    root.innerHTML = UI.pageHeader({ title: 'Materi' })
      + UI.empty('Materi tidak ditemukan', 'Materi mungkin sudah dihapus atau tidak tersedia untuk akun Anda.');
    return;
  }

  const topic = unwrap(m.topics);
  const mod = topic && unwrap(topic.modules);
  const subject = mod && unwrap(mod.subjects);
  const url = UI.safeUrl(m.url);
  const isApp = m.kind === 'app' || m.kind === 'geogebra';

  root.innerHTML = UI.pageHeader({
    title: m.title,
    subtitle: [subject && subject.name, mod && mod.title, topic && topic.title].filter(Boolean).join(' · '),
    back: 'Mapel'
  }) + UI.card(`
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="card-title">${esc(m.title)}</div>
        <div class="card-sub">Jenis: ${esc(m.kind)}</div>
      </div>
      ${UI.badge(m.kind, 'info')}
    </div>
    <p class="card-sub" style="margin-top:10px">
      ${isApp
        ? 'Aplikasi interaktif. Aktivitas membuka aplikasi akan dicatat otomatis.'
        : 'Materi akan dibuka di tab baru.'}
    </p>
    <div style="margin-top:14px">
      ${url
        ? `<button type="button" class="btn btn-primary" id="mt-open">${isApp ? 'Buka aplikasi' : 'Buka materi'}</button>`
        : '<span class="badge">Tautan belum tersedia</span>'}
    </div>
  `);

  UI.bindBack(root);
  root.querySelector('[data-back]').onclick = () => Router.go('siswa-mapel');

  const openBtn = $('#mt-open');
  if (openBtn) openBtn.onclick = () => {
    if (!isApp) {
      API.auth('logAktifitas', {
        namaApp: 'LMS-MATERI', section: String(m.kind || 'MATERI').toUpperCase(),
        jenis: 'section', durasi: 30
      }).catch(() => {});
    }
    window.open(url, '_blank', 'noopener');
  };
};
