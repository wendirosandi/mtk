/* ============ pages/admin-pengaturan.js — feature flags & registry ============ */
Router.register('admin-pengaturan', async () => `
  <div class="page-wrap page-narrow">
    <div id="apg-head"></div>
    <div id="apg-body">${UI.skeleton(5)}</div>
  </div>
`);

window.init_admin_pengaturan = async () => {
  const $ = s => document.querySelector(s);
  const esc = UI.esc;
  $('#apg-head').innerHTML = UI.pageHeader({
    title: 'Pengaturan',
    subtitle: 'Feature flags sekolah, status AI, dan registry aplikasi.'
  });

  const r = await API.auth('adminSettingsData');
  if (!r || !r.ok) {
    $('#apg-body').innerHTML = UI.empty('Gagal memuat pengaturan', (r && r.msg) || 'Coba lagi.');
    return;
  }
  const school = r.school || {};
  const settings = school.settings || {};
  const features = settings.features || {};
  const FEATURES = [
    { key: 'ai', label: 'AI Guru', desc: 'Wizard draft AI untuk guru' },
    { key: 'collaboration', label: 'Kolaborasi', desc: 'Pasangan siswa & approval guru' },
    { key: 'bank_soal', label: 'Bank Soal', desc: 'Pool, bank item, kisi-kisi' },
    { key: 'tools', label: 'ToolsMathPro', desc: 'Aplikasi tools matematika' },
    { key: 'calendar', label: 'Kalender Pythagoras', desc: 'Modul kalender pembuktian' }
  ];

  $('#apg-body').innerHTML = `<div class="card" style="margin-bottom:12px">
      <div class="card-title">Fitur Sekolah</div>
      <div class="space-y-2" style="margin-top:8px">
        ${FEATURES.map(f => `<label class="flex items-center justify-between gap-2 border rounded-xl p-3" style="border-color:var(--border);cursor:pointer">
          <span><b style="font-size:14px">${esc(f.label)}</b><br><span class="card-sub">${esc(f.desc)}</span></span>
          <input type="checkbox" data-feature="${esc(f.key)}" ${features[f.key] !== false ? 'checked' : ''} style="width:20px;height:20px">
        </label>`).join('')}
      </div>
      <button id="apg-save" type="button" class="btn btn-primary" style="margin-top:12px">Simpan Feature Flags</button>
      <p class="card-sub" style="margin-top:6px">Menu guru/siswa disembunyikan bila flag dimatikan (setelah halaman dimuat ulang).</p>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="flex items-center justify-between gap-2">
        <div><div class="card-title">Status AI</div><div class="card-sub">Edge Function ai-content</div></div>
        <button id="apg-ai" type="button" class="btn btn-secondary btn-sm">Cek</button>
      </div>
      <div id="apg-ai-status" class="card-sub" style="margin-top:8px">Belum dicek.</div>
    </div>

    <div class="card">
      <div class="card-title">Registry Aplikasi</div>
      <p class="card-sub">Materi jenis <code>app</code> yang terdaftar di LMS.</p>
      <div style="margin-top:8px">
        ${(r.apps || []).length ? '<div style="overflow-x:auto"><table class="w-full text-xs"><thead><tr class="bg-slate-100"><th class="p-2 text-left">Nama</th><th class="p-2 text-left">App Code</th><th class="p-2 text-left">URL</th><th class="p-2"></th></tr></thead><tbody>'
          + r.apps.map(a => `<tr class="border-t"><td class="p-2"><b>${esc(a.title)}</b></td>
            <td class="p-2">${esc((a.meta || {}).app_code || '-')}</td>
            <td class="p-2">${esc(a.url || '-')}</td>
            <td class="p-2 text-right">${a.url ? `<a class="btn btn-secondary btn-sm" href="${esc(UI.safeUrl(a.url))}" target="_blank" rel="noopener">Buka</a>` : '-'}</td></tr>`).join('')
          + '</tbody></table></div>' : UI.empty('Belum ada aplikasi terdaftar', 'Tambahkan materi kind=app.')}
      </div>
      <p class="card-sub" style="margin-top:8px">Dokumentasi: <a href="docs/MODULE_REGISTRY.md" target="_blank" style="color:var(--info);font-weight:700">MODULE_REGISTRY.md</a></p>
    </div>`;

  $('#apg-save').onclick = async () => {
    const next = Object.assign({}, features);
    document.querySelectorAll('[data-feature]').forEach(cb => { next[cb.dataset.feature] = cb.checked; });
    const btn = $('#apg-save');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const r2 = await API.auth('adminSchoolSave', {
      name: school.name,
      headmaster: school.headmaster,
      settings: Object.assign({}, settings, { features: next })
    });
    if (r2 && r2.ok) {
      API.toast('✅ Feature flags disimpan');
      setTimeout(() => location.reload(), 700);
    } else {
      API.toast('❌ ' + ((r2 && r2.msg) || 'Gagal'));
      btn.disabled = false; btn.textContent = 'Simpan Feature Flags';
    }
  };

  $('#apg-ai').onclick = async () => {
    $('#apg-ai-status').textContent = 'Memeriksa...';
    const res = await LMS.supabase.functions.invoke('ai-content', { body: { action: 'health' } });
    if (res.error) { $('#apg-ai-status').textContent = '❌ ' + res.error.message; return; }
    const d = res.data || {};
    $('#apg-ai-status').innerHTML = d.configured
      ? '✅ Terkonfigurasi · model <b>' + esc(d.model) + '</b>'
      : '⚠️ Belum terkonfigurasi (AI_API_KEY kosong)';
  };
};
