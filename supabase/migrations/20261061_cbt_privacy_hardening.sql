-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: privacy + identity hardening (run after 20261034 – 20261040).
--   1. The GCC lookup no longer hands out the student's name, class, father's name or phone hint before the
--      parent number is verified. Without a number it only says whether the GCC no. exists and whether a number is
--      on file. Details come back ONLY when the number matches.
--   2. A student with no parent number on file can no longer start by access code + GCC alone (anyone holding the
--      shared code could impersonate them). The candidate is asked to see the office; add the number in the ERP.
--   3. The per-GCC wrong-number lock is 20 tries / 10 minutes (was 10) so a classmate cannot lock a student out
--      as easily, and the lock still makes guessing a 10-digit number hopeless.
--   4. The network address used for the request limits now prefers Cloudflare's cf-connecting-ip (set by the edge,
--      not by the caller) and otherwise the LAST x-forwarded-for entry (added by the nearest proxy) — not the
--      first, which the caller can write. Verify in your project that cf-connecting-ip is present.
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.cbt_client_ip() returns text
language plpgsql stable as $$
declare h jsonb; x text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  x := nullif(btrim(coalesce(h ->> 'cf-connecting-ip', '')), '');
  if x is null then
    x := nullif(btrim((string_to_array(coalesce(h ->> 'x-forwarded-for', ''), ','))[greatest(cardinality(string_to_array(coalesce(h ->> 'x-forwarded-for', ''), ',')), 1)]), '');
  end if;
  return coalesce(x, nullif(btrim(coalesce(h ->> 'x-real-ip', '')), ''), 'unknown');
end $$;
revoke all on function public.cbt_client_ip() from public;

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
  -- no number on file: nothing else is revealed and the candidate cannot continue on their own
  if cardinality(phones) = 0 then
    return jsonb_build_array(jsonb_build_object('gcc', st.gcc_no::text, 'hasPhone', false, 'verified', false));
  end if;
  -- step 1 (no number typed yet): only "this GCC no. exists" — no name, class, father or phone hint
  if p_parent is null then
    return jsonb_build_array(jsonb_build_object('gcc', st.gcc_no::text, 'hasPhone', true, 'verified', null));
  end if;
  if (select count(*) from public.cbt_hits h where h.kind = 'phone:' || g and h.at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many wrong numbers for this GCC no. Wait ten minutes and try again, or ask the office.');
  end if;
  ok := length(par) >= 10 and par = any (phones);
  if not ok then
    perform public.cbt_hit('phone');
    insert into public.cbt_hits (ip, kind) values ('*', 'phone:' || g);
    return jsonb_build_array(jsonb_build_object('gcc', st.gcc_no::text, 'hasPhone', true, 'verified', false));
  end if;
  return jsonb_build_array(jsonb_build_object('name', st.name, 'gcc', st.gcc_no::text,
    'className', coalesce(nullif(to_jsonb(st) ->> 'batch', ''), to_jsonb(st) ->> 'class_name', ''),
    'fatherName', coalesce(nullif(btrim(to_jsonb(st) ->> 'father_name'), ''), ''),
    'hasPhone', true, 'verified', true));
end $$;
revoke all on function public.cbt_lookup(text, text, text, text) from public;
grant execute on function public.cbt_lookup(text, text, text, text) to anon, authenticated;

drop function if exists public.cbt_start(text, text, text, text, text);
create or replace function public.cbt_start(p_test text, p_code text, p_gcc text, p_parent text default null, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; g text := ltrim(regexp_replace(coalesce(p_gcc, ''), '\D', '', 'g'), '0');
        par text := public.cbt_digits(p_parent); phones text[]; sess text := replace(gen_random_uuid()::text, '-', '');
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
  if cardinality(phones) = 0 then
    return jsonb_build_object('error', 'EXAM-NOPHONE: No parent / guardian number is on file for this GCC no., so your identity cannot be checked online. Please ask the office to add it, then try again.');
  end if;
  if (select count(*) from public.cbt_hits h where h.kind = 'phone:' || g and h.at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('error', 'EXAM-LIMIT: Too many wrong numbers for this GCC no. Wait ten minutes and try again, or ask the office.');
  end if;
  if not (length(par) >= 10 and par = any (phones)) then
    perform public.cbt_hit('phone');
    insert into public.cbt_hits (ip, kind) values ('*', 'phone:' || g);
    return jsonb_build_object('error', 'EXAM-PHONE: This contact number does not match the one in the institute records. Use the parent / guardian number given at admission.');
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
revoke all on function public.cbt_start(text, text, text, text, text) from public;
grant execute on function public.cbt_start(text, text, text, text, text) to anon, authenticated;
