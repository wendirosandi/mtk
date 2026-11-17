/* kalender-pythagoras/assets/js/lms-boot.js
   Gate sesi untuk subhalaman pembuktian. Sesi dibaca dari Supabase (same origin). */
(function () {
  'use strict';
  (async function () {
    try {
      if (!window.LMSModule) return;
      var slug = (location.pathname.split('/').pop() || 'halaman').replace('.html', '');
      var meta = await window.LMSModule.boot({
        app: 'KALENDER-PYT',
        loginUrl: '../../index.html',
        materialUrl: '/mtk/kalender-pythagoras/index.html'
      });
      if (!meta) return;
      await window.LMSModule.log('open', 'PAGE:' + slug, 30, null, { page: location.pathname });
    } catch (e) {
      console.error('[Kalender] LMS boot gagal', e);
    }
  })();
})();
