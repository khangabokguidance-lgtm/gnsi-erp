-- ============================================================================
-- Fee loophole fixes, part 1 (review of 2026-11-27)
-- ============================================================================
-- Closes the money loopholes an ordinary staff login could use, on the three
-- fee tables (adm_flat_fees, adm_course_fees, adm_fee_collections):
--
--   H1  Once money is recorded, only an admin can mark the row unpaid
--       (paid = false) or change its status. Before this, any staff member could
--       "un-pay" a hostel / flat fee with no reason, approval or log.
--   H2  Once money is recorded, only an admin can change the pay mode, or
--       replace the payment reference, receipt number, receipt serial or
--       Collected By. Filling in a value that is still blank is allowed. This
--       stops cash being relabelled as UPI / cheque before Day Close.
--   H3  Fee rows cannot be deleted from the app, by anyone. The one legitimate
--       delete (undoing a payment the app just saved when its Accounts entry
--       failed) goes through fee_rollback_unsaved(), which only removes a row
--       the same login saved in the last 15 minutes, and is logged.
--   H5  The database itself writes an audit_log entry for every fee row that is
--       added, changed or removed, with the real login, so nothing done outside
--       the screens goes unrecorded (action = fee_row_insert / _update / _delete).
--   M7  Every payment is stamped with the real login that recorded it
--       (recorded_by_uid, recorded_at). The app cannot change these.
--
-- Admins keep every correction they have today (revert, amount, date, month).
-- The SQL editor / service role (Razorpay webhook) is exempt, like the other
-- fee guards. Existing rows are not changed.
--
-- REQUIRES 20260925_qbank_rls.sql and 20261006_fee_integrity_guards.sql
-- (qbank_is_admin, fee_is_app_caller). Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.qbank_is_admin()') is null
     or to_regprocedure('public.fee_is_app_caller()') is null then
    raise exception 'Run 20260925_qbank_rls.sql and 20261006_fee_integrity_guards.sql first.';
  end if;
  if to_regclass('public.audit_log') is null then
    raise exception 'public.audit_log does not exist.';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_log'
        and column_name in ('action', 'changed_by', 'target_id', 'old_values', 'new_values', 'created_at')) < 6 then
    raise exception 'audit_log is missing one of: action, changed_by, target_id, old_values, new_values, created_at.';
  end if;
end $$;

-- ── who is acting (for the audit log) ───────────────────────────────────────
create or replace function public.fee_actor_label()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pu.username from public.portal_users pu
      where auth.uid() is not null
        and regexp_replace(lower(trim(pu.username)), '[^a-z0-9._-]', '_', 'g')
            || '.staff@guidancekhangabok.in' = lower(coalesce(auth.jwt() ->> 'email', ''))
      limit 1),
    nullif(auth.jwt() ->> 'email', ''),
    case when public.fee_is_app_caller() then 'unknown app user' else 'system (SQL editor / service)' end)
$$;
revoke all on function public.fee_actor_label() from public;

-- Does this row carry real money? (not reverted, not an unpaid placeholder,
-- not a pending / failed online payment)
create or replace function public.fee_row_has_money(j jsonb)
returns boolean
language sql
immutable
as $$
  select not coalesce((j ->> 'reverted')::boolean, false)
     and (not (j ? 'paid') or coalesce((j ->> 'paid')::boolean, false))
     and (not (j ? 'status') or coalesce(j ->> 'status', '') in ('', 'paid'))
$$;

-- ── M7: stamp the real login on every payment ───────────────────────────────
create or replace function public.fee_stamp_recorder()
returns trigger
language plpgsql
as $$
declare
  nj jsonb := to_jsonb(new);
  becomes_money boolean;
begin
  if tg_op = 'INSERT' then
    becomes_money := true;
  else
    becomes_money := public.fee_row_has_money(nj) and not public.fee_row_has_money(to_jsonb(old));
  end if;
  if becomes_money then
    -- a new payment (or a placeholder / reverted row collected again)
    new.recorded_by_uid := auth.uid();
    new.recorded_at := now();
  else
    new.recorded_by_uid := old.recorded_by_uid;
    new.recorded_at := old.recorded_at;
  end if;
  return new;
end $$;

-- ── H1 + H2: lock the money columns of a recorded payment ───────────────────
create or replace function public.fee_row_lock_guard()
returns trigger
language plpgsql
as $$
declare
  oj jsonb := to_jsonb(old);
  nj jsonb := to_jsonb(new);
  k text;
begin
  if not public.fee_is_app_caller() or public.qbank_is_admin() then
    return new;
  end if;
  if not public.fee_row_has_money(oj) then
    return new;   -- placeholder / reverted / pending row: collecting it is allowed
  end if;

  -- H1: the payment must stay a payment (reverting is already admin-only)
  if (oj -> 'paid') is distinct from (nj -> 'paid') then
    raise exception 'Only an admin can mark a recorded fee payment as unpaid' using errcode = 'check_violation';
  end if;
  if (oj -> 'status') is distinct from (nj -> 'status') then
    raise exception 'Only an admin can change the status of a recorded fee payment' using errcode = 'check_violation';
  end if;

  -- H2: these never change once recorded
  foreach k in array array['pay_mode', 'payment_mode', 'payment_method', 'fee_type'] loop
    if (oj -> k) is distinct from (nj -> k) then
      raise exception 'Only an admin can change % on a recorded fee payment', k using errcode = 'check_violation';
    end if;
  end loop;

  -- H2: these may be filled in while blank, but not replaced
  foreach k in array array['txn_ref', 'receipt_no', 'receipt_serial', 'collected_by'] loop
    if coalesce(btrim(oj ->> k), '') <> '' and (oj -> k) is distinct from (nj -> k) then
      raise exception 'Only an admin can change % on a recorded fee payment', k using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;

