-- ────────────────────────────────────────────────────────────────────────────
-- Online exam: optionally let the exam page find the CURRENT access code by itself (run after 20261116).
--   cbt_tests.auto_code (default OFF) — when an admin switches it on for a test, cbt_exam_info() also returns the
--   test's current access code, so the exam page fills it in and an old link or invitation keeps working after the
--   code is changed. The candidate must still match their GCC no. and the parent / guardian number on record.
--   WITH THIS ON, THE ACCESS CODE NO LONGER KEEPS ANYONE OUT: whoever opens the test's page can see it. Leave it off
--   for a test that must stay private to the people who were sent the code.
-- Safe to run more than once.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.cbt_tests add column if not exists auto_code boolean not null default false;

create or replace function public.cbt_exam_info(p_test text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare t public.cbt_tests; st text; out jsonb;
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status = 'draft' then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  st := case when t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at) then 'closed'
             when t.opens_at is not null and now() < t.opens_at then 'not_open' else 'open' end;
  out := jsonb_build_object('id', t.id, 'name', t.name, 'durationMin', t.duration_min, 'marking', t.marking, 'instructions', t.instructions,
    'needsCode', coalesce(btrim(t.access_code), '') <> '', 'guests', coalesce((t.marking ->> 'guests')::boolean, false),
    'state', st, 'opensAt', t.opens_at, 'closesAt', t.closes_at, 'serverNow', now(),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('id', s ->> 'id', 'label', s ->> 'label', 'title', s ->> 'title',
        'count', jsonb_array_length(s -> 'questions'), 'first', (s -> 'questions' -> 0 ->> 'no')::int, 'last', (s -> 'questions' -> -1 ->> 'no')::int)), '[]'::jsonb)
      from jsonb_array_elements(t.sections) s));
  -- the current access code, only for a test whose admin chose to share it automatically, and only while the exam is open
  if t.auto_code and st = 'open' and coalesce(btrim(t.access_code), '') <> '' then
    out := out || jsonb_build_object('code', btrim(t.access_code));
  end if;
  return out;
end $$;

grant execute on function public.cbt_exam_info(text) to anon, authenticated;
