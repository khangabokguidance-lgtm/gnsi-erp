-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: extra time for one candidate (run after 20261034 – 20261040 and 20261061).
-- Staff can give a single attempt more time from the Live tab (e.g. a power cut or a technical fault on their side).
--   • cbt_attempts.extra_seconds — added to that attempt's deadline (staff only: the table is staff-write via RLS).
--   • the deadline, the "answers may be shown now" check and the attempt state all take it into account.
--   • cbt_save hands the current extension back, so a candidate's open screen picks it up within a few seconds.
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cbt_attempts add column if not exists extra_seconds int not null default 0
  check (extra_seconds >= 0 and extra_seconds <= 7200);

create or replace function public.cbt_deadline(a public.cbt_attempts, t public.cbt_tests)
returns timestamptz language sql immutable as $$
  select a.started_at + (t.duration_min * interval '1 minute') + (a.extra_seconds * interval '1 second')
$$;

create or replace function public.cbt_state_json(a public.cbt_attempts)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', a.id, 'state', a.state, 'startedAt', a.started_at, 'savedAt', a.saved_at, 'submittedAt', a.submitted_at,
    'serverNow', now(), 'answers', a.answers, 'marked', a.marked, 'current', a.current_no, 'lang', a.lang, 'switches', a.switches,
    'autoSubmitted', a.auto_submitted, 'extraSeconds', a.extra_seconds)
$$;

create or replace function public.cbt_answers_open(t public.cbt_tests) returns boolean
language sql stable security definer set search_path = public as $$
  select (t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at))
     and not exists (select 1 from public.cbt_attempts x
                     where x.test_id = t.id and x.state = 'inprogress'
                       and now() <= x.started_at + (t.duration_min * interval '1 minute') + (x.extra_seconds * interval '1 second') + (t.grace_seconds * interval '1 second'))
$$;

create or replace function public.cbt_save(p_attempt text, p_token text, p_answers jsonb, p_marked jsonb, p_current int, p_lang text, p_switches int, p_session text default null)
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
  if a.session is distinct from p_session then raise exception 'EXAM-SESSION: This exam was opened on another device or window. Only one can run an attempt — this one has stopped.'; end if;
  if octet_length(coalesce(p_answers, '{}'::jsonb)::text) > 20000 or octet_length(coalesce(p_marked, '{}'::jsonb)::text) > 20000 then
    raise exception 'EXAM-INPUT: Too much data.';
  end if;
  select * into t from public.cbt_tests where id = a.test_id;
  if now() > public.cbt_deadline(a, t) + (t.grace_seconds * interval '1 second') then
    a := public.cbt_finish(a.id, null, null, p_switches, true);
    return jsonb_build_object('submitted', true, 'serverNow', now());
  end if;
  update public.cbt_attempts set answers = case when p_answers is null then answers else (case when coalesce((t.marking ->> 'lock')::boolean, false) then public.cbt_clean_answers(p_answers) || answers else public.cbt_clean_answers(p_answers) end) end, marked = coalesce(p_marked, marked), current_no = coalesce(p_current, current_no),
    lang = coalesce(p_lang, lang), switches = greatest(switches, coalesce(p_switches, 0)), saved_at = now(), ip_last = public.cbt_client_ip() where id = a.id;
  return jsonb_build_object('submitted', false, 'serverNow', now(), 'savedAt', now(), 'extraSeconds', a.extra_seconds);
end $$;
revoke all on function public.cbt_save(text, text, jsonb, jsonb, int, text, int, text) from public;
grant execute on function public.cbt_save(text, text, jsonb, jsonb, int, text, int, text) to anon, authenticated;
