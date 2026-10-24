-- ============================================================================
-- CBT Exam: take the exam from anywhere (online exam link)
-- ============================================================================
-- A test built in CBT Exam can be published as a link (…/exam?t=<id>) that candidates open on their own
-- phone or computer. Everything a candidate can do goes through the functions below, because the tables
-- are private:
--   • the paper (questions, pictures) is handed out only to someone who has started an attempt, and
--     never contains the answers — the answer key lives in cbt_keys, which only staff can read
--   • the clock is the server's: an attempt has a start time and a deadline, answers saved after the
--     deadline (plus a short grace for a slow connection) are ignored
--   • the score is worked out here, from the key, when the attempt is submitted
--   • one attempt per roll number; a candidate resumes with a secret token kept in their browser
-- Staff (qbank_is_staff) can read and change everything, so results show on any office computer.
--
-- REQUIRES 20260925_qbank_rls.sql (qbank_is_staff). Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.qbank_is_staff()') is null then
    raise exception 'Run 20260925_qbank_rls.sql first.';
  end if;
end $$;

create table if not exists public.cbt_tests (
  id            text primary key,
  name          text not null,
  duration_min  numeric not null check (duration_min > 0),
  marking       jsonb not null default '{"correct":1,"wrong":0}'::jsonb,
  instructions  text,
  show_result   boolean not null default true,
  show_answers  boolean not null default true,
  sections      jsonb not null,                       -- questions WITHOUT answers
  status        text not null default 'live' check (status in ('draft', 'live', 'closed')),
  access_code   text,                                 -- empty = no code needed
  opens_at      timestamptz,
  closes_at     timestamptz,
  grace_seconds int not null default 20,              -- slack for a slow connection when submitting
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.cbt_keys (
  test_id text primary key references public.cbt_tests (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb          -- { "1": "A", "2": "C", … }
);

create table if not exists public.cbt_attempts (
  id             text primary key default gen_random_uuid()::text,
  test_id        text not null references public.cbt_tests (id) on delete cascade,
  candidate_name text not null,
  roll           text not null,
  roll_key       text generated always as (lower(btrim(roll))) stored,
  phone          text,
  token          text not null,
  started_at     timestamptz not null default now(),
  saved_at       timestamptz,
  submitted_at   timestamptz,
  state          text not null default 'inprogress' check (state in ('inprogress', 'submitted')),
  auto_submitted boolean not null default false,
  answers        jsonb not null default '{}'::jsonb,
  marked         jsonb not null default '{}'::jsonb,
  current_no     int,
  lang           text,
  switches       int not null default 0,
  score          jsonb,
  unique (test_id, roll_key)
);
create index if not exists cbt_attempts_test_idx on public.cbt_attempts (test_id);

alter table public.cbt_tests    enable row level security;
alter table public.cbt_keys     enable row level security;
alter table public.cbt_attempts enable row level security;

drop policy if exists cbt_tests_staff    on public.cbt_tests;
drop policy if exists cbt_keys_staff     on public.cbt_keys;
drop policy if exists cbt_attempts_staff on public.cbt_attempts;
create policy cbt_tests_staff    on public.cbt_tests    for all to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff());
create policy cbt_keys_staff     on public.cbt_keys     for all to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff());
create policy cbt_attempts_staff on public.cbt_attempts for all to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff());

-- ── scoring (same shape as the app's grade()) ────────────────────────────────
create or replace function public.cbt_grade(p_sections jsonb, p_marking jsonb, p_key jsonb, p_answers jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  plus numeric := coalesce((p_marking ->> 'correct')::numeric, 1);
  minus numeric := coalesce((p_marking ->> 'wrong')::numeric, 0);
  s jsonb; q jsonb; no text; given text; k text;
  secs jsonb := '[]'::jsonb;
  t_total int := 0; t_att int := 0; t_cor int := 0; t_wr int := 0; t_uns int := 0; t_marks numeric := 0; t_max numeric := 0;
  total int; att int; cor int; wr int; uns int; marks numeric; mx numeric;
begin
  for s in select value from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) loop
    total := 0; att := 0; cor := 0; wr := 0; uns := 0; marks := 0; mx := 0;
    for q in select value from jsonb_array_elements(coalesce(s -> 'questions', '[]'::jsonb)) loop
      no := q ->> 'no'; given := nullif(p_answers ->> no, ''); k := nullif(p_key ->> no, '');
      total := total + 1;
      if given is not null then att := att + 1; end if;
      if k is null then uns := uns + 1; continue; end if;
      mx := mx + plus;
      if given = k then cor := cor + 1; marks := marks + plus;
      elsif given is not null then wr := wr + 1; marks := marks - minus; end if;
    end loop;
    secs := secs || jsonb_build_object('id', s ->> 'id', 'label', s ->> 'label', 'title', s ->> 'title', 'total', total, 'attempted', att,
      'correct', cor, 'wrong', wr, 'unscored', uns, 'marks', round(marks, 2), 'max', round(mx, 2));
    t_total := t_total + total; t_att := t_att + att; t_cor := t_cor + cor; t_wr := t_wr + wr; t_uns := t_uns + uns; t_marks := t_marks + marks; t_max := t_max + mx;
  end loop;
  return jsonb_build_object(
    'marks', round(t_marks, 2), 'max', round(t_max, 2), 'total', t_total, 'attempted', t_att, 'correct', t_cor, 'wrong', t_wr,
    'unscored', t_uns, 'skipped', t_total - t_att,
    'accuracy', case when t_att > 0 then round(t_cor::numeric / t_att * 100, 1) else 0 end,
    'percent', case when t_max > 0 then round(t_marks / t_max * 100, 1) else null end,
    'complete', t_uns = 0, 'sections', secs);
end $$;

-- ── helpers ──────────────────────────────────────────────────────────────────
create or replace function public.cbt_deadline(a public.cbt_attempts, t public.cbt_tests)
returns timestamptz language sql immutable as $$
  select a.started_at + (t.duration_min * interval '1 minute')
$$;

create or replace function public.cbt_paper(t public.cbt_tests)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', t.id, 'name', t.name, 'durationMin', t.duration_min, 'marking', t.marking,
    'instructions', t.instructions, 'showResult', t.show_result, 'showAnswers', t.show_answers, 'sections', t.sections)
