-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: recognise the candidate from the ERP student list.
--   • cbt_lookup  — a candidate types their name or GCC no.; matching active students come back
--                   (name, class, GCC, masked parent phone). Only works for a valid exam link that has an
--                   access code, so the student list cannot be browsed by strangers.
--   • cbt_start   — now also stores the GCC no. and the parent's contact number, and flags whether the GCC no.
--                   exists in the ERP. If the parent number is left blank it is taken from the ERP record.
-- Run after 20261034_cbt_online_exam.sql.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cbt_attempts add column if not exists gcc_no text;
alter table public.cbt_attempts add column if not exists parent_phone text;
alter table public.cbt_attempts add column if not exists erp_match boolean not null default false;

create or replace function public.cbt_digits(p text) returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10) $$;

create or replace function public.cbt_student_phone(j jsonb) returns text language sql immutable as $$
  select public.cbt_digits(coalesce(nullif(btrim(j ->> 'parent_phone'), ''), nullif(btrim(j ->> 'father_phone'), ''),
    nullif(btrim(j ->> 'mother_phone'), ''), nullif(btrim(j ->> 'guardian_phone'), ''), nullif(btrim(j ->> 'guardian_mobile'), ''),
    nullif(btrim(j ->> 'parent_contact'), ''), nullif(btrim(j ->> 'mobile'), ''), nullif(btrim(j ->> 'phone'), ''))) $$;

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
  if coalesce(btrim(t.access_code), '') = '' or lower(btrim(coalesce(p_code, ''))) <> lower(btrim(t.access_code)) then
    raise exception 'EXAM-CODE: Enter the access code first.';
  end if;
  if length(q) < 1 or (q !~ '^[0-9 ]+$' and length(q) < 3) then return '[]'::jsonb; end if;   -- a GCC no. is matched exactly; a name needs 3+ letters
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

drop function if exists public.cbt_start(text, text, text, text, text);
create or replace function public.cbt_start(p_test text, p_code text, p_name text, p_roll text, p_phone text default null,
                                            p_gcc text default null, p_parent text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.cbt_tests; a public.cbt_attempts; tok text; st public.students; gcc text := nullif(btrim(coalesce(p_gcc, '')), ''); par text := public.cbt_digits(p_parent); hit boolean := false;
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
  if length(par) < 10 then par := ''; end if;
  if gcc is not null then
    gcc := left(gcc, 20);
    select * into st from public.students s where ltrim(s.gcc_no::text, '0') = ltrim(gcc, '0') limit 1;
    hit := found;
    if hit and par = '' then par := public.cbt_student_phone(to_jsonb(st)); end if;
  end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.cbt_attempts (test_id, candidate_name, roll, phone, gcc_no, parent_phone, erp_match, token)
    values (t.id, btrim(p_name), btrim(p_roll), nullif(left(btrim(coalesce(p_phone, '')), 20), ''), gcc, nullif(par, ''), hit, tok) returning * into a;
  exception when unique_violation then
    raise exception 'EXAM-DUP: This roll number has already started the exam. Open the exam on the same device to continue, or ask the institute to reset it.';
  end;
  return jsonb_build_object('token', tok, 'attempt', public.cbt_state_json(a), 'test', public.cbt_paper(t));
end $$;

revoke all on function public.cbt_lookup(text, text, text) from public;
revoke all on function public.cbt_start(text, text, text, text, text, text, text) from public;
grant execute on function public.cbt_lookup(text, text, text) to anon, authenticated;
grant execute on function public.cbt_start(text, text, text, text, text, text, text) to anon, authenticated;
