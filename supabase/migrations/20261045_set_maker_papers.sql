-- ============================================================================
-- Model Set Maker: PDFs kept in the portal
-- ============================================================================
-- The maker (Learning Hub → Model Set Maker) can keep a copy of each question
-- paper, answer key and OMR sheet it makes, and staff can upload PDFs of
-- their own. The files go in the private 'set-maker-papers' bucket under
-- papers/; each one is listed by a row in set_maker_items with
-- collection = 'papers' → { filename, path, size, kind, setno, code, at, by }.
--
-- WHO CAN DO WHAT
--   read / download:  signed-in staff (the secure Supabase session).
--                     Not the public website: papers come with answer keys.
--   upload / delete:  linked staff (public.qbank_is_staff()). The Admin →
--                     Permissions matrix ("Model Set Maker", add or edit)
--                     decides who sees the buttons.
--
-- REQUIRES 20261044_set_maker_items.sql (and so 20260925_qbank_rls.sql).
-- Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regclass('public.set_maker_items') is null then
    raise exception 'public.set_maker_items is missing - run supabase/migrations/20261044_set_maker_items.sql first, then re-run this file.';
  end if;
end $$;

-- The list of saved papers lives beside the questions and passages.
alter table public.set_maker_items drop constraint if exists set_maker_items_collection_check;
alter table public.set_maker_items add constraint set_maker_items_collection_check
  check (collection in ('questions', 'passages', 'papers'));

-- Private bucket: PDFs only, up to 20 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('set-maker-papers', 'set-maker-papers', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists set_maker_papers_select on storage.objects;
drop policy if exists set_maker_papers_insert on storage.objects;
drop policy if exists set_maker_papers_delete on storage.objects;

create policy set_maker_papers_select on storage.objects
  for select to authenticated
  using (bucket_id = 'set-maker-papers');
create policy set_maker_papers_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'set-maker-papers' and name like 'papers/%' and public.qbank_is_staff());
create policy set_maker_papers_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'set-maker-papers' and public.qbank_is_staff());
