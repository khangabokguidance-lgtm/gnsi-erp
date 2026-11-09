-- ─────────────────────────────────────────────────────────────────────────────
-- District (of Manipur) and Caste on the student record, and District / Gender / Caste on every CBT attempt.
--   • students.district, students.caste  — shown and edited in Students (the fields are optional)
--   • cbt_attempts.district / gender / caste — copied from the ERP record when a student starts, or chosen by a guest;
--     they feed the Results table, the CSV and the district / gender / category-wise analysis.
-- Run after 20261064. Safe to run more than once. The lists below must match src/lib/studentFields.js.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.students add column if not exists district text;
alter table public.students add column if not exists caste    text;

alter table public.cbt_attempts add column if not exists district text;
alter table public.cbt_attempts add column if not exists gender   text;
alter table public.cbt_attempts add column if not exists caste    text;

create or replace function public.cbt_district_ok(p text) returns boolean language sql immutable as $$
  select p = any (array['Bishnupur','Chandel','Churachandpur','Imphal East','Imphal West','Jiribam','Kakching','Kamjong',
                        'Kangpokpi','Noney','Pherzawl','Senapati','Tamenglong','Tengnoupal','Thoubal','Ukhrul','Outside Manipur'])
$$;
revoke all on function public.cbt_district_ok(text) from public;

-- cbt_start: the same as before, and the attempt now carries the student's district / gender / caste from the ERP
drop function if exists public.cbt_start(text, text, text, text, text, text);
create or replace function public.cbt_start(p_test text, p_code text, p_gcc text, p_parent text default null, p_phone text default null, p_dob text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; g text := ltrim(regexp_replace(coalesce(p_gcc, ''), '\D', '', 'g'), '0');
        par text := public.cbt_digits(p_parent); phones text[]; sess text := replace(gen_random_uuid()::text, '-', '');
        want text; got text := regexp_replace(coalesce(p_dob, ''), '\D', '', 'g'); j jsonb;
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
  if (select count(*) from public.cbt_attempts where test_id = t.id) >= 2000 then raise exception 'EXAM-FULL: This exam has reached its limit of candidates. Ask the institute.'; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, parent_phone, erp_match, phone_verified, token, session, ip_start, ip_last, district, gender, caste)
    values (t.id, btrim(st.name), g, nullif(left(btrim(coalesce(p_phone, '')), 20), ''), st.gcc_no::text, nullif(par, ''), true, true, tok, sess,
            public.cbt_client_ip(), public.cbt_client_ip(), nullif(btrim(j ->> 'district'), ''), nullif(btrim(j ->> 'gender'), ''), nullif(btrim(j ->> 'caste'), ''))
    returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This GCC no. has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;
revoke all on function public.cbt_start(text, text, text, text, text, text) from public;
grant execute on function public.cbt_start(text, text, text, text, text, text) to anon, authenticated;

-- cbt_start_guest: a guest now chooses district, gender and caste (checked against the lists)
drop function if exists public.cbt_start_guest(text, text, text, text);
create or replace function public.cbt_start_guest(p_test text, p_code text, p_name text, p_phone text, p_district text default null, p_gender text default null, p_caste text default null)
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
  if p_district is not null and not public.cbt_district_ok(p_district) then raise exception 'EXAM-INPUT: Choose your district from the list.'; end if;
  if p_gender is not null and p_gender not in ('Male', 'Female', 'Other') then raise exception 'EXAM-INPUT: Choose your gender from the list.'; end if;
  if p_caste is not null and p_caste not in ('General', 'OBC', 'SC', 'ST') then raise exception 'EXAM-INPUT: Choose your category from the list.'; end if;
  if (select count(*) from public.cbt_attempts where test_id = t.id) >= 2000 then raise exception 'EXAM-FULL: This exam has reached its limit of candidates. Ask the institute.'; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, erp_match, phone_verified, token, session, ip_start, ip_last, district, gender, caste)
    values (t.id, btrim(p_name), 'G' || ph, ph, null, false, false, tok, sess, public.cbt_client_ip(), public.cbt_client_ip(), p_district, p_gender, p_caste) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This mobile number has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;
revoke all on function public.cbt_start_guest(text, text, text, text, text, text, text) from public;
grant execute on function public.cbt_start_guest(text, text, text, text, text, text, text) to anon, authenticated;
