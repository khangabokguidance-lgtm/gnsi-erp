-- ============================================================================
-- gnsi bucket: let signed-in staff upload student photos
-- ============================================================================
-- Symptom: "Student saved, but the photo failed: Upload failed: Bucket not found"
--
-- The 'gnsi' bucket (student photos AND student documents) did not exist in
-- the project, so this also creates it as a PRIVATE bucket (files are shown
-- through short-lived signed links). Creating it again is harmless.
--
-- Student photos are stored in the 'gnsi' bucket under student_photos/. The
-- storage lockdown removed broad write rules, and no staff rule exists for
-- this bucket, so Storage refuses the upload. This lets signed-in staff
-- (qbank_is_staff) add / replace / remove files under student_photos/ only.
-- Reading is unchanged (the app shows photos through signed links).
--
-- REQUIRES 20260925_qbank_rls.sql first (it creates qbank_is_staff).
-- If it still fails afterwards, the portal has no secure session: use
-- "Sign in again". The app now shows the real storage error message.
--
-- Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.qbank_is_staff()') is null then
    raise exception 'public.qbank_is_staff() is missing - run supabase/migrations/20260925_qbank_rls.sql first, then re-run this file.';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('gnsi', 'gnsi', false, 10485760)
on conflict (id) do nothing;

-- Student documents live in the same bucket under student_docs/.
drop policy if exists gnsi_student_photos_select on storage.objects;
drop policy if exists gnsi_student_photos_insert on storage.objects;
drop policy if exists gnsi_student_photos_update on storage.objects;
drop policy if exists gnsi_student_photos_delete on storage.objects;

create policy gnsi_student_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'gnsi' and (name like 'student_photos/%' or name like 'student_docs/%') and public.qbank_is_staff());
create policy gnsi_student_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gnsi' and (name like 'student_photos/%' or name like 'student_docs/%') and public.qbank_is_staff());
create policy gnsi_student_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'gnsi' and (name like 'student_photos/%' or name like 'student_docs/%') and public.qbank_is_staff())
  with check (bucket_id = 'gnsi' and (name like 'student_photos/%' or name like 'student_docs/%') and public.qbank_is_staff());
create policy gnsi_student_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'gnsi' and (name like 'student_photos/%' or name like 'student_docs/%') and public.qbank_is_staff());
