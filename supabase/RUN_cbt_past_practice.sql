-- ────────────────────────────────────────────────────────────────────────────
-- Online exam: PRACTICE MODE for past (closed) exams (run after 20261115).
--   A closed exam can be re-taken by anyone as a practice test — in the browser only, nothing is saved or counted.
--   It is released only when the exam is closed AND its answers are already released to candidates
--   (cbt_answers_open: closed, and no attempt still running) AND the test "shows answers" AND the admin has
--   switched practice ON for the test (cbt_tests.practice_after_close, default OFF; a tick box in Publish).
--   Tests hidden from the public page (public_list = false) are not offered for practice either.
-- Safe to run more than once.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.cbt_tests add column if not exists public_list boolean not null default true;
alter table public.cbt_tests add column if not exists practice_after_close boolean not null default false;   -- opt-in per test (Publish → "Allow practice after it closes")

create or replace function public.cbt_practice_ok(t public.cbt_tests)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select t.status <> 'draft' and t.public_list and t.practice_after_close and t.show_answers and public.cbt_answers_open(t)
$$;

create or replace function public.cbt_practice_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', t.id, 'name', t.name, 'durationMin', t.duration_min,
      'questions', (select coalesce(sum(jsonb_array_length(s -> 'questions')), 0) from jsonb_array_elements(t.sections) s),
      'closedAt', coalesce(t.closes_at, t.updated_at)
    ) as x
    from public.cbt_tests t
    where public.cbt_practice_ok(t)
    order by coalesce(t.closes_at, t.updated_at) desc
    limit 30
  ) q;
$$;

-- The paper WITH its key, for local practice marking. Refused unless practice is allowed for this test.
create or replace function public.cbt_practice_paper(p_test text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare t public.cbt_tests;
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status = 'draft' then raise exception 'EXAM-404: This practice test is not available.'; end if;
  if not public.cbt_practice_ok(t) then raise exception 'EXAM-PRACTICE: Practice for this exam is not available.'; end if;
  return public.cbt_paper(t) || jsonb_build_object('key', coalesce((select answers from public.cbt_keys where test_id = t.id), '{}'::jsonb));
end $$;

revoke all on function public.cbt_practice_ok(public.cbt_tests) from public;
revoke all on function public.cbt_practice_list() from public;
revoke all on function public.cbt_practice_paper(text) from public;
grant execute on function public.cbt_practice_list() to anon, authenticated;
grant execute on function public.cbt_practice_paper(text) to anon, authenticated;
