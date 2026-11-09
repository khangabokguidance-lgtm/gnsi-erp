-- ============================================================================
-- Model Sets: JNV-style practice papers made in Learning Hub → Model Sets
-- ============================================================================
-- Each row is one model set (practice paper). The whole paper (sections,
-- questions, answer key, passages, picture links) is one JSON document in
-- `data`, written by the set maker page (public/model-papers/…html) through
-- src/modelSetsBridge.js. Built-in Set 1 lives in that page, not here.
--
-- WHO CAN DO WHAT
--   read:                  signed-in staff (the secure Supabase session).
--                          Not the public website: sets hold answer keys.
--   insert/update/delete:  linked staff (public.qbank_is_staff()). The
--                          Admin → Permissions matrix ("Model Sets") decides
--                          who sees the maker buttons in the portal.
--   pictures:              uploaded to the existing question-diagrams bucket
--                          under model-sets/ (its staff-only write rules and
--                          5 MB / image-type limits apply unchanged).
--
-- REQUIRES 20260925_qbank_rls.sql (qbank_is_staff). Safe to run more than once.
--
-- If saving says "your login is not allowed to change sets", the browser has
-- no secure session: look for the "Secure database connection is off" banner
-- in the portal and use "Sign in again".
-- ============================================================================

do $$
begin
  if to_regprocedure('public.qbank_is_staff()') is null then
    raise exception 'public.qbank_is_staff() is missing - run supabase/migrations/20260925_qbank_rls.sql first, then re-run this file.';
  end if;
end $$;

create table if not exists public.model_sets (
  id          text primary key,
  data        jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A whole paper with 80 text questions is about 40 KB; pictures are links.
-- The cap stops a runaway document (for example pasted image data).
alter table public.model_sets drop constraint if exists model_sets_data_size;
alter table public.model_sets add constraint model_sets_data_size check (pg_column_size(data) < 1048576);

alter table public.model_sets enable row level security;

drop policy if exists model_sets_read_staff   on public.model_sets;
drop policy if exists model_sets_insert_staff on public.model_sets;
drop policy if exists model_sets_update_staff on public.model_sets;
drop policy if exists model_sets_delete_staff on public.model_sets;

create policy model_sets_read_staff on public.model_sets
  for select to authenticated using (true);
create policy model_sets_insert_staff on public.model_sets
  for insert to authenticated with check (public.qbank_is_staff());
create policy model_sets_update_staff on public.model_sets
  for update to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
create policy model_sets_delete_staff on public.model_sets
  for delete to authenticated using (public.qbank_is_staff());

grant select, insert, update, delete on public.model_sets to authenticated;
revoke all on public.model_sets from anon;

-- Live updates: other staff see a saved set without reloading.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'model_sets'
     ) then
    execute 'alter publication supabase_realtime add table public.model_sets';
  end if;
end $$;
