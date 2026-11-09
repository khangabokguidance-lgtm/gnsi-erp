-- ============================================================================
-- vendors / payers: let Accounts staff add vendors and payers
-- ============================================================================
-- Symptom this fixes (Accounts > Add expense > "+ new vendor"):
--   Could not add vendor ...: new row violates row-level security policy
--   for table "vendors"
--
-- The tables exist (the expenditure v2 migration has been run) but row-level
-- security has no policy that lets the app insert. This allows signed-in
-- staff whose portal role is Admin / Administrator / Co-Admin / Accounts /
-- Manager (the same roles the Accounts screen treats as canWrite) to insert
-- and update; everyone signed in can still read; only admins can delete.
--
-- REQUIRES 20260925_qbank_rls.sql first (it creates qbank_actor_role).
-- If the error continues, the browser has no secure session: use "Sign in
-- again" in the portal.
--
-- Safe to run more than once.
-- ============================================================================

create or replace function public.accounts_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(lower(public.qbank_actor_role()) in
    ('admin', 'administrator', 'co-admin', 'accounts', 'manager'), false)
$$;

revoke all on function public.accounts_can_write() from public;
grant execute on function public.accounts_can_write() to anon, authenticated;

do $$
declare
  t text;
begin
  if to_regprocedure('public.qbank_actor_role()') is null then
    raise exception 'public.qbank_actor_role() is missing - run supabase/migrations/20260925_qbank_rls.sql first, then re-run this file.';
  end if;

  foreach t in array array['vendors', 'payers'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'public.% does not exist - skipping.', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_read_auth', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);

    execute format('create policy %I on public.%I for select to authenticated using (true)',
                   t || '_read_auth', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.accounts_can_write())',
                   t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.accounts_can_write()) with check (public.accounts_can_write())',
                   t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.qbank_is_admin())',
                   t || '_admin_delete', t);
  end loop;
end $$;
