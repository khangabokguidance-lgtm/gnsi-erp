-- Class Material: make "admin uploads, staff only view" true in the DATABASE, not only in the screen.
-- Reads: any signed-in staff member.  Writes (upload / hide / delete): Admin, Administrator, Co-Admin only.
-- Anonymous visitors (the public website) get nothing.
-- REQUIRES 20260925_qbank_rls.sql (qbank_is_staff / qbank_is_admin) and 20261056_class_materials.sql.
-- Safe to run more than once.
do $$
begin
  if to_regprocedure('public.qbank_is_admin()') is null then
    raise exception 'public.qbank_is_admin() is missing - run supabase/migrations/20260925_qbank_rls.sql first, then re-run this file.';
  end if;
end $$;

alter table public.class_materials enable row level security;
drop policy if exists class_materials_read on public.class_materials;
drop policy if exists class_materials_write on public.class_materials;
drop policy if exists class_materials_read_staff on public.class_materials;
drop policy if exists class_materials_insert_admin on public.class_materials;
drop policy if exists class_materials_update_admin on public.class_materials;
drop policy if exists class_materials_delete_admin on public.class_materials;

create policy class_materials_read_staff on public.class_materials
  for select to authenticated using (public.qbank_is_staff());
create policy class_materials_insert_admin on public.class_materials
  for insert to authenticated with check (public.qbank_is_admin());
create policy class_materials_update_admin on public.class_materials
  for update to authenticated using (public.qbank_is_admin()) with check (public.qbank_is_admin());
create policy class_materials_delete_admin on public.class_materials
  for delete to authenticated using (public.qbank_is_admin());
grant select, insert, update, delete on public.class_materials to authenticated;
revoke all on public.class_materials from anon;

-- the files themselves (private bucket)
drop policy if exists class_materials_files on storage.objects;
drop policy if exists class_materials_files_read on storage.objects;
drop policy if exists class_materials_files_insert on storage.objects;
drop policy if exists class_materials_files_update on storage.objects;
drop policy if exists class_materials_files_delete on storage.objects;
create policy class_materials_files_read on storage.objects
  for select to authenticated using (bucket_id = 'class-materials' and public.qbank_is_staff());
create policy class_materials_files_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'class-materials' and public.qbank_is_admin());
create policy class_materials_files_update on storage.objects
  for update to authenticated using (bucket_id = 'class-materials' and public.qbank_is_admin()) with check (bucket_id = 'class-materials' and public.qbank_is_admin());
create policy class_materials_files_delete on storage.objects
  for delete to authenticated using (bucket_id = 'class-materials' and public.qbank_is_admin());
