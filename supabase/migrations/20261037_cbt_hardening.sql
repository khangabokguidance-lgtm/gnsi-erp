-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam hardening (run after 20261034, 20261035 and 20261036). Closes these loopholes:
--   1. The answer key / review was shown the moment a candidate submitted — someone could submit blank and pass the
--      key to friends still sitting the exam. It is now released only after the exam has closed AND nobody is still
--      inside their time (cbt_answers_open). The score is shown as before.
--   2. A second attempt under another roll no. or GCC no. (to see the paper first): one attempt per GCC no. now.
--   3. Guessing the access code, or reading the student list through the name finder, was unlimited: now limited per
--      network address (30 wrong codes / 60 finder searches per 10 minutes).
--   4. Claiming another student's GCC no.: the attempt is flagged unless the name matches the ERP record.
--   5. Junk in the saved answers: only question numbers with an A–D answer are kept.
--   6. Flooding a test with fake attempts: capped at 2000 attempts per test.
--   7. Helper functions were callable by anyone: now internal only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── limits per network address ──────────────────────────────────────────────
create table if not exists public.cbt_hits (
  id   bigserial primary key,
  ip   text not null,
  kind text not null,
  at   timestamptz not null default now()
);
create index if not exists cbt_hits_ip_idx on public.cbt_hits (ip, kind, at);
alter table public.cbt_hits enable row level security;   -- no policy: only the functions below touch it

create or replace function public.cbt_client_ip() returns text
language plpgsql stable as $$
declare h jsonb;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  return coalesce(nullif(btrim(split_part(coalesce(h ->> 'x-forwarded-for', h ->> 'x-real-ip', ''), ',', 1)), ''), 'unknown');
end $$;

create or replace function public.cbt_throttled(p_kind text, p_max int) returns boolean
language sql security definer set search_path = public as $$
  select count(*) >= p_max from public.cbt_hits h where h.ip = public.cbt_client_ip() and h.kind = p_kind and h.at > now() - interval '10 minutes'
$$;

