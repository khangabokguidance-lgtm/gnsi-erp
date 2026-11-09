-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: design fixes (run after 20261061, 20261062, 20261063).
--   1. SECOND CHECK: siblings share a parent number, so phone alone let one sibling start the other's exam. When the ERP
--      has the student's date of birth, the candidate must also type it (DD/MM/YYYY). No date of birth on file → the
--      parent number alone, as before. Wrong tries count against the same per-GCC lock.
--   2. LATE SUBMIT: a connection that was down at the end of the exam used to lose everything since the last save once the
--      20-second grace ran out. The window after the deadline is now at least 120 s (cbt_grace), for the final submit and
--      saves only; the screen itself stops at the deadline, so this only rescues a submit that was already on its way.
--   3. KEY RELEASE: an abandoned attempt (nothing saved for 15 minutes) no longer holds the answer key back after the
--      exam has closed.
--   4. GUESTS: a test can be opened to people who are not in the ERP (marking.guests = true): they give a name and a
--      mobile number, one attempt per number, and are marked "not in the institute records" in the results.
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.cbt_grace(t public.cbt_tests) returns interval
language sql immutable as $$ select greatest(t.grace_seconds, 120) * interval '1 second' $$;
revoke all on function public.cbt_grace(public.cbt_tests) from public;

-- date of birth on the ERP record → DDMMYYYY digits ('' when missing or unreadable)
create or replace function public.cbt_dob_digits(p text) returns text
language sql immutable as $$
  select case
    when btrim(coalesce(p, '')) ~ '^\d{4}-\d{1,2}-\d{1,2}'
      then lpad(regexp_replace(btrim(p), '^(\d{4})-(\d{1,2})-(\d{1,2}).*$', '\3'), 2, '0') || lpad(regexp_replace(btrim(p), '^(\d{4})-(\d{1,2})-(\d{1,2}).*$', '\2'), 2, '0') || regexp_replace(btrim(p), '^(\d{4})-(\d{1,2})-(\d{1,2}).*$', '\1')
    when btrim(coalesce(p, '')) ~ '^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}'
      then lpad(regexp_replace(btrim(p), '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}).*$', '\1'), 2, '0') || lpad(regexp_replace(btrim(p), '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}).*$', '\2'), 2, '0') || regexp_replace(btrim(p), '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}).*$', '\3')
    else '' end
$$;
revoke all on function public.cbt_dob_digits(text) from public;

