-- ============================================================================
-- Fee integrity guards (server-side enforcement)
-- ============================================================================
-- The fee screens decide "who is an admin" and "is this amount sane" in the
-- browser, which anyone can bypass from the console. This file adds the same
-- rules inside the database, where they cannot be skipped:
--
--  1. Fee rows must have a sane amount (> 0 and below a ceiling).
--  2. Money already recorded on a fee row can only be changed or reverted by a
--     real admin (qbank_is_admin() reads the role from the staff table, NOT
--     from anything the browser sends).
--  3. A fee row cannot be INSERTED already carrying an approved concession
--     unless the writer is an admin.
--  4. fee_concessions: the shortfall must equal standard - collected; "Other"
--     needs a written explanation; and a request above the self-approval
--     limit cannot be approved by the person who raised it.
--  5. audit_log entries cannot be edited or deleted from the app.
--  6. A Razorpay payment id can be used on one flat / course fee row only.
--
-- REQUIRES 20260925_qbank_rls.sql and 20260929_fee_concessions.sql first.
-- The SQL editor / service role is exempt (it has no app login), so you can
-- still fix data by hand. Existing rows are not re-checked (NOT VALID).
-- Safe to run more than once.
-- ============================================================================

-- Self-approval limit (₹). Keep in step with CONCESSION_SELF_APPROVE_LIMIT in
-- src/feeConcessions.js.
create or replace function public.fee_self_approve_limit() returns numeric
language sql immutable as $$ select 2000::numeric $$;

-- Is the caller a logged-in app user (as opposed to the SQL editor / service role)?
create or replace function public.fee_is_app_caller() returns boolean
language sql stable as $$ select coalesce(auth.role(), 'service_role') in ('authenticated', 'anon') $$;

-- ── 1. Sane amounts ─────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.adm_flat_fees') is not null then
    execute 'alter table public.adm_flat_fees drop constraint if exists adm_flat_fees_amount_sane';
    execute 'alter table public.adm_flat_fees add constraint adm_flat_fees_amount_sane check (amount > 0 and amount <= 500000) not valid';
  end if;
  if to_regclass('public.adm_course_fees') is not null then
    execute 'alter table public.adm_course_fees drop constraint if exists adm_course_fees_amount_sane';
    execute 'alter table public.adm_course_fees add constraint adm_course_fees_amount_sane check (amount_paid > 0 and amount_paid <= 500000) not valid';
  end if;
  if to_regclass('public.adm_fee_collections') is not null then
    execute 'alter table public.adm_fee_collections drop constraint if exists adm_fee_collections_amount_sane';
    execute 'alter table public.adm_fee_collections add constraint adm_fee_collections_amount_sane check (amount_paid > 0 and amount_paid <= 500000) not valid';
  end if;
exception when others then
  raise notice 'amount checks not added: %', sqlerrm;
end $$;

-- ── 2 + 3. Only admins may change recorded money / approve a waiver ─────────
create or replace function public.fee_money_guard()
returns trigger
language plpgsql
as $$
declare
  k text;
  old_j jsonb;
  new_j jsonb;
  money_in boolean;
