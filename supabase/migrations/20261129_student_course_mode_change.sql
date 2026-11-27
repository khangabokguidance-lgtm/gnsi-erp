-- ============================================================================
-- 20261129_student_course_mode_change.sql — change a student's course and/or
-- hostel type (Boarder / Day Boarder / Day Scholar) MIDWAY through a session,
-- in one safe database step.
--
-- What the app already had (kept as it is):
--   student_hostel_history (20260930) and student_course_history (20261111)
--   store each change with the month it takes effect. Months before it keep the
--   old price; months from it use the new course / type's Fee Setup rates.
--   Payments and receipts are never touched.
--
-- What this adds:
--   1. student_change_course_mode(...) — admin only. Saves the history row(s),
--      updates students (and the admissions mirror) and writes the audit_log
--      entry in ONE transaction, so a half-saved change (history saved, student
--      not updated, or the reverse) can't happen, and the audit entry is
--      written by the database, not the browser.
--   2. student_undo_course_mode_change(...) — admin only, undoes the LATEST
--      change of one kind, with a reason, audited.
--   3. A reason is now required on every new change (3+ characters).
--   4. Only the latest change of a student can be removed (undo). Older history
--      can't be deleted, and no history row can be edited — so earlier months'
--      prices can't be quietly rewritten.
--      A record CORRECTION (the type was wrong from the start) clears the
--      whole timeline through student_clear_hostel_history(), admin only.
--   5. Every insert / delete on the two history tables is written to audit_log
--      by the database, whoever did it.
--   6. Admin approval: staff REQUEST a change (student_request_course_mode);
--      nothing is re-priced until an admin approves it
--      (student_decide_course_mode_request). Each request has a form number
--      (CMC-2026-0001 …) and prints as an approval form with signature boxes.
--      A change an admin makes directly is saved as a self-approved request.
--
-- Needs: 20260925_qbank_rls.sql, 20260930_hostel_type_history.sql,
--        20261111_student_course_history.sql. Independent of the fee loophole
--        fixes (20261127 / 20261128) — run before or after them.
-- Safe to run more than once. Nothing existing is deleted or changed.
-- ============================================================================

do $$
begin
  if to_regclass('public.student_hostel_history') is null then
    raise exception 'Run 20260930_hostel_type_history.sql first.';
  end if;
  if to_regclass('public.student_course_history') is null then
    raise exception 'Run 20261111_student_course_history.sql first.';
  end if;
  if to_regprocedure('public.qbank_is_admin()') is null then
    raise exception 'Run 20260925_qbank_rls.sql first.';
  end if;
end $$;

-- ── 3. a reason on every NEW change (old rows without one are left alone) ────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'student_hostel_history_reason_req') then
    alter table public.student_hostel_history
      add constraint student_hostel_history_reason_req check (length(btrim(coalesce(reason, ''))) >= 3) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'student_course_history_reason_req') then
    alter table public.student_course_history
      add constraint student_course_history_reason_req check (length(btrim(coalesce(reason, ''))) >= 3) not valid;
  end if;
end $$;

-- who is acting, for the audit log
create or replace function public.scm_actor()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'system (SQL editor / service)')
$$;
revoke all on function public.scm_actor() from public;

