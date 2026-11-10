-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- CBT practice copies: a PUBLIC storage bucket the exam page reads straight from the CDN (no database tables touched), so
-- any number of students can practise a closed exam. Staff write to it from CBT → Online → Publish ("Publish practice copy").
-- Safe to run more than once.
--   bucket cbt-practice : public read · JSON only · 10 MB per file · upload / replace / delete: staff only
--   The files hold a paper WITH its answer key, so publish one only after the exam has closed.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cbt-practice', 'cbt-practice', true, 10485760, array['application/json'])
on conflict (id) do update
  set public = true, file_size_limit = 10485760, allowed_mime_types = array['application/json'];

drop policy if exists cbt_practice_write_base   on storage.objects;
drop policy if exists cbt_practice_insert_staff on storage.objects;
drop policy if exists cbt_practice_update_staff on storage.objects;
drop policy if exists cbt_practice_delete_staff on storage.objects;

create policy cbt_practice_write_base on storage.objects
  for all to authenticated
  using (bucket_id = 'cbt-practice') with check (bucket_id = 'cbt-practice');
-- restrictive policies apply to every bucket, so each one lets other buckets through untouched
create policy cbt_practice_insert_staff on storage.objects
  as restrictive for insert to public
  with check (bucket_id <> 'cbt-practice' or public.qbank_is_staff());
create policy cbt_practice_update_staff on storage.objects
  as restrictive for update to public
  using (bucket_id <> 'cbt-practice' or public.qbank_is_staff())
  with check (bucket_id <> 'cbt-practice' or public.qbank_is_staff());
create policy cbt_practice_delete_staff on storage.objects
  as restrictive for delete to public
  using (bucket_id <> 'cbt-practice' or public.qbank_is_staff());
