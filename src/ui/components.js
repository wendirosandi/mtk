/* src/ui/components.js — komponen HTML bersama (tanpa framework) */
window.UI = (function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* URL aman: hanya http(s) atau path relatif/absolut tanpa skema */
  function safeUrl(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return ''; // javascript:, data:, dll
    if (s.indexOf('//') === 0) return '';
    return s;
  }

  function badge(text, tone) {
    return '<span class="badge' + (tone ? ' badge--' + tone : '') + '">' + esc(text) + '</span>';
  }

  function pageHeader(opts) {
    opts = opts || {};
    var actions = '';
    if (opts.actions) actions = '<div class="actions">' + opts.actions + '</div>';
    return '<div class="page-header">'
      + (opts.back ? '<button class="btn btn-ghost btn-sm" data-back="1" style="margin-bottom:8px">← ' + esc(opts.back) + '</button>' : '')
      + '<h1>' + esc(opts.title || '') + '</h1>'
      + (opts.subtitle ? '<p>' + esc(opts.subtitle) + '</p>' : '')
      + actions + '</div>';
  }

  function card(inner, cls) {
    return '<div class="card' + (cls ? ' ' + cls : '') + '">' + (inner || '') + '</div>';
  }

  function empty(title, hint, cta) {
    return '<div class="empty"><i class="fas fa-inbox"></i><b>' + esc(title || 'Belum ada data') + '</b>'
      + (hint ? '<div>' + esc(hint) + '</div>' : '')
      + (cta || '') + '</div>';
  }

  function skeleton(lines) {
    var n = lines || 3, out = '';
    for (var i = 0; i < n; i++) out += '<div class="skeleton" style="width:' + (90 - i * 12) + '%"></div>';
    return '<div class="card">' + out + '</div>';
  }

  function crumbs(items) {
    if (!items || !items.length) return '';
    return '<div class="crumb">' + items.map(function (it, i) {
      var node = it.route
        ? '<button type="button" data-crumb="' + esc(it.route) + '">' + esc(it.label) + '</button>'
        : '<span>' + esc(it.label) + '</span>';
      return (i ? '<span class="sep">/</span>' : '') + node;
    }).join('') + '</div>';
  }

  function statGrid(items) {
    return '<div class="stat-grid">' + (items || []).map(function (s) {
      return '<div class="stat"><div class="label">' + esc(s.label) + '</div>'
        + '<div class="value">' + esc(s.value) + '</div>'
        + (s.hint ? '<div class="card-sub">' + esc(s.hint) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function bindBack(root) {
    var el = (root || document).querySelector('[data-back]');
    if (el && history.length > 1) el.onclick = function () { history.back(); };
    (root || document).querySelectorAll('[data-crumb]').forEach(function (b) {
      b.onclick = function () { Router.go(b.dataset.crumb); };
    });
  }

  return { esc: esc, safeUrl: safeUrl, badge: badge, pageHeader: pageHeader, card: card,
           empty: empty, skeleton: skeleton, crumbs: crumbs, statGrid: statGrid, bindBack: bindBack };
})();
