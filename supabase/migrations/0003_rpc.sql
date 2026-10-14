-- ============================================================================
-- 0003_rpc.sql — RPC penilaian & gerbang akses (server-side, anti-cheat skor)
-- Semua fungsi: search_path terkunci, grant hanya authenticated.
-- ============================================================================

-- ---------- Gerbang akses LKPD (pengganti validateAccess) ----------
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

  select * into pr from public.collab_pairs
   where owner_id = p.id and status='approved'
     and (assessment_id = a.id or assessment_id is null) order by created_at desc limit 1;
  select * into bl from public.collab_pairs
   where partner_id = p.id and status='approved'
     and (assessment_id = a.id or assessment_id is null) order by created_at desc limit 1;
  select exists(select 1 from public.collab_pairs c
     where c.owner_id=p.id and c.partner_id='00000000-0000-0000-0000-000000000000'::uuid) into solo; -- placeholder tak dipakai
  select exists(select 1 from public.collab_pairs c
     where c.owner_id = p.id and c.status='approved' and c.note = 'SOLO'
       and (c.assessment_id = a.id or c.assessment_id is null)) into solo;

  out := jsonb_build_object(
    'ok', true, 'username', p.username, 'nama', p.full_name, 'kelas', coalesce((select c.label from public.class_memberships cm join public.classes c on c.id=cm.class_id where cm.profile_id=p.id and cm.left_at is null limit 1),''),
    'kategori', coalesce(p.settings->>'kategori',''), 'target', a.file_url,
    'kolaborasi', a.collab_mode, 'readOnly', a.status='archived',
    'sudahSelesai', exists(select 1 from public.attempts t where t.assessment_id=a.id and t.profile_id=p.id and t.status in ('submitted','graded')),
    'semester', a.semester, 'mode','normal');
  if a.status='locked' then out := out || jsonb_build_object('mode','akses-khusus'); end if;
  if bl.id is not null then out := out || jsonb_build_object('mode','partner-blocked',
      'blockedBy', jsonb_build_object('nama1',(select full_name from profiles where id=bl.owner_id)));
  elsif pr.id is not null then out := out || jsonb_build_object('mode',
      case when a.collab_mode in ('required_fixed','optional_fixed') then 'fix-pair' else 'owner-approved' end,
      'pair', jsonb_build_object('username2',(select username from profiles where id=pr.partner_id),
                                 'nama2',(select full_name from profiles where id=pr.partner_id)));
  elsif a.collab_mode in ('required','required_fixed') then
      out := out || jsonb_build_object('mode', case when solo then 'owner-solo'
             when a.collab_mode='required' then 'wajib-pair' else 'fix-none' end,
             'soloAllowed', a.collab_mode='optional_fixed');
  elsif a.collab_mode in ('optional','optional_fixed') then
      out := out || jsonb_build_object('mode', case when a.collab_mode='optional' then 'open' else 'fix-none' end,
             'soloAllowed', true);
  end if;
  return out;
end $$;

-- ---------- Mulai percobaan (idempoten, anti double-submit) ----------
create or replace function public.app_start_attempt(p_code text, p_partner uuid default null, p_source text default 'portal')
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a public.assessments; p public.profiles; n int; aid uuid; chk jsonb;
begin
  select * into p from public.profiles where id = auth.uid();
  select * into a from public.assessments where code = p_code and school_id = p.school_id;
  if a.id is null or a.status in ('draft','deleted') then return jsonb_build_object('ok',false,'msg','Asesmen tidak tersedia'); end if;
  if a.status = 'archived' then return jsonb_build_object('ok',false,'msg','Mode baca'); end if;
  chk := public.app_access_check(p_code);
  if (chk->>'ok') <> 'true' then return chk; end if;
  if a.status='locked' and (chk->>'mode') <> 'akses-khusus' then
    return jsonb_build_object('ok',false,'msg','Dikunci'); end if;
  if a.collab_mode in ('required','required_fixed') and (chk->>'mode') in ('wajib-pair','fix-none')
     and p_partner is null then
    return jsonb_build_object('ok',false,'msg','Kolaborasi wajib: pilih pasangan dahulu'); end if;

  select coalesce(max(attempt_no),0)+1 into n from public.attempts
   where assessment_id = a.id and profile_id = p.id;
  insert into public.attempts (assessment_id, profile_id, partner_id, attempt_no, status, source)
  values (a.id, p.id, p_partner, n, 'in_progress', p_source)
  on conflict (assessment_id, profile_id, attempt_no) do nothing
  returning id into aid;
  if aid is null then
    select id into aid from public.attempts
     where assessment_id=a.id and profile_id=p.id and attempt_no=n;
  end if;
  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id)
  values (p.school_id, p.id, 'start_attempt', 'attempts', aid::text);
  return jsonb_build_object('ok',true,'attemptId',aid,'attemptNo',n);
