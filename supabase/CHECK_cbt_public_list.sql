-- ────────────────────────────────────────────────────────────────────────────
-- Why is a test not showing under "Tests open now" on the exam page?   (read-only — it changes nothing)
-- Paste the whole file into the Supabase SQL editor and press Run. You get TWO result tables.
--   Table 1: is the database update installed?   Table 2: every test and the reason it is / is not listed.
-- ────────────────────────────────────────────────────────────────────────────

-- 1) setup: all three should say yes
select
  to_regprocedure('public.cbt_public_tests()') is not null as "list function installed (RUN_cbt_public_list.sql)",
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cbt_tests' and column_name = 'public_list') as "public_list column exists",
  (select count(*) from public.cbt_tests) as "tests in the database";

-- 2) each test and why it is (not) listed
select
  t.name as "test",
  t.status as "status",
  t.opens_at as "opens at",
  t.closes_at as "closes at",
  coalesce(to_jsonb(t) ->> 'public_list', 'column missing → treated as listed') as "show on public page",
  case
    when t.status <> 'live' then 'NOT LISTED — status is "' || t.status || '" (it must be live: publish it in CBT → Online)'
    when t.closes_at is not null and t.closes_at <= now() then 'NOT LISTED — the closing time has passed'
    when t.opens_at is not null and t.opens_at >= now() + interval '60 days' then 'NOT LISTED — it opens more than 60 days from now'
    when coalesce(to_jsonb(t) ->> 'public_list', 'true') = 'false' then 'NOT LISTED — "Show on the public exam page" is unticked (CBT → Online → Publish)'
    when to_regprocedure('public.cbt_public_tests()') is null then 'WOULD BE LISTED — but the list function is not installed: run RUN_cbt_public_list.sql'
    else 'LISTED (' || case when t.opens_at is not null and t.opens_at > now() then 'under Upcoming' else 'under Open now' end || ')'
  end as "result"
from public.cbt_tests t
order by t.created_at desc;