$$;

create or replace function public.cbt_state_json(a public.cbt_attempts)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', a.id, 'state', a.state, 'startedAt', a.started_at, 'savedAt', a.saved_at, 'submittedAt', a.submitted_at,
    'serverNow', now(), 'answers', a.answers, 'marked', a.marked, 'current', a.current_no, 'lang', a.lang, 'switches', a.switches,
    'autoSubmitted', a.auto_submitted)
$$;

-- What a candidate may see after submitting: the score (if the test shows it), the key and their answers (if it shows answers).
create or replace function public.cbt_result_json(a public.cbt_attempts, t public.cbt_tests)
returns jsonb
language plpgsql
stable
as $$
declare k jsonb;
begin
  select answers into k from public.cbt_keys where test_id = t.id;
  return jsonb_build_object(
    'attempt', public.cbt_state_json(a),
    'showResult', t.show_result, 'showAnswers', t.show_answers,
    'score', case when t.show_result then a.score else null end,
    'answers', case when t.show_result then a.answers else null end,
    'key', case when t.show_result and t.show_answers then coalesce(k, '{}'::jsonb) else null end,
    'test', case when t.show_result and t.show_answers then public.cbt_paper(t) else null end);
end $$;

create or replace function public.cbt_finish(p_attempt text, p_answers jsonb, p_marked jsonb, p_switches int, p_auto boolean)
returns public.cbt_attempts
language plpgsql
security definer
set search_path = public
as $$
declare a public.cbt_attempts; t public.cbt_tests; k jsonb; within boolean; final_answers jsonb;
begin
  select * into a from public.cbt_attempts where id = p_attempt for update;
  select * into t from public.cbt_tests where id = a.test_id;
  if a.state = 'submitted' then return a; end if;
  within := now() <= public.cbt_deadline(a, t) + (t.grace_seconds * interval '1 second');
  final_answers := case when within and p_answers is not null then p_answers else a.answers end;
  select answers into k from public.cbt_keys where test_id = t.id;
  update public.cbt_attempts set
    answers = final_answers,
    marked = case when within and p_marked is not null then p_marked else marked end,
    switches = greatest(switches, coalesce(p_switches, 0)),
    state = 'submitted',
    submitted_at = least(now(), public.cbt_deadline(a, t)),
    saved_at = now(),
    auto_submitted = p_auto or not within,
    score = public.cbt_grade(t.sections, t.marking, coalesce(k, '{}'::jsonb), final_answers)
  where id = a.id returning * into a;
  return a;
end $$;

-- ── what candidates call ─────────────────────────────────────────────────────
-- Public facts about an exam (no questions): for the landing page.
create or replace function public.cbt_exam_info(p_test text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare t public.cbt_tests; st text;
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status = 'draft' then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  st := case when t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at) then 'closed'
             when t.opens_at is not null and now() < t.opens_at then 'not_open' else 'open' end;
  return jsonb_build_object('id', t.id, 'name', t.name, 'durationMin', t.duration_min, 'marking', t.marking, 'instructions', t.instructions,
    'needsCode', coalesce(btrim(t.access_code), '') <> '', 'state', st, 'opensAt', t.opens_at, 'closesAt', t.closes_at, 'serverNow', now(),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('id', s ->> 'id', 'label', s ->> 'label', 'title', s ->> 'title',
        'count', jsonb_array_length(s -> 'questions'), 'first', (s -> 'questions' -> 0 ->> 'no')::int, 'last', (s -> 'questions' -> -1 ->> 'no')::int)), '[]'::jsonb)
      from jsonb_array_elements(t.sections) s));
end $$;

