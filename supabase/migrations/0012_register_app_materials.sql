-- ============================================================================
-- 0012_register_app_materials.sql  —  DRAFT
-- Daftarkan ToolsMathPro & Kalender Pythagoras sebagai materi jenis `app`.
-- Jangan terapkan ke cloud tanpa persetujuan.
-- ============================================================================

insert into public.materials (topic_id, kind, title, url, meta, sort_order)
select t.id, 'app', 'ToolsMathPro', '/mtk/toolsmathpro/index.html',
       '{"app_code":"TOOLS-MATH","auth":"supabase","activity":true}'::jsonb, 20
from public.topics t
join public.modules m on m.id = t.module_id
join public.subjects s on s.id = m.subject_id
where s.code = 'MTK'
  and m.title = 'Teorema Pythagoras'
  and t.title = 'Konsep Dasar & Tripel Pythagoras'
  and not exists (
    select 1 from public.materials x
    where x.topic_id = t.id and x.url = '/mtk/toolsmathpro/index.html'
  );

insert into public.materials (topic_id, kind, title, url, meta, sort_order)
select t.id, 'app', 'Kalender Pythagoras 2027', '/mtk/kalender-pythagoras/index.html',
       '{"app_code":"KALENDER-PYT","auth":"supabase","activity":true}'::jsonb, 21
from public.topics t
join public.modules m on m.id = t.module_id
join public.subjects s on s.id = m.subject_id
where s.code = 'MTK'
  and m.title = 'Teorema Pythagoras'
  and t.title = 'Konsep Dasar & Tripel Pythagoras'
  and not exists (
    select 1 from public.materials x
    where x.topic_id = t.id and x.url = '/mtk/kalender-pythagoras/index.html'
  );
