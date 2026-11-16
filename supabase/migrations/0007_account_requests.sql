-- ============================================================================
-- 0007_account_requests.sql — permintaan perubahan akun oleh siswa
-- Menggantikan aksi legacy `siswaRequestAkun` (username / kategori) yang
-- sebelumnya ditangani Google Apps Script.
-- ============================================================================

create table if not exists public.account_requests(
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('kategori','username')),
  current_value   text,
  requested_value text not null,
  reason          text,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at      timestamptz not null default now(),
  decided_by      uuid references public.profiles(id),
  decided_at      timestamptz,
  decision_note   text
);
create index if not exists ix_acc_req_profile on public.account_requests(profile_id, status);
create index if not exists ix_acc_req_school on public.account_requests(school_id, status);

alter table public.account_requests enable row level security;

-- siswa: lihat milik sendiri; guru: lihat lingkup sekolah
create policy ar_sel on public.account_requests for select to authenticated using (
  profile_id = auth.uid()
  or (public.app_is_guru() and school_id = public.app_school())
  or public.app_is_admin()
);

-- siswa: hanya boleh membuat permintaan pending untuk dirinya sendiri
create policy ar_ins on public.account_requests for insert to authenticated with check (
  profile_id = auth.uid()
  and school_id = public.app_school()
  and status = 'pending'
);

-- keputusan hanya oleh guru/admin
create policy ar_upd on public.account_requests for update to authenticated
  using ((public.app_is_guru() and school_id = public.app_school()) or public.app_is_admin())
  with check ((public.app_is_guru() and school_id = public.app_school()) or public.app_is_admin());

-- ----------------------------------------------------------------------------
-- RPC: ajukan perubahan akun
-- ----------------------------------------------------------------------------
create or replace function public.app_request_account_change(
  p_kind text,
  p_value text,
  p_reason text default null
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  p public.profiles;
  v text;
  cur text;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then
    return jsonb_build_object('ok', false, 'msg', 'Sesi tidak valid');
  end if;

  if p_kind not in ('kategori','username') then
    return jsonb_build_object('ok', false, 'msg', 'Jenis permintaan tidak dikenal');
  end if;

  v := btrim(coalesce(p_value, ''));
  if v = '' then
    return jsonb_build_object('ok', false, 'msg', 'Nilai baru wajib diisi');
  end if;

  if p_kind = 'kategori' and v not in ('A','B','C') then
    return jsonb_build_object('ok', false, 'msg', 'Kategori harus A, B, atau C');
  end if;

  if p_kind = 'username' and v !~ '^[a-z0-9-]+$' then
    return jsonb_build_object('ok', false, 'msg', 'Username hanya boleh huruf kecil, angka, dan tanda hubung');
  end if;

  if exists (
    select 1 from public.account_requests
     where profile_id = p.id and kind = p_kind and status = 'pending'
  ) then
    return jsonb_build_object('ok', false, 'msg', 'Masih ada permintaan yang menunggu keputusan');
  end if;

  cur := case when p_kind = 'kategori'
              then coalesce(p.settings->>'kategori', '')
              else p.username end;

  insert into public.account_requests
    (school_id, profile_id, kind, current_value, requested_value, reason)
  values
    (p.school_id, p.id, p_kind, cur, v, nullif(btrim(coalesce(p_reason, '')), ''));

  return jsonb_build_object('ok', true, 'msg', 'Permintaan terkirim', 'nilaiBaru', v);
end $$;

revoke all on function public.app_request_account_change(text, text, text) from public, anon;
grant execute on function public.app_request_account_change(text, text, text) to authenticated;
