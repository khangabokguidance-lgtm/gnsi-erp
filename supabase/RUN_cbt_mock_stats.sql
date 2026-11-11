-- Run this once in the Supabase SQL editor (same as migrations/20261121_cbt_mock_stats.sql).
-- ────────────────────────────────────────────────────────────────────────────
-- Static mock tests: how many people looked at a mock (views) and how many started it (appeared).
-- The mock itself runs in the browser and saves nothing; this adds only two tiny counters per mock.
--   cbt_mock_stats          one row per mock slug (views, starts). No policies: the public never reads or writes it directly.
--   cbt_mock_hit(slug,kind) +1 on 'view' or 'start'. The page sends it at most once per device per day (view) / per mock (start).
--   cbt_mock_stats()        every mock's counters in one small read, for the exam page.
-- Counters are approximate (one device = one count; clearing the browser counts again). At most 200 mocks are tracked.
-- Safe to run more than once.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.cbt_mock_stats (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  views bigint not null default 0,
  starts bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.cbt_mock_stats enable row level security;

create or replace function public.cbt_mock_hit(p_slug text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,60}$' or p_kind not in ('view', 'start') then return; end if;
  if not exists (select 1 from public.cbt_mock_stats where slug = p_slug) and (select count(*) from public.cbt_mock_stats) >= 200 then return; end if;
  insert into public.cbt_mock_stats as s (slug, views, starts)
  values (p_slug, case when p_kind = 'view' then 1 else 0 end, case when p_kind = 'start' then 1 else 0 end)
  on conflict (slug) do update
    set views = s.views + case when p_kind = 'view' then 1 else 0 end,
        starts = s.starts + case when p_kind = 'start' then 1 else 0 end,
        updated_at = now();
end;
$$;

create or replace function public.cbt_mock_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(slug, jsonb_build_object('views', views, 'starts', starts)), '{}'::jsonb)
  from public.cbt_mock_stats;
$$;

revoke all on function public.cbt_mock_hit(text, text) from public;
revoke all on function public.cbt_mock_stats() from public;
grant execute on function public.cbt_mock_hit(text, text) to anon, authenticated;
grant execute on function public.cbt_mock_stats() to anon, authenticated;
