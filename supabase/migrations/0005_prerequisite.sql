-- 0005_prerequisite.sql — Prasyarat asesmen (Kuis terkunci sampai LKPD selesai)
-- Kompatibel: kolom nullable; app_access_check ditambah blok prasyarat saja.

alter table public.assessments
  add column if not exists prerequisite_assessment_id uuid references public.assessments(id);

-- cegah prasyarat menunjuk diri sendiri
alter table public.assessments
  drop constraint if exists chk_no_self_prereq,
  add constraint chk_no_self_prereq
  check (prerequisite_assessment_id is null or prerequisite_assessment_id <> id);

create index if not exists ix_assess_prereq
  on public.assessments(prerequisite_assessment_id);
create index if not exists ix_attempts_prereq_check
  on public.attempts(assessment_id, profile_id, status);

-- Recreate app_access_check dengan pemeriksaan prasyarat (logika lain TIDAK berubah)
create or replace function public.app_access_check(p_code text)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare a public.assessments; p public.profiles; pr public.collab_pairs; bl public.collab_pairs;
        g public.access_grants; solo boolean; out jsonb;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return jsonb_build_object('ok',false,'msg','Sesi tidak valid'); end if;
  select * into a from public.assessments where code = p_code and school_id = p.school_id;
  if a.id is null or a.status in ('draft','deleted') then
    return jsonb_build_object('ok',false,'msg','Asesmen tidak tersedia'); end if;

  if a.status = 'locked' then
    select * into g from public.access_grants
     where assessment_id = a.id and profile_id = p.id
       and (valid_until is null or valid_until >= current_date);
    if g.id is null then
      return jsonb_build_object('ok',false,'alasan','dikunci','msg','Asesmen dikunci'); end if;
  end if;

  -- >>> BARU: pemeriksaan prasyarat di server <<<
  if a.prerequisite_assessment_id is not null then
    if not exists (
      select 1 from public.attempts t
      where t.assessment_id = a.prerequisite_assessment_id
        and t.profile_id = p.id
        and t.status in ('submitted','graded')
    ) then
      return jsonb_build_object('ok',false,'alasan','prasyarat',
        'msg','Selesaikan asesmen prasyarat terlebih dahulu.',
        'prerequisite_code',(select code from public.assessments where id=a.prerequisite_assessment_id));
    end if;
  end if;

  select * into pr from public.collab_pairs
   where owner_id = p.id and status='approved'
     and (assessment_id = a.id or assessment_id is null) order by created_at desc limit 1;
  select * into bl from public.collab_pairs
   where partner_id = p.id and status='approved'
     and (assessment_id = a.id or assessment_id is null) order by created_at desc limit 1;
  select exists(select 1 from public.collab_pairs c
     where c.owner_id = p.id and c.status='approved' and c.note='SOLO'
       and (c.assessment_id = a.id or c.assessment_id is null)) into solo;

  out := jsonb_build_object(
    'ok', true, 'username', p.username, 'nama', p.full_name,
    'kelas', coalesce((select c.label from public.class_memberships cm
                       join public.classes c on c.id=cm.class_id
                       where cm.profile_id=p.id and cm.left_at is null limit 1),''),
    'kategori', coalesce(p.settings->>'kategori',''),
    'target', a.file_url, 'kolaborasi', a.collab_mode,
    'readOnly', a.status='archived',
    'sudahSelesai', exists(select 1 from public.attempts t
                    where t.assessment_id=a.id and t.profile_id=p.id
                      and t.status in ('submitted','graded')),
    'semester', a.semester, 'mode','normal');

  if a.status='locked' then out := out || jsonb_build_object('mode','akses-khusus'); end if;
  if bl.id is not null then
    out := out || jsonb_build_object('mode','partner-blocked',
      'blockedBy', jsonb_build_object('nama1',(select full_name from public.profiles where id=bl.owner_id)));
  elsif pr.id is not null then
    out := out || jsonb_build_object(
      'mode', case when a.collab_mode in ('required_fixed','optional_fixed') then 'fix-pair' else 'owner-approved' end,
      'pair', jsonb_build_object(
        'username2',(select username from public.profiles where id=pr.partner_id),
        'nama2',(select full_name from public.profiles where id=pr.partner_id)));
  elsif a.collab_mode in ('required','required_fixed') then
    out := out || jsonb_build_object('mode',
      case when solo then 'owner-solo'
           when a.collab_mode='required' then 'wajib-pair' else 'fix-none' end,
      'soloAllowed', (a.collab_mode='optional_fixed'));
  elsif a.collab_mode in ('optional','optional_fixed') then
    out := out || jsonb_build_object('mode',
      case when a.collab_mode='optional' then 'open' else 'fix-none' end,
      'soloAllowed', true);
  end if;
  return out;
end $$;