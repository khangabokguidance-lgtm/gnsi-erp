-- ============================================================================
-- Phase 2b — storage lockdown
-- ============================================================================
-- Fixes the security finding "5 file rule(s) let the public upload, replace
-- or delete files":
--   store-images upload, store-images update          (real hole)
--   qbank_diagrams_insert/update/delete_staff          (flagged, see below)
--
-- store-images
--   The Store page (staff only) uploads product photos here. The existing
--   "store-images upload/update" rules (created outside this repo, likely by
--   store_listing.sql) let anyone with the public anon key write to the
--   bucket. After this runs: anyone may still VIEW photos (the bucket stays
--   public, product pages use getPublicUrl), but only signed-in staff may
--   upload / replace / delete, and only JPEG/PNG/WebP up to 5 MB.
--
-- question-diagrams
--   20260925_qbank_rls.sql guarded this bucket with RESTRICTIVE rules
--   "to public". Restrictive rules can only narrow access, so they never
--   let the public in — but scanners read "insert/update/delete to public"
--   as open. They are replaced by explicit permissive rules for signed-in
--   staff only, and the catch-all "authenticated may do anything in this
--   bucket" base rule is removed (anyone can create a Supabase Auth account
--   while sign-ups are open, so "authenticated" alone is not staff).
--
-- "Staff" = qbank_is_staff() from 20260925_qbank_rls.sql: the signed-in
-- Supabase Auth email maps back to a portal_users row. Staff whose login
-- console shows "Supabase Auth link skipped" have no such session and will
-- no longer be able to upload photos or diagrams — check that first.
--
-- Safe to run more than once.
-- ============================================================================

begin;

-- ── 0. Staff helpers (only created if 20260925_qbank_rls.sql wasn't run) ──────
do $$
begin
  if to_regprocedure('public.qbank_is_staff()') is null then
    execute $f$
      create function public.qbank_actor_role() returns text
      language sql stable security definer set search_path = public as $b$
        select pu.role from public.portal_users pu
        where auth.uid() is not null
          and regexp_replace(lower(trim(pu.username)), '[^a-z0-9._-]', '_', 'g')
              || '.staff@guidancekhangabok.in' = lower(coalesce(auth.jwt() ->> 'email', ''))
        limit 1
      $b$ $f$;
    execute $f$
      create function public.qbank_is_staff() returns boolean
      language sql stable security definer set search_path = public as $b$
        select public.qbank_actor_role() is not null
      $b$ $f$;
    execute 'grant execute on function public.qbank_actor_role() to anon, authenticated';
    execute 'grant execute on function public.qbank_is_staff() to anon, authenticated';
  end if;
end $$;

-- ── 1. Drop every write rule that touches these two buckets ────────────────────
-- Named drops for the flagged rules, then a sweep for any other INSERT /
-- UPDATE / DELETE / ALL rule on storage.objects that mentions either bucket
-- (names vary with how they were created). Read (SELECT) rules are kept.
drop policy if exists "store-images upload"          on storage.objects;
drop policy if exists "store-images update"          on storage.objects;
drop policy if exists "store-images delete"          on storage.objects;
drop policy if exists qbank_diagrams_write_base      on storage.objects;
drop policy if exists qbank_diagrams_insert_staff    on storage.objects;
drop policy if exists qbank_diagrams_update_staff    on storage.objects;
drop policy if exists qbank_diagrams_delete_staff    on storage.objects;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(store-images|question-diagrams)'
  loop
    raise notice 'Dropping storage write rule: %', p.policyname;
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- ── 2. Bucket limits (enforced by Storage itself, not the browser) ─────────────
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'store-images';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'question-diagrams';

-- ── 3. Staff-only write rules ─────────────────────────────────────────────────
-- Postgres only lets a role UPDATE/DELETE rows it can also SELECT, so staff
-- get an explicit read rule too (the dropped qbank_diagrams_write_base was
-- "for all" and quietly provided it). Public viewing of these public
-- buckets goes through the public URL and doesn't depend on these rules.
drop policy if exists store_images_staff_select   on storage.objects;
drop policy if exists qbank_diagrams_staff_select on storage.objects;
create policy store_images_staff_select on storage.objects
  for select to authenticated
  using (bucket_id = 'store-images' and public.qbank_is_staff());
create policy qbank_diagrams_staff_select on storage.objects
  for select to authenticated
  using (bucket_id = 'question-diagrams' and public.qbank_is_staff());

create policy store_images_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-images' and public.qbank_is_staff());
create policy store_images_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'store-images' and public.qbank_is_staff())
  with check (bucket_id = 'store-images' and public.qbank_is_staff());
create policy store_images_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-images' and public.qbank_is_staff());

create policy qbank_diagrams_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-diagrams' and public.qbank_is_staff());
create policy qbank_diagrams_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'question-diagrams' and public.qbank_is_staff())
  with check (bucket_id = 'question-diagrams' and public.qbank_is_staff());
create policy qbank_diagrams_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-diagrams' and public.qbank_is_staff());

commit;

-- ── 4. Check ──────────────────────────────────────────────────────────────────
-- Every write rule left on storage.objects. For these two buckets you should
-- see only the six *_staff_* rules above, all "{authenticated}". Any other
-- row whose roles include public or anon and has no bucket/staff condition
-- is a rule for ANOTHER bucket that is still open — review it.
select policyname, roles, cmd, permissive,
       coalesce(qual, '') as using_expr, coalesce(with_check, '') as check_expr
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd <> 'SELECT'
order by policyname;