create or replace function public.cbt_start(p_test text, p_code text, p_name text, p_roll text, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text;
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status = 'draft' then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  if t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at) then raise exception 'EXAM-CLOSED: This exam is closed.'; end if;
  if t.opens_at is not null and now() < t.opens_at then raise exception 'EXAM-NOT-OPEN: This exam has not opened yet.'; end if;
  if coalesce(btrim(t.access_code), '') <> '' and lower(btrim(coalesce(p_code, ''))) <> lower(btrim(t.access_code)) then
    raise exception 'EXAM-CODE: The access code is not correct.';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 or length(btrim(p_name)) > 80 then raise exception 'EXAM-INPUT: Enter your full name.'; end if;
  if length(btrim(coalesce(p_roll, ''))) < 1 or length(btrim(p_roll)) > 40 then raise exception 'EXAM-INPUT: Enter your roll or registration number.'; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, token)
    values (t.id, btrim(p_name), btrim(p_roll), nullif(left(btrim(coalesce(p_phone, '')), 20), ''), tok) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This roll number has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;

create or replace function public.cbt_resume(p_attempt text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a public.cbt_attempts; t public.cbt_tests;
begin
  select * into a from public.cbt_attempts where id = p_attempt and token = p_token;
  if not found then raise exception 'EXAM-TOKEN: This attempt could not be found. Ask the institute to reset it.'; end if;
  select * into t from public.cbt_tests where id = a.test_id;
  if a.state = 'inprogress' and now() > public.cbt_deadline(a, t) + (t.grace_seconds * interval '1 second') then
    a := public.cbt_finish(a.id, null, null, null, true);
  end if;
  if a.state = 'submitted' then return jsonb_build_object('result', public.cbt_result_json(a, t)); end if;
  return jsonb_build_object('attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;

create or replace function public.cbt_save(p_attempt text, p_token text, p_answers jsonb, p_marked jsonb, p_current int, p_lang text, p_switches int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a public.cbt_attempts; t public.cbt_tests;
begin
  select * into a from public.cbt_attempts where id = p_attempt and token = p_token;
  if not found then raise exception 'EXAM-TOKEN: This attempt could not be found.'; end if;
  if a.state = 'submitted' then return jsonb_build_object('submitted', true, 'serverNow', now()); end if;
  if octet_length(coalesce(p_answers, '{}'::jsonb)::text) > 20000 or octet_length(coalesce(p_marked, '{}'::jsonb)::text) > 20000 then
    raise exception 'EXAM-INPUT: Too much data.';
  end if;
  select * into t from public.cbt_tests where id = a.test_id;
  if now() > public.cbt_deadline(a, t) + (t.grace_seconds * interval '1 second') then
    a := public.cbt_finish(a.id, null, null, p_switches, true);
    return jsonb_build_object('submitted', true, 'serverNow', now());
  end if;
  update public.cbt_attempts set answers = coalesce(p_answers, answers), marked = coalesce(p_marked, marked), current_no = coalesce(p_current, current_no),
    lang = coalesce(p_lang, lang), switches = greatest(switches, coalesce(p_switches, 0)), saved_at = now() where id = a.id;
  return jsonb_build_object('submitted', false, 'serverNow', now(), 'savedAt', now());
end $$;

create or replace function public.cbt_submit(p_attempt text, p_token text, p_answers jsonb, p_marked jsonb, p_switches int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a public.cbt_attempts; t public.cbt_tests;
begin
  select * into a from public.cbt_attempts where id = p_attempt and token = p_token;
  if not found then raise exception 'EXAM-TOKEN: This attempt could not be found.'; end if;
  if octet_length(coalesce(p_answers, '{}'::jsonb)::text) > 20000 then raise exception 'EXAM-INPUT: Too much data.'; end if;
  a := public.cbt_finish(a.id, p_answers, p_marked, p_switches, false);
  select * into t from public.cbt_tests where id = a.test_id;
  return public.cbt_result_json(a, t);
end $$;

-- Only the functions candidates call are open to everyone; the helpers are internal.
revoke all on function public.cbt_grade(jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.cbt_finish(text, jsonb, jsonb, int, boolean) from public;
revoke all on function public.cbt_result_json(public.cbt_attempts, public.cbt_tests) from public;
revoke all on function public.cbt_exam_info(text) from public;
revoke all on function public.cbt_start(text, text, text, text, text) from public;
revoke all on function public.cbt_resume(text, text) from public;
revoke all on function public.cbt_save(text, text, jsonb, jsonb, int, text, int) from public;
revoke all on function public.cbt_submit(text, text, jsonb, jsonb, int) from public;
grant execute on function public.cbt_exam_info(text) to anon, authenticated;
grant execute on function public.cbt_start(text, text, text, text, text) to anon, authenticated;
grant execute on function public.cbt_resume(text, text) to anon, authenticated;
grant execute on function public.cbt_save(text, text, jsonb, jsonb, int, text, int) to anon, authenticated;
grant execute on function public.cbt_submit(text, text, jsonb, jsonb, int) to anon, authenticated;