-- ── 1. lookup + start with the second check ─────────────────────────────────
drop function if exists public.cbt_lookup(text, text, text, text);
create or replace function public.cbt_lookup(p_test text, p_code text, p_q text, p_parent text default null, p_dob text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; g text := ltrim(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '0'); st public.students; phones text[]; par text := public.cbt_digits(p_parent); ok boolean;
        want text; got text := regexp_replace(coalesce(p_dob, ''), '\D', '', 'g');
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status in ('draft', 'closed') or (t.closes_at is not null and now() > t.closes_at) then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  if public.cbt_throttled('find', 60) or public.cbt_throttled('code', 30) or public.cbt_throttled('phone', 15) then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many tries from this network. Wait ten minutes and try again.');
  end if;
  if coalesce(btrim(t.access_code), '') = '' or lower(btrim(coalesce(p_code, ''))) <> lower(btrim(t.access_code)) then
    perform public.cbt_hit('code');
    return jsonb_build_object('error', 'EXAM-CODE: Enter the correct access code first.');
  end if;
  perform public.cbt_hit('find');
  if g = '' or length(g) > 12 then return '[]'::jsonb; end if;
  select * into st from public.students s where ltrim(s.gcc_no::text, '0') = g and coalesce(s.status, 'Active') = 'Active' limit 1;
  if not found then return '[]'::jsonb; end if;
  phones := public.cbt_student_phones(to_jsonb(st));
  want := public.cbt_dob_digits(to_jsonb(st) ->> 'dob');
  if cardinality(phones) = 0 then
    return jsonb_build_array(jsonb_build_object('gcc', st.gcc_no::text, 'hasPhone', false, 'hasDob', want <> '', 'verified', false));
  end if;
  if p_parent is null then
    return jsonb_build_array(jsonb_build_object('gcc', st.gcc_no::text, 'hasPhone', true, 'hasDob', want <> '', 'verified', null, 'phoneHint', '••••••' || right(phones[1], 4)));
  end if;
  if (select count(*) from public.cbt_hits h where h.kind = 'phone:' || g and h.at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many wrong tries for this GCC no. Wait ten minutes and try again, or ask the office.');
  end if;
  ok := length(par) >= 10 and par = any (phones) and (want = '' or got = want);
  if not ok then
    perform public.cbt_hit('phone');
    insert into public.cbt_hits (ip, kind) values ('*', 'phone:' || g);
    return jsonb_build_array(jsonb_build_object('gcc', st.gcc_no::text, 'hasPhone', true, 'hasDob', want <> '', 'verified', false));
  end if;
  return jsonb_build_array(jsonb_build_object('name', st.name, 'gcc', st.gcc_no::text,
    'className', coalesce(nullif(to_jsonb(st) ->> 'batch', ''), to_jsonb(st) ->> 'class_name', ''),
    'fatherName', coalesce(nullif(btrim(to_jsonb(st) ->> 'father_name'), ''), ''),
    'hasPhone', true, 'hasDob', want <> '', 'verified', true));
end $$;
revoke all on function public.cbt_lookup(text, text, text, text, text) from public;
grant execute on function public.cbt_lookup(text, text, text, text, text) to anon, authenticated;

drop function if exists public.cbt_start(text, text, text, text, text);
create or replace function public.cbt_start(p_test text, p_code text, p_gcc text, p_parent text default null, p_phone text default null, p_dob text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; g text := ltrim(regexp_replace(coalesce(p_gcc, ''), '\D', '', 'g'), '0');
        par text := public.cbt_digits(p_parent); phones text[]; sess text := replace(gen_random_uuid()::text, '-', '');
        want text; got text := regexp_replace(coalesce(p_dob, ''), '\D', '', 'g');
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status = 'draft' then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  if t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at) then raise exception 'EXAM-CLOSED: This exam is closed.'; end if;
  if t.opens_at is not null and now() < t.opens_at then raise exception 'EXAM-NOT-OPEN: This exam has not opened yet.'; end if;
  if public.cbt_throttled('code', 30) or public.cbt_throttled('phone', 15) or public.cbt_throttled('find', 60) then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many tries from this network. Wait ten minutes and try again.');
  end if;
  if coalesce(btrim(t.access_code), '') = '' or lower(btrim(coalesce(p_code, ''))) <> lower(btrim(t.access_code)) then
    perform public.cbt_hit('code');
    return jsonb_build_object('error', 'EXAM-CODE: The access code is not correct.');
  end if;
  if g = '' or length(g) > 12 then return jsonb_build_object('error', 'EXAM-GCC: Enter your GCC no.'); end if;
  select * into st from public.students s where ltrim(s.gcc_no::text, '0') = g and coalesce(s.status, 'Active') = 'Active' limit 1;
  if not found then
    perform public.cbt_hit('find');
    return jsonb_build_object('error', 'EXAM-GCC: This GCC no. was not found in the institute records. Check it, or ask the office.');
  end if;
  phones := public.cbt_student_phones(to_jsonb(st));
  want := public.cbt_dob_digits(to_jsonb(st) ->> 'dob');
  if cardinality(phones) = 0 then
    return jsonb_build_object('error', 'EXAM-NOPHONE: No parent / guardian number is on file for this GCC no., so your identity cannot be checked online. Please ask the office to add it, then try again.');
  end if;
  if (select count(*) from public.cbt_hits h where h.kind = 'phone:' || g and h.at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many wrong tries for this GCC no. Wait ten minutes and try again, or ask the office.');
  end if;
  if not (length(par) >= 10 and par = any (phones) and (want = '' or got = want)) then
    perform public.cbt_hit('phone');
    insert into public.cbt_hits (ip, kind) values ('*', 'phone:' || g);
    return jsonb_build_object('error', 'EXAM-PHONE: The parent / guardian number' || case when want <> '' then ' or date of birth' else '' end || ' does not match the institute records.');
  end if;
  if (select count(*) from public.cbt_attempts where test_id = t.id) >= 2000 then raise exception 'EXAM-FULL: This exam has reached its limit of candidates. Ask the institute.'; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, parent_phone, erp_match, phone_verified, token, session, ip_start, ip_last)
    values (t.id, btrim(st.name), g, nullif(left(btrim(coalesce(p_phone, '')), 20), ''), st.gcc_no::text, nullif(par, ''), true, true, tok, sess,
            public.cbt_client_ip(), public.cbt_client_ip()) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This GCC no. has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;
revoke all on function public.cbt_start(text, text, text, text, text, text) from public;
grant execute on function public.cbt_start(text, text, text, text, text, text) to anon, authenticated;

-- ── 4. guests (not in the ERP) ──────────────────────────────────────────────
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
    'needsCode', coalesce(btrim(t.access_code), '') <> '', 'guests', coalesce((t.marking ->> 'guests')::boolean, false),
    'state', st, 'opensAt', t.opens_at, 'closesAt', t.closes_at, 'serverNow', now(),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('id', s ->> 'id', 'label', s ->> 'label', 'title', s ->> 'title',
        'count', jsonb_array_length(s -> 'questions'), 'first', (s -> 'questions' -> 0 ->> 'no')::int, 'last', (s -> 'questions' -> -1 ->> 'no')::int)), '[]'::jsonb)
      from jsonb_array_elements(t.sections) s));
end $$;

