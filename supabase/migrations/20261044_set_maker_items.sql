-- ============================================================================
-- Model Set Maker: questions and reading passages staff add to the
-- Navodaya model set generator (Learning Hub → Model Set Maker)
-- ============================================================================
-- The maker page (public/model-papers/navodaya-model-set-maker.html) has its
-- own built-in bank. Questions staff paste in are kept here, through
-- src/setMakerBridge.js, one JSON document per row:
--   collection = 'questions' → { section: 'evs'|'arith', q, o[4], a, at }
--   collection = 'passages'  → { text, qs[5], at }
--
-- WHO CAN DO WHAT
--   read:                  signed-in staff (the secure Supabase session).
--                          Not the public website: rows hold answers.
--   insert/delete:         linked staff (public.qbank_is_staff()). The
--                          Admin → Permissions matrix ("Model Set Maker")
--                          decides who sees the add / delete buttons.
--
-- REQUIRES 20260925_qbank_rls.sql (qbank_is_staff). Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.qbank_is_staff()') is null then
    raise exception 'public.qbank_is_staff() is missing - run supabase/migrations/20260925_qbank_rls.sql first, then re-run this file.';
  end if;
end $$;

create table if not exists public.set_maker_items (
  id          text primary key,
  collection  text not null check (collection in ('questions', 'passages')),
  data        jsonb not null check (jsonb_typeof(data) = 'object'),
  created_by  text,
  created_at  timestamptz not null default now()
);

-- A passage is capped at 4,000 characters by the page; this stops a runaway row.
alter table public.set_maker_items drop constraint if exists set_maker_items_data_size;
alter table public.set_maker_items add constraint set_maker_items_data_size check (pg_column_size(data) < 65536);

create index if not exists set_maker_items_collection_idx on public.set_maker_items (collection, created_at);

alter table public.set_maker_items enable row level security;

drop policy if exists set_maker_items_read_staff   on public.set_maker_items;
drop policy if exists set_maker_items_insert_staff on public.set_maker_items;
drop policy if exists set_maker_items_delete_staff on public.set_maker_items;

create policy set_maker_items_read_staff on public.set_maker_items
  for select to authenticated using (true);
create policy set_maker_items_insert_staff on public.set_maker_items
  for insert to authenticated with check (public.qbank_is_staff());
create policy set_maker_items_delete_staff on public.set_maker_items
  for delete to authenticated using (public.qbank_is_staff());

grant select, insert, delete on public.set_maker_items to authenticated;
revoke all on public.set_maker_items from anon;

-- Live updates: other staff see an added question without reloading.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'set_maker_items'
     ) then
    execute 'alter publication supabase_realtime add table public.set_maker_items';
  end if;
end $$;