-- audit_log column types differ between installs (text / jsonb), so insert
-- through format(%L) and let Postgres cast.
create or replace function public.scm_audit(p_action text, p_by text, p_target text, p_old jsonb, p_new jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.audit_log') is null then return; end if;
  execute format(
    'insert into public.audit_log (action, changed_by, target_id, old_values, new_values, created_at) values (%L, %L, %L, %L, %L, %L)',
    p_action, p_by, p_target, p_old::text, p_new::text, now());
end $$;
revoke all on function public.scm_audit(text, text, text, jsonb, jsonb) from public;

-- ── 4 + 5. history rows: never edited, only the latest removed, all audited ──
create or replace function public.scm_history_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare newest uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'A course / hostel type change can''t be edited. Undo it and save a new one.';
  end if;
  -- DELETE: a record correction (student_clear_hostel_history) may clear the
  -- whole timeline; otherwise only the student's latest change (an undo).
  if coalesce(current_setting('scm.clearing', true), '') = old.gcc_no and public.qbank_is_admin() then
    return old;
  end if;
  execute format('select id from public.%I where gcc_no = $1 order by effective_from desc, created_at desc limit 1', tg_table_name)
    into newest using old.gcc_no;
  if newest is distinct from old.id then
    raise exception 'Only the latest change can be undone — earlier months keep their recorded course / hostel type.';
  end if;
  return old;
end $$;
revoke all on function public.scm_history_guard() from public;

create or replace function public.scm_history_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  perform public.scm_audit(
    tg_table_name || '_' || lower(tg_op),
    public.scm_actor(),
    coalesce(r.student_id, ''),
    case when tg_op = 'DELETE' then to_jsonb(old) || jsonb_build_object('source', 'database') else null end,
    case when tg_op = 'INSERT' then to_jsonb(new) || jsonb_build_object('source', 'database') else jsonb_build_object('source', 'database', 'removed', true) end);
  return null;
end $$;
revoke all on function public.scm_history_audit() from public;

do $$
declare t text;
begin
  foreach t in array array['student_hostel_history', 'student_course_history'] loop
    execute format('drop trigger if exists scm_history_guard on public.%I', t);
    execute format('create trigger scm_history_guard before update or delete on public.%I for each row execute function public.scm_history_guard()', t);
    execute format('drop trigger if exists scm_history_audit on public.%I', t);
    execute format('create trigger scm_history_audit after insert or delete on public.%I for each row execute function public.scm_history_audit()', t);
  end loop;
end $$;


-- ── 6. change REQUESTS that wait for Admin approval ─────────────────────────
-- Any staff member can request a change; nothing is re-priced until an admin
-- approves it. Each request has a form number and prints as an A4 approval
-- form with signature boxes. Requests are never deleted or edited directly:
-- only the functions below move them pending → approved / rejected / cancelled.
create sequence if not exists public.student_course_mode_form_seq;

create table if not exists public.student_course_mode_requests (
  id              uuid primary key default gen_random_uuid(),
  form_no         text unique default ('CMC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.student_course_mode_form_seq')::text, 4, '0')),
  created_at      timestamptz not null default now(),
  student_id      text not null,
  gcc_no          text not null,
  student_name    text,
  from_course     text,
  from_batch      text,
  from_type       text,
  to_course       text,                  -- null = course not changing
  to_batch        text,
  to_type         text check (to_type is null or to_type in ('Boarder', 'Day Boarder', 'Day Scholar')),
  effective_from  date not null check (extract(day from effective_from) = 1),
  reason          text not null check (length(btrim(reason)) >= 3),
  fee_impact      jsonb,                 -- the preview shown when requesting (for the printed form)
  requested_by    text,
  requester_email text default lower(coalesce(auth.jwt() ->> 'email', '')),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by      text,
  decider_email   text,
  decided_at      timestamptz,
  decision_note   text
);
create index if not exists student_course_mode_requests_gcc_idx on public.student_course_mode_requests (gcc_no, created_at desc);
create index if not exists student_course_mode_requests_status_idx on public.student_course_mode_requests (status, created_at desc);

alter table public.student_course_mode_requests enable row level security;
drop policy if exists scm_requests_read on public.student_course_mode_requests;
create policy scm_requests_read on public.student_course_mode_requests for select to authenticated using (public.qbank_is_staff());
-- no insert / update / delete policies: only the functions below write here.

create or replace function public.scm_request_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Course / hostel type change requests are never deleted.';
  end if;
  if tg_op = 'UPDATE' and tg_when = 'BEFORE' then
    if old.status <> 'pending' then
      raise exception 'This request is already % and can''t be changed.', old.status;
    end if;
    if row(new.student_id, new.gcc_no, new.from_course, new.from_batch, new.from_type, new.to_course, new.to_batch, new.to_type, new.effective_from, new.reason, new.form_no, new.created_at)
       is distinct from row(old.student_id, old.gcc_no, old.from_course, old.from_batch, old.from_type, old.to_course, old.to_batch, old.to_type, old.effective_from, old.reason, old.form_no, old.created_at) then
      raise exception 'A request''s details can''t be edited. Cancel it and make a new one.';
    end if;
    return new;
  end if;
  perform public.scm_audit(
    'course_mode_request_' || case when tg_op = 'INSERT' then 'created' else new.status end,
    public.scm_actor(), new.student_id,
    case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status) else null end,
    to_jsonb(new) || jsonb_build_object('source', 'database'));
  return new;