create or replace function public.cbt_start_guest(p_test text, p_code text, p_name text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; sess text := replace(gen_random_uuid()::text, '-', ''); ph text := public.cbt_digits(p_phone);
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status = 'draft' then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  if t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at) then raise exception 'EXAM-CLOSED: This exam is closed.'; end if;
  if t.opens_at is not null and now() < t.opens_at then raise exception 'EXAM-NOT-OPEN: This exam has not opened yet.'; end if;
  if not coalesce((t.marking ->> 'guests')::boolean, false) then raise exception 'EXAM-GUEST: This exam is only for students of the institute.'; end if;
  if public.cbt_throttled('code', 30) then return jsonb_build_object('error', 'EXAM-LIMIT: Too many tries from this network. Wait ten minutes and try again.'); end if;
  if coalesce(btrim(t.access_code), '') = '' or lower(btrim(coalesce(p_code, ''))) <> lower(btrim(t.access_code)) then
    perform public.cbt_hit('code');
    return jsonb_build_object('error', 'EXAM-CODE: The access code is not correct.');
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 or length(btrim(p_name)) > 80 then raise exception 'EXAM-INPUT: Enter your full name.'; end if;
  if length(ph) < 10 then raise exception 'EXAM-INPUT: Enter your 10-digit mobile number.'; end if;
  if (select count(*) from public.cbt_attempts where test_id = t.id) >= 2000 then raise exception 'EXAM-FULL: This exam has reached its limit of candidates. Ask the institute.'; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, erp_match, phone_verified, token, session, ip_start, ip_last)
    values (t.id, btrim(p_name), 'G' || ph, ph, null, false, false, tok, sess, public.cbt_client_ip(), public.cbt_client_ip()) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This mobile number has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;
revoke all on function public.cbt_start_guest(text, text, text, text) from public;
grant execute on function public.cbt_start_guest(text, text, text, text) to anon, authenticated;

-- ── 2. late submit window + 3. key release ──────────────────────────────────
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
  within := now() <= public.cbt_deadline(a, t) + public.cbt_grace(t);
  final_answers := case when within and p_answers is not null then (case when coalesce((t.marking ->> 'lock')::boolean, false) then public.cbt_clean_answers(p_answers) || a.answers else public.cbt_clean_answers(p_answers) end) else a.answers end;
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
  if now() > public.cbt_deadline(a, t) + public.cbt_grace(t) then
    a := public.cbt_finish(a.id, null, null, p_switches, true);
    return jsonb_build_object('submitted', true, 'serverNow', now());
  end if;
  update public.cbt_attempts set answers = case when p_answers is null then answers else (case when coalesce((t.marking ->> 'lock')::boolean, false) then public.cbt_clean_answers(p_answers) || answers else public.cbt_clean_answers(p_answers) end) end, marked = coalesce(p_marked, marked), current_no = coalesce(p_current, current_no),
    lang = coalesce(p_lang, lang), switches = greatest(switches, coalesce(p_switches, 0)), saved_at = now(), ip_last = public.cbt_client_ip() where id = a.id;
  return jsonb_build_object('submitted', false, 'serverNow', now(), 'savedAt', now(), 'extraSeconds', a.extra_seconds);
end $$;
revoke all on function public.cbt_save(text, text, jsonb, jsonb, int, text, int, text) from public;
grant execute on function public.cbt_save(text, text, jsonb, jsonb, int, text, int, text) to anon, authenticated;

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
  if a.state = 'inprogress' and now() > public.cbt_deadline(a, t) + public.cbt_grace(t) then
    a := public.cbt_finish(a.id, null, null, null, true);
  end if;
  if a.state = 'submitted' then return jsonb_build_object('result', public.cbt_result_json(a, t)); end if;
  if a.session is not distinct from p_session and p_session is not null then
    sess := a.session;
  else
    sess := replace(gen_random_uuid()::text, '-', '');
    update public.cbt_attempts set session = sess, takeovers = takeovers + (case when a.session is null then 0 else 1 end),
      ip_last = public.cbt_client_ip() where id = a.id returning * into a;
  end if;
  return jsonb_build_object('session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;
revoke all on function public.cbt_resume(text, text, text) from public;
grant execute on function public.cbt_resume(text, text, text) to anon, authenticated;

create or replace function public.cbt_answers_open(t public.cbt_tests) returns boolean
language sql stable security definer set search_path = public as $$
  select (t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at))
     and not exists (select 1 from public.cbt_attempts x
                     where x.test_id = t.id and x.state = 'inprogress'
                       and now() <= x.started_at + (t.duration_min * interval '1 minute') + (x.extra_seconds * interval '1 second') + public.cbt_grace(t)
                       and coalesce(x.saved_at, x.started_at) > now() - interval '15 minutes')     -- an abandoned attempt does not hold the key back
$$;
revoke all on function public.cbt_answers_open(public.cbt_tests) from public;
