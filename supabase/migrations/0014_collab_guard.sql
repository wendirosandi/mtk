-- ============================================================================
-- 0014_collab_guard.sql
-- Mencegah siswa menyetujui pasangannya sendiri dan memastikan pasangan
-- berasal dari sekolah yang sama. Persetujuan hanya oleh guru/admin.
-- ============================================================================

create or replace function public.protect_collab_pair() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service role / job tanpa auth
  if auth.uid() is null then return new; end if;

  if public.app_is_guru() then
    if not public.app_is_admin() and new.school_id <> public.app_school() then
      raise exception 'Pasangan di luar sekolah Anda';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id <> auth.uid() then
      raise exception 'Hanya dapat mengajukan pasangan untuk diri sendiri';
    end if;
    if new.status <> 'pending' then
      raise exception 'Status awal harus pending';
    end if;
    if new.school_id <> public.app_school() then
      raise exception 'Sekolah tidak valid';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = new.partner_id and p.school_id = new.school_id and p.role = 'siswa'
    ) then
      raise exception 'Pasangan harus siswa di sekolah yang sama';
    end if;
    if exists (
      select 1 from public.collab_pairs c
      where c.owner_id = new.owner_id
        and c.assessment_id is not distinct from new.assessment_id
        and c.status in ('pending','approved')
    ) then
      raise exception 'Sudah ada permintaan/pasangan aktif untuk asesmen ini';
    end if;
    return new;
  end if;

  -- UPDATE oleh siswa (hanya pembatalan)
  if old.owner_id <> auth.uid() then
    raise exception 'Tidak berwenang mengubah pasangan ini';
  end if;
  if new.owner_id <> old.owner_id
     or new.partner_id <> old.partner_id
     or new.school_id <> old.school_id
     or new.assessment_id is distinct from old.assessment_id then
    raise exception 'Data pasangan tidak boleh diubah';
  end if;
  if not (old.status = 'pending' and new.status = 'replaced') then
    raise exception 'Hanya guru yang dapat menyetujui/menolak pasangan';
  end if;
  new.decided_at := now();
  return new;
end $$;

drop trigger if exists trg_collab_guard on public.collab_pairs;
create trigger trg_collab_guard
  before insert or update on public.collab_pairs
  for each row execute function public.protect_collab_pair();
