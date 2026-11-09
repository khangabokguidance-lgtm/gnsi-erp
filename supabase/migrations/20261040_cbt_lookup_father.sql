-- Online exam: the GCC lookup also returns the father's name, so the landing page can show it (read-only) next to the
-- name and class as another check that the candidate found themselves. Run AFTER 20261039_cbt_gcc_identity.sql
-- (which now includes this already — 20261040 is only kept so databases that ran the earlier 20261039 can catch up).

do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'cbt_attempts' and column_name = 'phone_verified') then
    raise exception 'Run 20261039_cbt_gcc_identity.sql first, then this one.';
  end if;
end $$;

drop function if exists public.cbt_lookup(text, text, text);   -- the old overload makes calls ambiguous

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
    'fatherName', coalesce(nullif(btrim(to_jsonb(st) ->> 'father_name'), ''), ''),
    'hasPhone', cardinality(phones) > 0,
    'verified', case when p_parent is null then null else ok end));
end $$;

revoke all on function public.cbt_lookup(text, text, text, text) from public;
grant execute on function public.cbt_lookup(text, text, text, text) to anon, authenticated;