begin
  if not public.fee_is_app_caller() or public.qbank_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.concession_status, '') in ('approved', 'rejected') or coalesce(new.concession_amount, 0) > 0 then
      raise exception 'Only an admin can record an approved fee concession';
    end if;
    return new;
  end if;

  -- UPDATE by a non-admin
  old_j := to_jsonb(old);
  new_j := to_jsonb(new);
  -- A reverted row, or an unpaid placeholder, carries no money yet: re-collecting is allowed.
  money_in := not coalesce((old_j ->> 'reverted')::boolean, false)
              and coalesce((old_j ->> 'paid')::boolean, true);
  if money_in then
    if coalesce((new_j ->> 'reverted')::boolean, false) then
      raise exception 'Only an admin can revert a fee payment';
    end if;
    foreach k in array array['amount', 'amount_paid', 'pay_date', 'month', 'for_month', 'year', 'adm_app_id'] loop
      if (old_j -> k) is distinct from (new_j -> k) then
        raise exception 'Only an admin can change a recorded fee payment (%)', k;
      end if;
    end loop;
  end if;

  if (new_j ->> 'concession_status') is distinct from (old_j ->> 'concession_status')
     or (new_j ->> 'concession_amount') is distinct from (old_j ->> 'concession_amount') then
    if coalesce(new.concession_status, '') in ('approved', 'rejected') or coalesce(new.concession_amount, 0) > 0 then
      raise exception 'Only an admin can approve or reject a fee concession';
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  if to_regprocedure('public.qbank_is_admin()') is null then
    raise notice 'qbank_is_admin() missing - run 20260925_qbank_rls.sql first; fee_money_guard not installed.';
    return;
  end if;
  foreach t in array array['adm_flat_fees', 'adm_course_fees'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists fee_money_guard on public.%I', t);
      execute format('create trigger fee_money_guard before insert or update on public.%I for each row execute function public.fee_money_guard()', t);
    end if;
  end loop;
end $$;

-- Admission / item rows (adm_fee_collections) carry no concession columns: guard only the money.
create or replace function public.fee_adm_money_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' or not public.fee_is_app_caller() or public.qbank_is_admin() then
    return new;
  end if;
  if not coalesce(old.reverted, false) and (
       coalesce(new.reverted, false)
       or new.amount_paid is distinct from old.amount_paid
       or new.pay_date is distinct from old.pay_date
       or new.adm_app_id is distinct from old.adm_app_id) then
    raise exception 'Only an admin can change or revert a recorded admission/item payment';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.adm_fee_collections') is not null and to_regprocedure('public.qbank_is_admin()') is not null then
    execute 'drop trigger if exists fee_adm_money_guard on public.adm_fee_collections';
    execute 'create trigger fee_adm_money_guard before update on public.adm_fee_collections for each row execute function public.fee_adm_money_guard()';
  end if;
exception when others then
  raise notice 'fee_adm_money_guard not installed: %', sqlerrm;
end $$;

-- ── 4. Concession requests: honest numbers, explained, not self-approved ────
create or replace function public.fee_concession_validate()
returns trigger
language plpgsql
as $$
begin
  if not public.fee_is_app_caller() then return new; end if;
  if new.collected_amount < 0 or new.standard_amount <= 0 or new.collected_amount >= new.standard_amount then
    raise exception 'Concession shortfall must be a positive part of the standard fee';
  end if;
  if abs(new.shortfall - (new.standard_amount - new.collected_amount)) > 0.01 then
    raise exception 'Concession shortfall does not match standard minus collected';
  end if;
  if new.reason = 'Other' and length(trim(coalesce(new.reason_note, ''))) < 3 then
    raise exception 'A concession with reason "Other" needs a written explanation';
  end if;
  if new.status = 'approved'
     and new.shortfall > public.fee_self_approve_limit()
     and lower(trim(coalesce(new.decided_by, ''))) = lower(trim(coalesce(new.requested_by, new.collected_by, '')))
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    raise exception 'A concession above ₹% needs a different admin to approve it', public.fee_self_approve_limit();
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.fee_concessions') is not null then
    execute 'drop trigger if exists fee_concession_validate on public.fee_concessions';
    execute 'create trigger fee_concession_validate before insert or update on public.fee_concessions for each row execute function public.fee_concession_validate()';
  end if;
end $$;

-- ── 5. audit_log is append-only for app users ───────────────────────────────
create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  if public.fee_is_app_caller() then
    raise exception 'audit_log entries cannot be changed or deleted';
  end if;
  return coalesce(old, new);
end $$;

do $$
begin
  if to_regclass('public.audit_log') is not null then
    execute 'drop trigger if exists audit_log_append_only on public.audit_log';
    execute 'create trigger audit_log_append_only before update or delete on public.audit_log for each row execute function public.audit_log_append_only()';
  end if;
end $$;

-- ── 6. One Razorpay payment, one fee row ────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['adm_flat_fees', 'adm_course_fees'] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'razorpay_payment_id') then
      begin
        execute format('create unique index if not exists %I on public.%I (razorpay_payment_id) where razorpay_payment_id is not null', t || '_razorpay_pid_uidx', t);
      exception when others then
        raise notice 'razorpay unique index on % not added (duplicates exist?): %', t, sqlerrm;
      end;
    end if;
  end loop;
end $$;
