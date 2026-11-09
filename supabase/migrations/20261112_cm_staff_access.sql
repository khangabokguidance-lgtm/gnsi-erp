-- ============================================================================
-- 20261112_cm_staff_access.sql — Construction & Maintenance: staff access rules
--
-- Fixes: "Could not save: new row violates row-level security policy for table
-- "cm_projects"". The cm_* tables have row-level security on but no rule that lets a
-- signed-in portal user write to them.
--
-- For EVERY table whose name starts with cm_ (projects, payments, milestones,
-- activity log, contractors, maintenance, …):
--   read / add / change : any signed-in staff user (the app already limits who can open
--                         the module and who is view-only)
--   delete              : admins only
--
-- Needs 20260925_qbank_rls.sql (qbank_is_staff / qbank_is_admin).
-- Safe to run more than once. It only ADDS rules named cm_staff_*; it removes nothing else.
-- ============================================================================
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'cm\_%' escape '\' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists cm_staff_select on public.%I', t);
    execute format('drop policy if exists cm_staff_insert on public.%I', t);
    execute format('drop policy if exists cm_staff_update on public.%I', t);
    execute format('drop policy if exists cm_admin_delete on public.%I', t);
    execute format('create policy cm_staff_select on public.%I for select to authenticated using (public.qbank_is_staff())', t);
    execute format('create policy cm_staff_insert on public.%I for insert to authenticated with check (public.qbank_is_staff())', t);
    execute format('create policy cm_staff_update on public.%I for update to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff())', t);
    execute format('create policy cm_admin_delete on public.%I for delete to authenticated using (public.qbank_is_admin())', t);
    raise notice 'Access rules set on %', t;
  end loop;
end $$;
