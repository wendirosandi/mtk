/* src/ui/shell.js — topbar, sidebar, bottom navigation per role */
window.Shell = (function () {
  'use strict';

  var NAV = {
    siswa: [
      { route: 'siswa-dash', label: 'Beranda', icon: 'fa-house' },
      { route: 'siswa-mapel', label: 'Mapel', icon: 'fa-book-open' },
      { route: 'siswa-nilai', label: 'Nilai', icon: 'fa-chart-line' },
      { route: 'siswa-aktifitas', label: 'Aktivitas', icon: 'fa-wave-square' },
      { route: 'siswa-kolab', label: 'Kolaborasi', icon: 'fa-handshake' },
      { route: 'siswa-profil', label: 'Profil', icon: 'fa-user' }
    ],
    guru: [
      { route: 'guru-dash', label: 'Dashboard', icon: 'fa-gauge-high' },
      { route: 'guru-kelas', label: 'Kelas Saya', icon: 'fa-users' },
      { route: 'guru-rekap', label: 'Nilai', icon: 'fa-table-list' },
      { route: 'guru-kurikulum', label: 'Kurikulum', icon: 'fa-layer-group' },
      { route: 'guru-monitor', label: 'Monitoring', icon: 'fa-desktop' },
      { route: 'guru-aktifitas', label: 'Aktivitas', icon: 'fa-wave-square' },
      { route: 'guru-asesmen', label: 'Asesmen', icon: 'fa-file-pen' },
      { route: 'guru-bank', label: 'Bank Soal', icon: 'fa-database' },
      { route: 'guru-kolab', label: 'Kolaborasi', icon: 'fa-handshake' },
      { route: 'guru-permintaan', label: 'Permintaan', icon: 'fa-inbox', soon: true },
      { route: 'guru-profil', label: 'Profil', icon: 'fa-id-badge', soon: true }
    ],
    admin: [
      { route: 'admin-dash', label: 'Ringkasan', icon: 'fa-gauge-high' },
      { route: 'admin-pengguna', label: 'Pengguna', icon: 'fa-user-gear' },
      { route: 'admin-sekolah', label: 'Sekolah', icon: 'fa-building' },
      { route: 'admin-monitoring', label: 'Monitoring', icon: 'fa-desktop' },
      { route: 'admin-akademik', label: 'Akademik', icon: 'fa-school' },
      { route: 'admin-pengaturan', label: 'Pengaturan', icon: 'fa-sliders', soon: true }
    ]
  };

  function roleKey(role) { return role === 'admin' ? 'admin' : role === 'guru' ? 'guru' : 'siswa'; }
  function items(role) { return NAV[roleKey(role)] || NAV.siswa; }
  function esc(v) { return window.UI ? UI.esc(v) : String(v == null ? '' : v); }

  function navHtml(role, active, bottom) {
    var list = items(role).filter(function (it) { return !bottom || !it.soon; });
    return list.map(function (it) {
      var cls = 'nav-item' + (it.route === active ? ' active' : '') + (it.soon ? ' disabled' : '');
      var inner = '<i class="fas ' + it.icon + '"></i><span>' + esc(it.label) + '</span>'
        + (it.soon ? '<span class="nav-soon">Soon</span>' : '');
      if (it.soon) return '<span class="' + cls + '" aria-disabled="true">' + inner + '</span>';
      return '<a class="' + cls + '" href="#' + it.route + '"'
        + (it.route === active ? ' aria-current="page"' : '') + '>' + inner + '</a>';
    }).join('');
  }

  function bottomHtml(role, active) {
    return '<div class="bnav-grid">' + items(role).filter(function (it) { return !it.soon; }).slice(0, 5).map(function (it) {
      var cls = it.route === active ? 'active' : '';
      return '<a class="' + cls + '" href="#' + it.route + '"'
        + (it.route === active ? ' aria-current="page"' : '') + '>'
        + '<i class="fas ' + it.icon + '"></i><span>' + esc(it.label) + '</span></a>';
    }).join('') + '</div>';
  }

  function render(role, active) {
    var top = document.getElementById('shell-topbar');
    var side = document.getElementById('shell-sidebar');
    var bottom = document.getElementById('shell-bottomnav');
    if (!top || !side || !bottom) return;

    if (!role || active === 'login') { hide(); return; }

    var meta = (window.API && API.getMeta()) || {};
    var name = meta.nama || meta.namaGuru || meta.username || 'Pengguna';
    var school = meta.namaSekolah || meta.info && meta.info.namaSekolah || '';
    var roleLabel = role === 'admin' ? 'Admin' : role === 'guru' ? 'Guru' : 'Siswa';
    var home = role === 'siswa' ? 'siswa-dash' : 'guru-dash';

    top.innerHTML = '<a class="brand" href="#' + home + '"><i class="fas fa-graduation-cap"></i>'
      + '<span>LMS MTK<small>' + esc(school) + '</small></span></a>'
      + '<div class="spacer"></div>'
      + '<div class="shell-user"><span class="badge badge--info">' + roleLabel + '</span>'
      + '<span><b>' + esc(name) + '</b><br>' + esc(meta.username || '') + '</span></div>'
      + '<button class="shell-logout" type="button" id="shell-logout">Keluar</button>';

    side.innerHTML = '<div class="nav-group-label">Menu</div>' + navHtml(role, active, false);
    bottom.innerHTML = bottomHtml(role, active);
    document.body.classList.add('shell-ready');

    var lo = document.getElementById('shell-logout');
    if (lo) lo.onclick = function () { API.logout(); };
  }

  function hide() {
    var top = document.getElementById('shell-topbar');
    var side = document.getElementById('shell-sidebar');
    var bottom = document.getElementById('shell-bottomnav');
    if (top) top.innerHTML = '';
    if (side) side.innerHTML = '';
    if (bottom) bottom.innerHTML = '';
    document.body.classList.remove('shell-ready');
  }

  function sync(route, role) {
    /* sub-route mewarisi menu induk */
    var active = route === 'siswa-materi' ? 'siswa-mapel' : route;
    render(role, active);
  }

  return { sync: sync, hide: hide, items: items };
})();