end $$;

-- ---------- Simpan jawaban (hanya selama in_progress, hanya pemilik) ----------
create or replace function public.app_save_answers(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.attempts; k text;
begin
  select * into a from public.attempts where id = p_attempt;
  if a.id is null or a.profile_id <> auth.uid() then
    return jsonb_build_object('ok',false,'msg','Bukan milik Anda'); end if;
  if a.status <> 'in_progress' then
    return jsonb_build_object('ok',false,'msg','Percobaan sudah ditutup'); end if;
  for k in select key from jsonb_object_keys(p_answers) as key loop
    insert into public.attempt_answers (attempt_id, item_key, response)
    values (p_attempt, k, p_answers->k)
    on conflict (attempt_id, item_key)
    do update set response = excluded.response, updated_at = now();
  end loop;
  return jsonb_build_object('ok',true);
end $$;

-- ---------- Penilaian server-side (TIDAK percaya skor klien) ----------
create or replace function public.app_score_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.attempts; asmt public.assessments; it public.question_items;
        raw numeric := 0; maxw numeric := 0; item_score numeric; frac numeric;
        resp jsonb; arr jsonb; keyarr jsonb; i int; tol numeric; tot numeric; got numeric;
        cls uuid; yr uuid; final numeric;
begin
  select * into a from public.attempts where id = p_attempt;
  if a.id is null then return jsonb_build_object('ok',false,'msg','Percobaan tidak ditemukan'); end if;
  if a.profile_id <> auth.uid()
     and not public.app_guru_scope_assessment(a.assessment_id) then
    return jsonb_build_object('ok',false,'msg','Tidak berwenang'); end if;
  if a.status not in ('in_progress','submitted') then
    return jsonb_build_object('ok',false,'msg','Sudah dinilai'); end if;
  select * into asmt from public.assessments where id = a.assessment_id;

  for it in select * from public.question_items where assessment_id = asmt.id order by sort_order loop
    maxw := maxw + it.weight;
    select response into resp from public.attempt_answers where attempt_id = a.id and item_key = it.item_key;
    if resp is null then
      update public.attempt_answers set is_correct=false, score=0, checked_by='auto', checked_at=now()
       where attempt_id=a.id and item_key=it.item_key;
      continue;
    end if;
    item_score := 0; frac := 0;
    if it.kind = 'num' then
      tol := coalesce((it.payload->>'tol')::numeric, 0);
      if abs((resp->>'value')::numeric - (it.payload->>'answer')::numeric) <= tol then frac := 1; end if;
    elsif it.kind in ('mc','bs') then
      if lower(btrim(resp->>'value')) = lower(btrim(it.payload->>'key')) then frac := 1; end if;
    elsif it.kind = 'match' then
      keyarr := it.payload->'keys'; arr := resp->'values'; tot := 0; got := 0;
      for i in 0..jsonb_array_length(keyarr)-1 loop
        tot := tot + 1;
        if arr is not null and (arr->>i) = (keyarr->>i) then got := got + 1; end if;
      end loop;
      if tot > 0 then frac := got/tot; end if;
    elsif it.kind = 'scaffold' then
      keyarr := it.payload->'answers'; arr := resp->'values'; tol := coalesce((it.payload->>'tol')::numeric, 0);
      tot := 0; got := 0;
      for i in 0..jsonb_array_length(keyarr)-1 loop
        tot := tot + 1;
        if arr is not null and arr->i is not null
           and abs((arr->>i)::numeric - (keyarr->>i)::numeric) <= tol then got := got + 1; end if;
      end loop;
      if tot > 0 then frac := got/tot; end if;
    else -- text/legacy: dinilai guru
      update public.attempt_answers set is_correct=null, checked_by='guru', checked_at=now()
       where attempt_id=a.id and item_key=it.item_key;
      continue;
    end if;
    item_score := it.weight * frac;
    raw := raw + item_score;
    update public.attempt_answers
       set is_correct = (frac = 1), score = item_score, checked_by='auto', checked_at=now()
     where attempt_id=a.id and item_key=it.item_key;
  end loop;

  final := case when maxw > 0 then round(raw/maxw*100) else 0 end;
  update public.attempts set status='graded', submitted_at = coalesce(submitted_at, now()) where id = a.id;

  select cm.class_id, c.academic_year_id into cls, yr
    from public.class_memberships cm join public.classes c on c.id = cm.class_id
   where cm.profile_id = a.profile_id and cm.left_at is null limit 1;
  insert into public.gradebook_entries
    (school_id, academic_year_id, class_id, profile_id, entry_kind, assessment_id, score, max_score, source, created_by)
  values (asmt.school_id, yr, cls, a.profile_id, 'assessment', asmt.id, final, 100, 'auto', auth.uid())
  on conflict on constraint gradebook_entries_pkey do nothing;
  -- upsert unik per (assessment,profile,entry_kind assessment):
  update public.gradebook_entries g set score = final, updated_at = now()
   where g.assessment_id = asmt.id and g.profile_id = a.profile_id and g.entry_kind='assessment';
  if not found then
    insert into public.gradebook_entries
      (school_id, academic_year_id, class_id, profile_id, entry_kind, assessment_id, score, max_score, source, created_by)
    values (asmt.school_id, yr, cls, a.profile_id, 'assessment', asmt.id, final, 100, 'auto', auth.uid());
  end if;

  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (asmt.school_id, auth.uid(), 'score_attempt','attempts', a.id::text, jsonb_build_object('score',final));
  return jsonb_build_object('ok',true,'score',final,'raw',raw,'max',maxw);
end $$;

-- ---------- Kompatibilitas LKPD lama: simpan mentah, TANPA percaya skor klien ----------
create or replace function public.app_submit_legacy(p_code text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.assessments; p public.profiles; n int; aid uuid; yr uuid; cls uuid;
begin
  select * into p from public.profiles where id = auth.uid();
  select * into a from public.assessments
    where (code = p_code or legacy_code = p_code) and school_id = p.school_id;
  if a.id is null then return jsonb_build_object('ok',false,'msg','Kode tidak dikenal'); end if;
  select coalesce(max(attempt_no),0)+1 into n from public.attempts
   where assessment_id=a.id and profile_id=p.id;
  n := greatest(n, coalesce((p_payload->>'percobaan')::int, 1));
  insert into public.attempts (assessment_id, profile_id, partner_id, attempt_no, status,
                               client_duration_sec, source, submitted_at, flags)
  values (a.id, p.id,
          (select id from public.profiles where username = p_payload->>'username2' and school_id=p.school_id),
          n, 'submitted', null, 'legacy', now(),
          jsonb_build_object('fullscreen', coalesce((p_payload->>'pelanggaranFullscreen')::int,0),
                             'tab', coalesce((p_payload->>'pelanggaranTab')::int,0),
                             'copy', coalesce((p_payload->>'pelanggaranCopy')::int,0)))
  on conflict (assessment_id, profile_id, attempt_no) do update
     set status='submitted', submitted_at=now(), flags=excluded.flags
  returning id into aid;
  insert into public.attempt_answers (attempt_id, item_key, response, checked_by)
  values (aid, 'legacy_raw', p_payload, 'guru')
  on conflict (attempt_id, item_key) do update set response=excluded.response, updated_at=now();

  select cm.class_id, c.academic_year_id into cls, yr
    from public.class_memberships cm join public.classes c on c.id=cm.class_id
   where cm.profile_id=p.id and cm.left_at is null limit 1;
  insert into public.gradebook_entries
    (school_id, academic_year_id, class_id, profile_id, entry_kind, assessment_id, score, source, note, created_by)
  values (a.school_id, yr, cls, p.id, 'assessment', a.id, null, 'legacy_pending',
          'Menunggu scorer server per-kode (Tahap 5)', auth.uid())
  on conflict do nothing;
  update public.gradebook_entries set score=null, source='legacy_pending', updated_at=now()
   where assessment_id=a.id and profile_id=p.id and entry_kind='assessment';

  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (a.school_id, p.id, 'submit_legacy','attempts', aid::text, jsonb_build_object('code',a.code));
  return jsonb_build_object('ok',true,'status','ok','attemptId',aid);
end $$;

-- ---------- Ingest aktifitas dengan cap 30/150/3 ----------
create or replace function public.app_ingest_activity(p_app text, p_section text, p_kind text, p_duration int, p_score numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.profiles; mn int; mx int; cap int; cnt int; d int;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return jsonb_build_object('ok',false); end if;
  mn  := coalesce((select (s.settings->'activity'->>'min_sec')::int from public.schools s where s.id=p.school_id),30);
  mx  := coalesce((select (s.settings->'activity'->>'max_sec')::int from public.schools s where s.id=p.school_id),150);
  cap := coalesce((select (s.settings->'activity'->>'max_per_day')::int from public.schools s where s.id=p.school_id),3);
  d := p_duration;
  if p_kind = 'section' then
    if d < mn then return jsonb_build_object('ok',false,'msg','di bawah minimum'); end if;
    d := least(d, mx);
    select count(*) into cnt from public.activity_logs
     where profile_id=p.id and app_code=p_app and section=p_section and kind='section'
       and log_date = (now() at time zone 'Asia/Jakarta')::date;
    if cnt >= cap then return jsonb_build_object('ok',false,'msg','cap harian tercapai'); end if;
  end if;
  insert into public.activity_logs (school_id, profile_id, app_code, section, kind, duration_sec, score)
  values (p.school_id, p.id, p_app, p_section, p_kind, d, p_score);
  return jsonb_build_object('ok',true);
end $$;

-- ---------- Verifikasi password legacy (migrasi login) ----------
create or replace function public.app_verify_legacy_password(p_username text, p_password text)
returns boolean language plpgsql security definer set search_path = public as $$
declare h text;
begin
  select legacy_password_hash into h from public.profiles
   where username = p_username and school_id = public.app_school();
  if h is null then return false; end if;
  insert into public.audit_logs (school_id, actor_id, action, entity, entity_id)
  values (public.app_school(), auth.uid(), 'legacy_pw_check','profiles',p_username);
  return h = encode(digest(p_password,'sha256'),'hex');
end $$;

-- ---------- Grants ----------
revoke all on function public.app_access_check(text) from public, anon;
revoke all on function public.app_start_attempt(text, uuid, text) from public, anon;
revoke all on function public.app_save_answers(uuid, jsonb) from public, anon;
revoke all on function public.app_score_attempt(uuid) from public, anon;
revoke all on function public.app_submit_legacy(text, jsonb) from public, anon;
revoke all on function public.app_ingest_activity(text,text,text,int,numeric) from public, anon;
revoke all on function public.app_verify_legacy_password(text,text) from public, anon;
grant execute on function public.app_access_check(text) to authenticated;
grant execute on function public.app_start_attempt(text, uuid, text) to authenticated;
grant execute on function public.app_save_answers(uuid, jsonb) to authenticated;
grant execute on function public.app_score_attempt(uuid) to authenticated;
grant execute on function public.app_submit_legacy(text, jsonb) to authenticated;
grant execute on function public.app_ingest_activity(text,text,text,int,numeric) to authenticated;
grant execute on function public.app_verify_legacy_password(text,text) to authenticated;