-- ────────────────────────────────────────────────────────────────────────────
-- Online exam: let candidates find the CURRENT test without a link (run after 20261114).
--   • cbt_tests.public_list — an admin can keep a test off the public exam page (default: listed).
--   • cbt_public_tests()    — what the public exam page shows: only name, length, timing and whether a code
--                             is needed. NEVER questions, answers, the access code or anything about candidates.
--   Starting a listed test still needs the access code + the candidate's GCC no. + the parent / guardian number.
-- Safe to run more than once.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.cbt_tests add column if not exists public_list boolean not null default true;

create or replace function public.cbt_public_tests()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by (x ->> 'state') = 'open' desc, x ->> 'sortAt'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', t.id, 'name', t.name, 'durationMin', t.duration_min,
      'questions', (select coalesce(sum(jsonb_array_length(s -> 'questions')), 0) from jsonb_array_elements(t.sections) s),
      'needsCode', coalesce(btrim(t.access_code), '') <> '',
      'state', case when t.opens_at is not null and now() < t.opens_at then 'not_open' else 'open' end,
      'opensAt', t.opens_at, 'closesAt', t.closes_at, 'serverNow', now(),
      'sortAt', coalesce(t.opens_at, t.created_at)::text
    ) as x
    from public.cbt_tests t
    where t.status = 'live' and t.public_list
      and (t.closes_at is null or now() < t.closes_at)
      and (t.opens_at is null or t.opens_at < now() + interval '60 days')
    order by coalesce(t.opens_at, t.created_at) desc
    limit 20
  ) q;
$$;

revoke all on function public.cbt_public_tests() from public;
grant execute on function public.cbt_public_tests() to anon, authenticated;