end $$;
revoke all on function public.scm_request_audit() from public;
drop trigger if exists scm_request_audit on public.student_course_mode_requests;
create trigger scm_request_audit after insert or update on public.student_course_mode_requests
  for each row execute function public.scm_request_audit();
drop trigger if exists scm_request_no_delete on public.student_course_mode_requests;
create trigger scm_request_no_delete before update or delete on public.student_course_mode_requests
  for each row execute function public.scm_request_audit();

-- ── 1. one-step change ──────────────────────────────────────────────────────
-- Pass p_to_type and/or p_to_course (null = leave as it is). p_to_batch null =
-- keep the current batch. p_effective_from = first day of the month the change
-- starts. Returns the student's new course / batch / hostel_type.
create or replace function public.student_change_course_mode(
  p_student_id     text,
  p_effective_from date,
  p_reason         text,
  p_to_type        text default null,
  p_to_course      text default null,
  p_to_batch       text default null,
  p_by             text default null,
  p_request_id     uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s          record;
  gcc        text;
  cur_type   text;
  new_batch  text;
  last_eff   date;
  did_type   boolean := false;
  did_course boolean := false;
  req_id     uuid := p_request_id;
  req_no     text;
  who        text := coalesce(nullif(btrim(p_by), ''), 'Admin') || ' <' || public.scm_actor() || '>';
begin
  if not public.qbank_is_admin() then
    raise exception 'Only an admin can change a student''s course or hostel type.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the change.';
  end if;
  if p_effective_from is null or extract(day from p_effective_from) <> 1 then
    raise exception 'Choose the month the change starts.';
  end if;
  if p_to_type is null and p_to_course is null then
    raise exception 'Choose the new course or hostel type.';
  end if;

  select * into s from public.students where id::text = p_student_id for update;
  if not found then raise exception 'Student not found.'; end if;
  gcc := (nullif(regexp_replace(coalesce(s.gcc_no::text, ''), '\D', '', 'g'), '')::bigint)::text;
  if gcc is null or gcc = '0' then raise exception 'This student has no GCC No.'; end if;
  cur_type := coalesce(nullif(s.hostel_type, ''), 'Day Scholar');

  -- hostel type
  if p_to_type is not null and p_to_type <> cur_type then
    if p_to_type not in ('Boarder', 'Day Boarder', 'Day Scholar') then
      raise exception 'Choose Boarder, Day Boarder or Day Scholar.';
    end if;
    select max(effective_from) into last_eff from public.student_hostel_history where gcc_no = gcc;
    if last_eff is not null and p_effective_from < last_eff then
      raise exception 'The last hostel type change took effect on % — a new change can''t start before it.', last_eff;
    end if;
    insert into public.student_hostel_history (student_id, gcc_no, student_name, from_type, to_type, effective_from, reason, changed_by)
      values (p_student_id, gcc, s.name, cur_type, p_to_type, p_effective_from, btrim(p_reason), coalesce(p_by, 'Admin'));
    update public.students set hostel_type = p_to_type where id::text = p_student_id;
    if to_regclass('public.admissions') is not null then
      begin
        execute 'update public.admissions set hostel_type = $1 where gcc_no::text = $2 or gcc_no::text = $3'
          using p_to_type, gcc, s.gcc_no::text;
      exception when others then null;  -- mirror only
      end;
    end if;
    did_type := true;
  end if;

  -- course / batch
  if p_to_course is not null then
    new_batch := coalesce(p_to_batch, s.batch, '');
    if p_to_course <> coalesce(s.course, '') or new_batch <> coalesce(s.batch, '') then
      select max(effective_from) into last_eff from public.student_course_history where gcc_no = gcc;
      if last_eff is not null and p_effective_from < last_eff then
        raise exception 'The last course change took effect on % — a new change can''t start before it.', last_eff;
      end if;
      insert into public.student_course_history (student_id, gcc_no, student_name, from_course, to_course, from_batch, to_batch, effective_from, reason, changed_by)
        values (p_student_id, gcc, s.name, coalesce(s.course, ''), p_to_course, coalesce(s.batch, ''), new_batch, p_effective_from, btrim(p_reason), coalesce(p_by, 'Admin'));
      update public.students set course = p_to_course, batch = new_batch where id::text = p_student_id;
      did_course := true;
    end if;
  end if;

  if not did_type and not did_course then
    raise exception '% is already in this course and hostel type.', s.name;
  end if;

  -- Every change has an approval form. A change an admin makes directly is
  -- recorded as a request the same admin approved (so it can be printed too).
  if req_id is null then
    insert into public.student_course_mode_requests
      (student_id, gcc_no, student_name, from_course, from_batch, from_type, to_course, to_batch, to_type,
       effective_from, reason, requested_by, status, decided_by, decider_email, decided_at, decision_note)
    values (p_student_id, gcc, s.name, coalesce(s.course, ''), coalesce(s.batch, ''), cur_type,
       case when did_course then p_to_course end, case when did_course then new_batch end, case when did_type then p_to_type end,
       p_effective_from, btrim(p_reason), coalesce(p_by, 'Admin'), 'approved', coalesce(p_by, 'Admin'), public.scm_actor(), now(),
       'Made directly by an admin')
    returning id, form_no into req_id, req_no;
  else
    select form_no into req_no from public.student_course_mode_requests where id = req_id;
  end if;

  perform public.scm_audit(
    'student_course_mode_changed', who, p_student_id,
    jsonb_build_object('course', s.course, 'batch', s.batch, 'hostel_type', cur_type),
    jsonb_build_object('gcc', gcc, 'student_name', s.name, 'effective_from', p_effective_from, 'reason', btrim(p_reason),
      'hostel_type', case when did_type then p_to_type else cur_type end,
      'course', case when did_course then p_to_course else s.course end,
      'batch', case when did_course then new_batch else s.batch end,
      'request_id', req_id, 'form_no', req_no,
      'source', 'database'));

  return jsonb_build_object(
    'course', case when did_course then p_to_course else s.course end,
    'batch', case when did_course then new_batch else s.batch end,
    'hostel_type', case when did_type then p_to_type else cur_type end,
    'request_id', req_id, 'form_no', req_no);
end $$;
revoke all on function public.student_change_course_mode(text, date, text, text, text, text, text, uuid) from public;
grant execute on function public.student_change_course_mode(text, date, text, text, text, text, text, uuid) to authenticated;

-- ── 2. undo the latest change of one kind ('hostel' | 'course') ─────────────
create or replace function public.student_undo_course_mode_change(
  p_student_id text,
  p_kind       text,
  p_reason     text,
  p_by         text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s    record;
  gcc  text;
  h    record;
  c    record;
  who  text := coalesce(nullif(btrim(p_by), ''), 'Admin') || ' <' || public.scm_actor() || '>';
begin
  if not public.qbank_is_admin() then
    raise exception 'Only an admin can undo a course or hostel type change.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the undo.';
  end if;
  select * into s from public.students where id::text = p_student_id for update;
  if not found then raise exception 'Student not found.'; end if;
  gcc := (nullif(regexp_replace(coalesce(s.gcc_no::text, ''), '\D', '', 'g'), '')::bigint)::text;

  if p_kind = 'hostel' then
    select * into h from public.student_hostel_history where gcc_no = gcc order by effective_from desc, created_at desc limit 1;
    if not found then raise exception 'No hostel type change to undo.'; end if;
    delete from public.student_hostel_history where id = h.id;
    update public.students set hostel_type = h.from_type where id::text = p_student_id;
    if to_regclass('public.admissions') is not null then
      begin
        execute 'update public.admissions set hostel_type = $1 where gcc_no::text = $2 or gcc_no::text = $3'
          using h.from_type, gcc, s.gcc_no::text;
      exception when others then null;
      end;
    end if;
    perform public.scm_audit('hostel_type_change_undone', who, p_student_id, to_jsonb(h),
      jsonb_build_object('gcc', gcc, 'student_name', s.name, 'hostel_type', h.from_type, 'reason', btrim(p_reason), 'source', 'database'));
    return jsonb_build_object('hostel_type', h.from_type, 'course', s.course, 'batch', s.batch);
  elsif p_kind = 'course' then
    select * into c from public.student_course_history where gcc_no = gcc order by effective_from desc, created_at desc limit 1;
    if not found then raise exception 'No course change to undo.'; end if;
    delete from public.student_course_history where id = c.id;
    update public.students set course = c.from_course, batch = coalesce(c.from_batch, s.batch, '') where id::text = p_student_id;
    perform public.scm_audit('course_change_undone', who, p_student_id, to_jsonb(c),
      jsonb_build_object('gcc', gcc, 'student_name', s.name, 'course', c.from_course, 'batch', coalesce(c.from_batch, s.batch, ''), 'reason', btrim(p_reason), 'source', 'database'));
    return jsonb_build_object('course', c.from_course, 'batch', coalesce(c.from_batch, s.batch, ''), 'hostel_type', s.hostel_type);
  else
    raise exception 'Choose what to undo: hostel or course.';
  end if;
end $$;
revoke all on function public.student_undo_course_mode_change(text, text, text, text) from public;
grant execute on function public.student_undo_course_mode_change(text, text, text, text) to authenticated;

-- ── record correction: the hostel type was WRONG ALL ALONG ──────────────────
-- (e.g. Fees → Hostel issues → "fix to match the bed"). Clears the student's
-- hostel-type timeline so the current type applies to every month. Admin only,
-- reason required, the removed rows are kept in the audit log.
create or replace function public.student_clear_hostel_history(p_gcc text, p_reason text, p_by text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  g   text := (nullif(regexp_replace(coalesce(p_gcc, ''), '\D', '', 'g'), '')::bigint)::text;
  old jsonb;
  n   integer;
begin
  if not public.qbank_is_admin() then
    raise exception 'Only an admin can correct a student''s hostel type.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the correction.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.effective_from), '[]'::jsonb) into old
    from public.student_hostel_history h where h.gcc_no = g;
  perform set_config('scm.clearing', g, true);
  delete from public.student_hostel_history where gcc_no = g;
  get diagnostics n = row_count;
  perform set_config('scm.clearing', '', true);
  if n > 0 then
    perform public.scm_audit('hostel_history_cleared',
      coalesce(nullif(btrim(p_by), ''), 'Admin') || ' <' || public.scm_actor() || '>', g,
      jsonb_build_object('history', old),
      jsonb_build_object('gcc', g, 'reason', btrim(p_reason), 'source', 'database'));
  end if;
  return n;
end $$;
revoke all on function public.student_clear_hostel_history(text, text, text) from public;
grant execute on function public.student_clear_hostel_history(text, text, text) to authenticated;

-- ── request (any staff) ─────────────────────────────────────────────────────
create or replace function public.student_request_course_mode(
  p_student_id     text,
  p_effective_from date,
  p_reason         text,
  p_to_type        text default null,
  p_to_course      text default null,
  p_to_batch       text default null,
  p_by             text default null,
  p_fee_impact     jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        record;
  gcc      text;
  cur_type text;
  r        record;
begin
  if not public.qbank_is_staff() then
    raise exception 'Only staff can request a course or hostel type change.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the change.';
  end if;
  if p_effective_from is null or extract(day from p_effective_from) <> 1 then
    raise exception 'Choose the month the change starts.';
  end if;
  select * into s from public.students where id::text = p_student_id;
  if not found then raise exception 'Student not found.'; end if;
  gcc := (nullif(regexp_replace(coalesce(s.gcc_no::text, ''), '\D', '', 'g'), '')::bigint)::text;
  cur_type := coalesce(nullif(s.hostel_type, ''), 'Day Scholar');
  if p_to_type = cur_type then p_to_type := null; end if;
  if p_to_course is not null and p_to_course = coalesce(s.course, '') and coalesce(p_to_batch, s.batch, '') = coalesce(s.batch, '') then
    p_to_course := null; p_to_batch := null;
  end if;
  if p_to_type is null and p_to_course is null then
    raise exception '% is already in this course and hostel type.', s.name;
  end if;
  if exists (select 1 from public.student_course_mode_requests where gcc_no = gcc and status = 'pending') then
    raise exception '% already has a change waiting for approval. Approve, reject or cancel it first.', s.name;
  end if;
  insert into public.student_course_mode_requests
    (student_id, gcc_no, student_name, from_course, from_batch, from_type, to_course, to_batch, to_type,
     effective_from, reason, fee_impact, requested_by)
  values (p_student_id, gcc, s.name, coalesce(s.course, ''), coalesce(s.batch, ''), cur_type,
     p_to_course, case when p_to_course is not null then coalesce(p_to_batch, s.batch, '') end, p_to_type,
     p_effective_from, btrim(p_reason), p_fee_impact, coalesce(nullif(btrim(p_by), ''), public.scm_actor()))
  returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.student_request_course_mode(text, date, text, text, text, text, text, jsonb) from public;
grant execute on function public.student_request_course_mode(text, date, text, text, text, text, text, jsonb) to authenticated;

-- ── approve / reject (admin) ────────────────────────────────────────────────
-- Approving applies the change exactly as requested. If the student's course or
-- hostel type changed since the request was made, it is refused (reject it and
-- request again).
create or replace function public.student_decide_course_mode_request(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null,
  p_by         text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q   record;
  s   record;
  res jsonb := '{}'::jsonb;
begin
  if not public.qbank_is_admin() then
    raise exception 'Only an admin can approve or reject a change request.';
  end if;
  select * into q from public.student_course_mode_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if q.status <> 'pending' then raise exception 'This request is already %.', q.status; end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Give a reason for rejecting the request.';
  end if;

  if p_approve then
    select * into s from public.students where id::text = q.student_id;
    if not found then raise exception 'Student not found.'; end if;
    if coalesce(nullif(s.hostel_type, ''), 'Day Scholar') <> q.from_type
       or coalesce(s.course, '') <> coalesce(q.from_course, '')
       or coalesce(s.batch, '') <> coalesce(q.from_batch, '') then
      raise exception 'The student''s course or hostel type changed after this request was made. Reject it and request again.';
    end if;
    res := public.student_change_course_mode(q.student_id, q.effective_from, q.reason,
             q.to_type, q.to_course, q.to_batch, coalesce(p_by, 'Admin'), q.id);
  end if;

  update public.student_course_mode_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = coalesce(nullif(btrim(p_by), ''), public.scm_actor()),
         decider_email = public.scm_actor(),
         decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = q.id;
  return res || jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end, 'form_no', q.form_no);
end $$;
revoke all on function public.student_decide_course_mode_request(uuid, boolean, text, text) from public;
grant execute on function public.student_decide_course_mode_request(uuid, boolean, text, text) to authenticated;

-- ── cancel (the requester, or an admin) while still pending ─────────────────
create or replace function public.student_cancel_course_mode_request(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare q record;
begin
  select * into q from public.student_course_mode_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if q.status <> 'pending' then raise exception 'This request is already %.', q.status; end if;
  if not (public.qbank_is_admin() or (public.qbank_is_staff() and q.requester_email <> '' and q.requester_email = lower(public.scm_actor()))) then
    raise exception 'Only the person who asked, or an admin, can cancel this request.';
  end if;
  update public.student_course_mode_requests
     set status = 'cancelled', decided_by = public.scm_actor(), decider_email = public.scm_actor(), decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = q.id;
end $$;
revoke all on function public.student_cancel_course_mode_request(uuid, text) from public;
grant execute on function public.student_cancel_course_mode_request(uuid, text) to authenticated;

notify pgrst, 'reload schema';
