-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: integrity features (run after 20261034–20261037).
--   • One device at a time: every attempt has a session id. Opening the exam again (another phone, another
--     browser, the copied link + token) takes the session over and the first screen is stopped with a message
--     (EXAM-SESSION); the takeovers are counted. A page reload on the same device is not a takeover.
--   • Network address at the start and at the last save, so staff can see candidates sharing one network or
--     changing network mid-exam.
--   • "Earliest submit": a test can set marking.minMinutes — the final submit is refused before that
--     (EXAM-EARLY), which stops submit-blank-and-leave. Time running out is never blocked.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cbt_attempts add column if not exists session   text;
alter table public.cbt_attempts add column if not exists takeovers int  not null default 0;
alter table public.cbt_attempts add column if not exists ip_start  text;
alter table public.cbt_attempts add column if not exists ip_last   text;

create or replace function public.cbt_start(p_test text, p_code text, p_name text, p_roll text, p_phone text default null,
                                            p_gcc text default null, p_parent text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; gcc text := nullif(btrim(coalesce(p_gcc, '')), '');
        par text := public.cbt_digits(p_parent); hit boolean := false; sess text := replace(gen_random_uuid()::text, '-', '');
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status = 'draft' then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  if t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at) then raise exception 'EXAM-CLOSED: This exam is closed.'; end if;
  if t.opens_at is not null and now() < t.opens_at then raise exception 'EXAM-NOT-OPEN: This exam has not opened yet.'; end if;
  if public.cbt_throttled('code', 30) then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many wrong codes from this network. Wait ten minutes and try again.');
  end if;
  if coalesce(btrim(t.access_code), '') <> '' and lower(btrim(coalesce(p_code, ''))) <> lower(btrim(t.access_code)) then
    perform public.cbt_hit('code');
    return jsonb_build_object('error', 'EXAM-CODE: The access code is not correct.');
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 or length(btrim(p_name)) > 80 then raise exception 'EXAM-INPUT: Enter your full name.'; end if;
  if length(btrim(coalesce(p_roll, ''))) < 1 or length(btrim(p_roll)) > 40 then raise exception 'EXAM-INPUT: Enter your roll or registration number.'; end if;
  if (select count(*) from public.cbt_attempts where test_id = t.id) >= 2000 then raise exception 'EXAM-FULL: This exam has reached its limit of candidates. Ask the institute.'; end if;
  if length(par) < 10 then par := ''; end if;
  if gcc is not null then
    gcc := left(gcc, 20);
    select * into st from public.students s where ltrim(s.gcc_no::text, '0') = ltrim(gcc, '0') limit 1;
    -- matched only when the typed name is the ERP name too, so using a classmate's GCC no. shows up as a flag
    hit := found and regexp_replace(lower(st.name), '[^[:alnum:]]+', '', 'g') = regexp_replace(lower(p_name), '[^[:alnum:]]+', '', 'g');
    if found and par = '' then par := public.cbt_student_phone(to_jsonb(st)); end if;
  end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, parent_phone, erp_match, token, session, ip_start, ip_last)
    values (t.id, btrim(p_name), btrim(p_roll), nullif(left(btrim(coalesce(p_phone, '')), 20), ''), gcc, nullif(par, ''), hit, tok, sess, public.cbt_client_ip(), public.cbt_client_ip()) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This roll number or GCC no. has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;

drop function if exists public.cbt_save(text, text, jsonb, jsonb, int, text, int);
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
  return jsonb_build_object('submitted', false, 'serverNow', now(), 'savedAt', now());
end $$;

drop function if exists public.cbt_resume(text, text);
create or replace function public.cbt_resume(p_attempt text, p_token text, p_session text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a public.cbt_attempts; t public.cbt_tests; sess text;
begin
  select * into a from public.cbt_attempts where id = p_attempt and token = p_token;
  if not found then raise exception 'EXAM-TOKEN: This attempt could not be found. Ask the institute to reset it.'; end if;
  select * into t from public.cbt_tests where id = a.test_id;
  if a.state = 'inprogress' and now() > public.cbt_deadline(a, t) + (t.grace_seconds * interval '1 second') then
    a := public.cbt_finish(a.id, null, null, null, true);
  end if;
  if a.state = 'submitted' then return jsonb_build_object('result', public.cbt_result_json(a, t)); end if;
  -- the same device reopening keeps its session; any other device takes the attempt over
  if a.session is not distinct from p_session and p_session is not null then
    sess := a.session;
  else
    sess := replace(gen_random_uuid()::text, '-', '');
    update public.cbt_attempts set session = sess, takeovers = takeovers + (case when a.session is null then 0 else 1 end),
      ip_last = public.cbt_client_ip() where id = a.id returning * into a;
  end if;
  return jsonb_build_object('session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;

drop function if exists public.cbt_submit(text, text, jsonb, jsonb, int);
create or replace function public.cbt_submit(p_attempt text, p_token text, p_answers jsonb, p_marked jsonb, p_switches int, p_session text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a public.cbt_attempts; t public.cbt_tests; early numeric;
begin
  select * into a from public.cbt_attempts where id = p_attempt and token = p_token;
  if not found then raise exception 'EXAM-TOKEN: This attempt could not be found.'; end if;
  select * into t from public.cbt_tests where id = a.test_id;
  if a.state = 'submitted' then return public.cbt_result_json(a, t); end if;
  if a.session is distinct from p_session then raise exception 'EXAM-SESSION: This exam was opened on another device or window. Only one can run an attempt — this one has stopped.'; end if;
  if octet_length(coalesce(p_answers, '{}'::jsonb)::text) > 20000 then raise exception 'EXAM-INPUT: Too much data.'; end if;
  early := coalesce((t.marking ->> 'minMinutes')::numeric, 0);
  if early > 0 and now() < a.started_at + (early * interval '1 minute') and now() <= public.cbt_deadline(a, t) then
    raise exception 'EXAM-EARLY: You can submit only after % minutes. Keep going until then.', early;
  end if;
  a := public.cbt_finish(a.id, p_answers, p_marked, p_switches, false);
  return public.cbt_result_json(a, t);
end $$;

revoke all on function public.cbt_resume(text, text, text) from public;
revoke all on function public.cbt_submit(text, text, jsonb, jsonb, int, text) from public;
revoke all on function public.cbt_save(text, text, jsonb, jsonb, int, text, int, text) from public;
revoke all on function public.cbt_start(text, text, text, text, text, text, text) from public;
grant execute on function public.cbt_resume(text, text, text) to anon, authenticated;
grant execute on function public.cbt_submit(text, text, jsonb, jsonb, int, text) to anon, authenticated;
grant execute on function public.cbt_save(text, text, jsonb, jsonb, int, text, int, text) to anon, authenticated;
grant execute on function public.cbt_start(text, text, text, text, text, text, text) to anon, authenticated;
