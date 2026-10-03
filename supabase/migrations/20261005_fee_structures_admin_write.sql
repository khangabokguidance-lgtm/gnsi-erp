-- ============================================================================
-- fee_structures: let admins save fees from Fee Setup
-- ============================================================================
-- Symptom this fixes (red message in Fee Setup when pressing Save):
--   new row violates row-level security policy for table "fee_structures"
--
-- fee_structures has row-level security switched on, but no policy that lets
-- the app write to it, so Fee Setup can read the fee table but every save is
-- refused. This adds write policies (insert / update / delete) for ADMINS only:
-- public.qbank_is_admin() recognises the signed-in staff member as Admin,
-- Administrator or Co-Admin from portal_users. Fee amounts are money settings,
-- so ordinary staff and the public website cannot change them.
--
-- Reading is NOT touched: it already works (the website and billing read the
-- fee table), and no read policy is added or removed here.
--
-- REQUIRES 20260925_qbank_rls.sql first (it creates qbank_is_admin). If that
-- helper is missing this stops with an error instead of opening the table up.
--
-- If the error continues after running this, the browser has no secure
-- session: look for the "Secure database connection is off" banner in the
-- portal and use "Sign in again".
--
-- Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regclass('public.fee_structures') is null then
    raise notice 'public.fee_structures does not exist - nothing to do.';
    return;
  end if;

  if to_regprocedure('public.qbank_is_admin()') is null then
    raise exception 'public.qbank_is_admin() is missing - run supabase/migrations/20260925_qbank_rls.sql first, then re-run this file.';
  end if;

  execute 'alter table public.fee_structures enable row level security';

  execute 'drop policy if exists fee_structures_admin_insert on public.fee_structures';
  execute 'drop policy if exists fee_structures_admin_update on public.fee_structures';
  execute 'drop policy if exists fee_structures_admin_delete on public.fee_structures';

  execute 'create policy fee_structures_admin_insert on public.fee_structures
             for insert to authenticated with check (public.qbank_is_admin())';
  execute 'create policy fee_structures_admin_update on public.fee_structures
             for update to authenticated using (public.qbank_is_admin()) with check (public.qbank_is_admin())';
  execute 'create policy fee_structures_admin_delete on public.fee_structures
             for delete to authenticated using (public.qbank_is_admin())';
end $$;
