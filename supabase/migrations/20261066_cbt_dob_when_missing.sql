-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: ask for the date of birth when the ERP does not have one (run after 20261065).
--   • If the student's record has no date of birth, the verify step asks for it (DD/MM/YYYY, age 4–30).
--   • Once the parent number has matched, that date is saved on the student record — but ONLY when the record's date of
--     birth is still empty (an existing date is never overwritten) — and on the attempt (cbt_attempts.dob_entered), so
--     staff can see which dates were supplied by candidates and correct them in Students if one is wrong.
--   • From then on the date of birth is part of the second check, like any other student's.
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cbt_attempts add column if not exists dob_entered date;

create or replace function public.cbt_parse_dob(p text) returns date
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); v date;
begin
  if length(d) <> 8 then return null; end if;
  begin
    v := make_date(substr(d, 5, 4)::int, substr(d, 3, 2)::int, substr(d, 1, 2)::int);
  exception when others then return null;
  end;
  if v > current_date - interval '4 years' or v < current_date - interval '30 years' then return null; end if;
  return v;
end $$;
revoke all on function public.cbt_parse_dob(text) from public;

-- lookup: asks for the date of birth when the record has none
drop function if exists public.cbt_lookup(text, text, text, text, text);
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
  if want = '' and public.cbt_parse_dob(got) is null then
    return jsonb_build_object('error', 'EXAM-DOB: Your date of birth is not in the institute records yet. Please enter it as DD/MM/YYYY.');
  end if;
  return jsonb_build_array(jsonb_build_object('name', st.name, 'gcc', st.gcc_no::text,
    'className', coalesce(nullif(to_jsonb(st) ->> 'batch', ''), to_jsonb(st) ->> 'class_name', ''),
    'fatherName', coalesce(nullif(btrim(to_jsonb(st) ->> 'father_name'), ''), ''),
    'hasPhone', true, 'hasDob', want <> '', 'verified', true));
end $$;
revoke all on function public.cbt_lookup(text, text, text, text, text) from public;
grant execute on function public.cbt_lookup(text, text, text, text, text) to anon, authenticated;

drop function if exists public.cbt_start(text, text, text, text, text, text);
-- cbt_start: the same as before, and the attempt now carries the student's district / gender / caste from the ERP
create or replace function public.cbt_start(p_test text, p_code text, p_gcc text, p_parent text default null, p_phone text default null, p_dob text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; g text := ltrim(regexp_replace(coalesce(p_gcc, ''), '\D', '', 'g'), '0');
        par text := public.cbt_digits(p_parent); phones text[]; sess text := replace(gen_random_uuid()::text, '-', '');
        want text; got text := regexp_replace(coalesce(p_dob, ''), '\D', '', 'g'); j jsonb; nd date;
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
  j := to_jsonb(st);
  phones := public.cbt_student_phones(j);
  want := public.cbt_dob_digits(j ->> 'dob');
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
  if want = '' and public.cbt_parse_dob(got) is null then
    return jsonb_build_object('error', 'EXAM-DOB: Your date of birth is not in the institute records yet. Please enter it as DD/MM/YYYY.');
  end if;
  if (select count(*) from public.cbt_attempts where test_id = t.id) >= 2000 then raise exception 'EXAM-FULL: This exam has reached its limit of candidates. Ask the institute.'; end if;
  nd := case when want = '' then public.cbt_parse_dob(got) end;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, parent_phone, erp_match, phone_verified, token, session, ip_start, ip_last, district, gender, caste, dob_entered)
    values (t.id, btrim(st.name), g, nullif(left(btrim(coalesce(p_phone, '')), 20), ''), st.gcc_no::text, nullif(par, ''), true, true, tok, sess,
            public.cbt_client_ip(), public.cbt_client_ip(), nullif(btrim(j ->> 'district'), ''), nullif(btrim(j ->> 'gender'), ''), nullif(btrim(j ->> 'caste'), ''), nd)
    returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This GCC no. has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  -- the date of birth was missing in the ERP: keep what the (phone-verified) candidate typed — never overwrite one that exists
  if nd is not null then
    update public.students set dob = nd where id = st.id and nullif(btrim(coalesce(dob::text, '')), '') is null;
  end if;
  return jsonb_build_object('token', tok, 'session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;
revoke all on function public.cbt_start(text, text, text, text, text, text) from public;
grant execute on function public.cbt_start(text, text, text, text, text, text) to anon, authenticated;