create or replace function public.cbt_hit(p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.02 then delete from public.cbt_hits where at < now() - interval '1 day'; end if;
  insert into public.cbt_hits (ip, kind) values (public.cbt_client_ip(), p_kind);
end $$;

-- ── answers: only question numbers with A–D ─────────────────────────────────
create or replace function public.cbt_clean_answers(p jsonb) returns jsonb
language sql immutable as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then '{}'::jsonb else
    coalesce((select jsonb_object_agg(key, value) from jsonb_each(p)
              where key ~ '^[0-9]{1,4}$' and jsonb_typeof(value) = 'string' and (value #>> '{}') in ('A', 'B', 'C', 'D')), '{}'::jsonb) end
$$;

-- ── one attempt per GCC no. ─────────────────────────────────────────────────
alter table public.cbt_attempts add column if not exists gcc_key text
  generated always as (nullif(ltrim(regexp_replace(coalesce(gcc_no, ''), '\D', '', 'g'), '0'), '')) stored;
create unique index if not exists cbt_attempts_gcc_once on public.cbt_attempts (test_id, gcc_key) where gcc_key is not null;

-- ── may the key be shown yet? exam closed and nobody still inside their time ─
create or replace function public.cbt_answers_open(t public.cbt_tests) returns boolean
language sql stable security definer set search_path = public as $$
  select (t.status = 'closed' or (t.closes_at is not null and now() > t.closes_at))
     and not exists (select 1 from public.cbt_attempts x
                     where x.test_id = t.id and x.state = 'inprogress'
                       and now() <= x.started_at + (t.duration_min * interval '1 minute') + (t.grace_seconds * interval '1 second'))
$$;

create or replace function public.cbt_result_json(a public.cbt_attempts, t public.cbt_tests)
returns jsonb
language plpgsql
stable
as $$
declare k jsonb; open boolean := public.cbt_answers_open(t);
begin
  select answers into k from public.cbt_keys where test_id = t.id;
  return jsonb_build_object(
    'attempt', public.cbt_state_json(a),
    'showResult', t.show_result, 'showAnswers', t.show_answers,
    'answersLater', t.show_result and t.show_answers and not open,
    'score', case when t.show_result then a.score else null end,
    'answers', case when t.show_result then a.answers else null end,
    'key', case when t.show_result and t.show_answers and open then coalesce(k, '{}'::jsonb) else null end,
    'test', case when t.show_result and t.show_answers and open then public.cbt_paper(t) else null end);
end $$;

-- ── save / finish: cleaned answers, and the lock from 20261036 ───────────────
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
  update public.cbt_attempts set answers = case when p_answers is null then answers else (case when coalesce((t.marking ->> 'lock')::boolean, false) then public.cbt_clean_answers(p_answers) || answers else public.cbt_clean_answers(p_answers) end) end, marked = coalesce(p_marked, marked), current_no = coalesce(p_current, current_no),
    lang = coalesce(p_lang, lang), switches = greatest(switches, coalesce(p_switches, 0)), saved_at = now() where id = a.id;
  return jsonb_build_object('submitted', false, 'serverNow', now(), 'savedAt', now());
end $$;

-- ── the name finder: limited, errors returned (a raised error would undo the count) ──
create or replace function public.cbt_lookup(p_test text, p_code text, p_q text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; q text := btrim(coalesce(p_q, '')); g text; res jsonb;
begin
  select * into t from public.cbt_tests where id = p_test;
  if not found or t.status in ('draft', 'closed') or (t.closes_at is not null and now() > t.closes_at) then raise exception 'EXAM-404: This exam link is not valid.'; end if;
  if public.cbt_throttled('find', 60) or public.cbt_throttled('code', 30) then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many searches from this network. Wait ten minutes and try again, or type your details.');
  end if;
  if coalesce(btrim(t.access_code), '') = '' or lower(btrim(coalesce(p_code, ''))) <> lower(btrim(t.access_code)) then
    perform public.cbt_hit('code');
    return jsonb_build_object('error', 'EXAM-CODE: Enter the access code first.');
  end if;
  perform public.cbt_hit('find');
  if length(q) < 1 or (q !~ '^[0-9 ]+$' and length(q) < 3) then return '[]'::jsonb; end if;
  g := ltrim(regexp_replace(q, '\D', '', 'g'), '0');
  select coalesce(jsonb_agg(x), '[]'::jsonb) into res from (
    select jsonb_build_object('name', s.name, 'gcc', s.gcc_no::text,
             'className', coalesce(nullif(to_jsonb(s) ->> 'batch', ''), to_jsonb(s) ->> 'class_name', ''),
             'phoneHint', case when length(public.cbt_student_phone(to_jsonb(s))) >= 4 then '••••••' || right(public.cbt_student_phone(to_jsonb(s)), 4) else '' end) as x
    from public.students s
    where coalesce(s.status, 'Active') = 'Active'
      and ((g <> '' and q ~ '^[0-9 ]+$' and ltrim(s.gcc_no::text, '0') = g) or (q !~ '^[0-9 ]+$' and s.name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'))
    order by s.name limit 6) m;
  return res;
end $$;

-- ── start: limits, the 2000 cap, name check against the ERP ─────────────────
create or replace function public.cbt_start(p_test text, p_code text, p_name text, p_roll text, p_phone text default null,
                                            p_gcc text default null, p_parent text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; gcc text := nullif(btrim(coalesce(p_gcc, '')), '');
        par text := public.cbt_digits(p_parent); hit boolean := false;
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
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, parent_phone, erp_match, token)
    values (t.id, btrim(p_name), btrim(p_roll), nullif(left(btrim(coalesce(p_phone, '')), 20), ''), gcc, nullif(par, ''), hit, tok) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This roll number or GCC no. has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;

-- ── helpers are internal; the public functions stay open ─────────────────────
revoke all on function public.cbt_paper(public.cbt_tests) from public;
revoke all on function public.cbt_state_json(public.cbt_attempts) from public;
revoke all on function public.cbt_deadline(public.cbt_attempts, public.cbt_tests) from public;
revoke all on function public.cbt_digits(text) from public;
revoke all on function public.cbt_student_phone(jsonb) from public;
revoke all on function public.cbt_client_ip() from public;
revoke all on function public.cbt_throttled(text, int) from public;
revoke all on function public.cbt_hit(text) from public;
revoke all on function public.cbt_clean_answers(jsonb) from public;
revoke all on function public.cbt_answers_open(public.cbt_tests) from public;
revoke all on function public.cbt_result_json(public.cbt_attempts, public.cbt_tests) from public;
revoke all on function public.cbt_finish(text, jsonb, jsonb, int, boolean) from public;
revoke all on function public.cbt_lookup(text, text, text) from public;
revoke all on function public.cbt_start(text, text, text, text, text, text, text) from public;
revoke all on function public.cbt_save(text, text, jsonb, jsonb, int, text, int) from public;
grant execute on function public.cbt_lookup(text, text, text) to anon, authenticated;
grant execute on function public.cbt_start(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.cbt_save(text, text, jsonb, jsonb, int, text, int) to anon, authenticated;
