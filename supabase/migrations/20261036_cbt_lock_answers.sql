-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: "Lock answers". When a test has marking.lock = true, an answer already saved on the server cannot be
-- changed or removed by a later save or by the final submit (the saved answer wins), so editing the page in the
-- browser cannot get around the lock. Run after 20261034_cbt_online_exam.sql.
-- ─────────────────────────────────────────────────────────────────────────────

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
  final_answers := case when within and p_answers is not null then (case when coalesce((t.marking ->> 'lock')::boolean, false) then p_answers || a.answers else p_answers end) else a.answers end;
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
  update public.cbt_attempts set answers = case when p_answers is null then answers when coalesce((t.marking ->> 'lock')::boolean, false) then p_answers || answers else p_answers end, marked = coalesce(p_marked, marked), current_no = coalesce(p_current, current_no),
    lang = coalesce(p_lang, lang), switches = greatest(switches, coalesce(p_switches, 0)), saved_at = now() where id = a.id;
  return jsonb_build_object('submitted', false, 'serverNow', now(), 'savedAt', now());
end $$;
