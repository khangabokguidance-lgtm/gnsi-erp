-- ────────────────────────────────────────────────────────────────────────────
-- Online exam: a public TOP 5 board (run after 20261117).
--   cbt_tests.top5 — a snapshot an admin publishes from CBT → Result out: the top 5 of the test (overall and per class)
--   and a few totals for the trend line. Nothing else about the results is ever readable by the public.
--   cbt_top5_list() — what the public exam page shows: the latest published snapshots, newest first.
--   Unpublishing = the admin sets top5 back to null.
-- Safe to run more than once.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.cbt_tests add column if not exists top5 jsonb;

create or replace function public.cbt_top5_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x ->> 'publishedAt' desc), '[]'::jsonb)
  from (
    select jsonb_build_object('id', t.id, 'name', t.name, 'publishedAt', t.top5 ->> 'publishedAt', 'top5', t.top5) as x
    from public.cbt_tests t
    where t.top5 is not null and t.status <> 'draft'
    order by t.top5 ->> 'publishedAt' desc
    limit 12
  ) q;
$$;

revoke all on function public.cbt_top5_list() from public;
grant execute on function public.cbt_top5_list() to anon, authenticated;
