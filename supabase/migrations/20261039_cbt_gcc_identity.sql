-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: the candidate is identified by GCC no. only (run after 20261034–20261038).
--   • The candidate types the access code and their GCC no.; the name and class come from the ERP student record
--     (no free-typed name or roll no. any more — the roll no. is the GCC no.).
--   • They must also type a parent / guardian contact number that matches a number on the ERP record. A hint shows
--     the last four digits of the number on file. Wrong numbers are limited (10 per GCC no. and 15 per network
--     every 10 minutes). A student with no number on file can still start; the attempt is marked "not verified".
--   • The finder no longer searches by name — a GCC no. is matched exactly — so the student list cannot be browsed.
--   • The old cbt_start / cbt_lookup (free-typed name) are removed so they cannot be used to get round this.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cbt_attempts add column if not exists phone_verified boolean not null default false;

-- every 10-digit number on a student record (parent, father, mother, guardian …)
create or replace function public.cbt_student_phones(j jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct d) filter (where length(d) = 10), '{}'::text[]) from (
    select public.cbt_digits(j ->> k) as d
    from unnest(array['parent_phone', 'father_phone', 'mother_phone', 'guardian_phone', 'guardian_mobile', 'parent_contact', 'whatsapp_no', 'mobile', 'phone']) k) x
$$;

drop function if exists public.cbt_lookup(text, text, text);
create or replace function public.cbt_lookup(p_test text, p_code text, p_q text, p_parent text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; g text := ltrim(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '0'); st public.students; phones text[]; par text := public.cbt_digits(p_parent); ok boolean;
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
  if p_parent is not null then
    if (select count(*) from public.cbt_hits h where h.kind = 'phone:' || g and h.at > now() - interval '10 minutes') >= 10 then
      return jsonb_build_object('error', 'EXAM-LIMIT: Too many wrong numbers for this GCC no. Wait ten minutes and try again, or ask the office.');
    end if;
    ok := case when cardinality(phones) = 0 then null else par = any (phones) end;
    if ok is false then
      perform public.cbt_hit('phone');
      insert into public.cbt_hits (ip, kind) values ('*', 'phone:' || g);
    end if;
  end if;
  return jsonb_build_array(jsonb_build_object('name', st.name, 'gcc', st.gcc_no::text,
    'className', coalesce(nullif(to_jsonb(st) ->> 'batch', ''), to_jsonb(st) ->> 'class_name', ''),
    'phoneHint', case when cardinality(phones) > 0 then '••••••' || right(phones[1], 4) else '' end,
    'hasPhone', cardinality(phones) > 0,
    'verified', case when p_parent is null then null else ok end));
end $$;

drop function if exists public.cbt_start(text, text, text, text, text, text, text);
create or replace function public.cbt_start(p_test text, p_code text, p_gcc text, p_parent text default null, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; g text := ltrim(regexp_replace(coalesce(p_gcc, ''), '\D', '', 'g'), '0');
        par text := public.cbt_digits(p_parent); phones text[]; ok boolean; sess text := replace(gen_random_uuid()::text, '-', '');
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
  if cardinality(phones) > 0 then
    if (select count(*) from public.cbt_hits h where h.kind = 'phone:' || g and h.at > now() - interval '10 minutes') >= 10 then
      return jsonb_build_object('error', 'EXAM-LIMIT: Too many wrong numbers for this GCC no. Wait ten minutes and try again, or ask the office.');
    end if;
    ok := par = any (phones);
    if not ok then
      perform public.cbt_hit('phone');
      insert into public.cbt_hits (ip, kind) values ('*', 'phone:' || g);
      return jsonb_build_object('error', 'EXAM-PHONE: This contact number does not match the one in the institute records. Use the parent / guardian number given at admission.');
    end if;
  end if;
  if (select count(*) from public.cbt_attempts where test_id = t.id) >= 2000 then raise exception 'EXAM-FULL: This exam has reached its limit of candidates. Ask the institute.'; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, parent_phone, erp_match, phone_verified, token, session, ip_start, ip_last)
    values (t.id, btrim(st.name), g, nullif(left(btrim(coalesce(p_phone, '')), 20), ''), st.gcc_no::text, nullif(par, ''), true, cardinality(phones) > 0, tok, sess,
            public.cbt_client_ip(), public.cbt_client_ip()) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This GCC no. has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'session', sess, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;

revoke all on function public.cbt_student_phones(jsonb) from public;
revoke all on function public.cbt_lookup(text, text, text, text) from public;
revoke all on function public.cbt_start(text, text, text, text, text) from public;
grant execute on function public.cbt_lookup(text, text, text, text) to anon, authenticated;
grant execute on function public.cbt_start(text, text, text, text, text) to anon, authenticated;