-- ── H3: no deletes from the app ─────────────────────────────────────────────
create or replace function public.fee_row_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if public.fee_is_app_caller()
     and coalesce(current_setting('gnsi.fee_rollback', true), '') <> 'on' then
    raise exception 'Fee payments cannot be deleted. Ask an admin to revert the payment instead.' using errcode = 'insufficient_privilege';
  end if;
  return old;
end $$;

-- Undo a payment the app has JUST saved, when its Accounts entry failed.
-- Only the login that saved it, only within 15 minutes. The delete is logged by
-- fee_row_audit like any other change.
create or replace function public.fee_rollback_unsaved(p_table text, p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  n integer;
begin
  if p_table not in ('adm_flat_fees', 'adm_course_fees', 'adm_fee_collections') then
    raise exception 'Not a fee table: %', p_table;
  end if;
  if auth.uid() is null then
    raise exception 'Sign in again to undo a payment.';
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id::text = $1', p_table) into r using p_id;
  if r is null then
    return false;
  end if;
  if (r ->> 'recorded_by_uid') is distinct from auth.uid()::text
     or coalesce((r ->> 'recorded_at')::timestamptz, '-infinity') < now() - interval '15 minutes' then
    raise exception 'Only a payment you saved in the last 15 minutes can be undone this way. Ask an admin to revert it.';
  end if;
  perform set_config('gnsi.fee_rollback', 'on', true);
  execute format('delete from public.%I t where t.id::text = $1', p_table) using p_id;
  get diagnostics n = row_count;
  perform set_config('gnsi.fee_rollback', 'off', true);
  return n > 0;
end $$;
revoke all on function public.fee_rollback_unsaved(text, text) from public;
grant execute on function public.fee_rollback_unsaved(text, text) to authenticated;

-- ── H5: the database writes the audit trail ─────────────────────────────────
create or replace function public.fee_row_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oj jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  nj jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  o jsonb := '{}'::jsonb;
  n jsonb := '{}'::jsonb;
  k text;
  meta jsonb;
begin
  if tg_op = 'UPDATE' then
    -- only the fields that changed
    for k in select jsonb_object_keys(nj) loop
      if (oj -> k) is distinct from (nj -> k) then
        o := o || jsonb_build_object(k, oj -> k);
        n := n || jsonb_build_object(k, nj -> k);
      end if;
    end loop;
    if n = '{}'::jsonb then return null; end if;
  elsif tg_op = 'INSERT' then
    n := nj;
  else
    o := oj;
  end if;

  meta := jsonb_build_object(
    'table', tg_table_name,
    'source', 'database',
    'auth_uid', auth.uid(),
    'admin', public.qbank_is_admin(),
    'gcc', coalesce(nj, oj) -> 'adm_app_id',
    'receipt_no', coalesce(nj, oj) -> 'receipt_no');

  execute format(
    'insert into public.audit_log (action, changed_by, target_id, old_values, new_values, created_at) values (%L, %L, %L, %L, %L, %L)',
    'fee_row_' || lower(tg_op),
    public.fee_actor_label(),
    coalesce(nj, oj) ->> 'id',
    case when tg_op = 'INSERT' then null else (meta || jsonb_build_object('values', o))::text end,
    case when tg_op = 'DELETE' then meta::text else (meta || jsonb_build_object('values', n))::text end,
    now());
  return null;
end $$;
revoke all on function public.fee_row_audit() from public;

-- ── install on the three fee tables ─────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['adm_flat_fees', 'adm_course_fees', 'adm_fee_collections'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'public.% does not exist - skipped.', t;
      continue;
    end if;
    execute format('alter table public.%I add column if not exists recorded_by_uid uuid', t);
    execute format('alter table public.%I add column if not exists recorded_at timestamptz', t);

    execute format('drop trigger if exists fee_stamp_recorder on public.%I', t);
    execute format('create trigger fee_stamp_recorder before insert or update on public.%I for each row execute function public.fee_stamp_recorder()', t);

    -- named so it runs after fee_controls_guard (which fills in a blank receipt serial)
    execute format('drop trigger if exists fee_row_lock_guard on public.%I', t);
    execute format('create trigger fee_row_lock_guard before update on public.%I for each row execute function public.fee_row_lock_guard()', t);

    execute format('drop trigger if exists fee_row_delete_guard on public.%I', t);
    execute format('create trigger fee_row_delete_guard before delete on public.%I for each row execute function public.fee_row_delete_guard()', t);

    execute format('drop trigger if exists fee_row_audit on public.%I', t);
    execute format('create trigger fee_row_audit after insert or update or delete on public.%I for each row execute function public.fee_row_audit()', t);
  end loop;
end $$;
