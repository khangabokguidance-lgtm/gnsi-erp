-- ============================================================================
-- ALL PENDING SQL, in the order to run it (Supabase → SQL editor).
-- Prerequisites already in your database: 20260925_qbank_rls.sql and
-- 20260929_fee_concessions.sql. Every part is safe to run more than once.
-- ============================================================================


-- ################################################################
-- PART: 20261004_student_mismatch_log_access.sql
-- ################################################################

-- ============================================================================
-- student_mismatch_log: let signed-in staff read and write the mismatch log
-- ============================================================================
-- Symptom this fixes (browser console, repeated hundreds of times):
--   mismatchLog: insert failed: new row violates row-level security policy
--   for table "student_mismatch_log"
--
-- The cross-module mismatch scan (Student 360° → Notify Admin, plus the hourly
-- admin auto-scan) writes one row per detected data problem. The table has
-- row-level security switched on but no policy that lets the app's session
-- insert, so every write is refused.
--
-- This grants access to the `authenticated` role only — i.e. staff who are
-- signed in to the secure Supabase session at login. It is deliberately NOT
-- granted to `anon`, because the log holds student names and GCC numbers and
-- the public website uses the anon key.
--
-- If the error continues after running this, the browser has no secure
-- session: look for the "Secure database connection is off" banner and use
-- "Sign in again".
--
-- Only touches the table if it exists. Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regclass('public.student_mismatch_log') is null then
    raise notice 'public.student_mismatch_log does not exist yet - create the table first, then re-run this file.';
    return;
  end if;

  execute 'alter table public.student_mismatch_log enable row level security';
  execute 'drop policy if exists student_mismatch_log_staff_all on public.student_mismatch_log';
  execute 'create policy student_mismatch_log_staff_all on public.student_mismatch_log
             for all to authenticated using (true) with check (true)';
end $$;


-- ################################################################
-- PART: 20261005_fee_structures_admin_write.sql
-- ################################################################

-- ============================================================================
-- fee_structures: let admins save fees from Fee Setup
-- ============================================================================
-- Symptom this fixes (red message in Fee Setup when pressing Save):
--   new row violates row-level security policy for table "fee_structures"
--
-- fee_structures has row-level security switched on, but no policy that lets
-- the app write to it, so Fee Setup can read the fee table but every save is
-- refused. This adds write policies (insert / update / delete) for ADMINS only:
-- public.qbank_is_admin() recognises the signed-in staff member as Admin,
-- Administrator or Co-Admin from portal_users. Fee amounts are money settings,
-- so ordinary staff and the public website cannot change them.
--
-- Reading is NOT touched: it already works (the website and billing read the
-- fee table), and no read policy is added or removed here.
--
-- REQUIRES 20260925_qbank_rls.sql first (it creates qbank_is_admin). If that
-- helper is missing this stops with an error instead of opening the table up.
--
-- If the error continues after running this, the browser has no secure
-- session: look for the "Secure database connection is off" banner in the
-- portal and use "Sign in again".
--
-- Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regclass('public.fee_structures') is null then
    raise notice 'public.fee_structures does not exist - nothing to do.';
    return;
  end if;

  if to_regprocedure('public.qbank_is_admin()') is null then
    raise exception 'public.qbank_is_admin() is missing - run supabase/migrations/20260925_qbank_rls.sql first, then re-run this file.';
  end if;

  execute 'alter table public.fee_structures enable row level security';

  execute 'drop policy if exists fee_structures_admin_insert on public.fee_structures';
  execute 'drop policy if exists fee_structures_admin_update on public.fee_structures';
  execute 'drop policy if exists fee_structures_admin_delete on public.fee_structures';

  execute 'create policy fee_structures_admin_insert on public.fee_structures
             for insert to authenticated with check (public.qbank_is_admin())';
  execute 'create policy fee_structures_admin_update on public.fee_structures
             for update to authenticated using (public.qbank_is_admin()) with check (public.qbank_is_admin())';
  execute 'create policy fee_structures_admin_delete on public.fee_structures
             for delete to authenticated using (public.qbank_is_admin())';
end $$;


-- ################################################################
-- PART: 20261006_fee_integrity_guards.sql
-- ################################################################

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


-- ################################################################
-- PART: 20261007_fee_integrity_guards_2.sql
-- ################################################################

-- ============================================================================
-- Fee integrity guards, part 2
-- ============================================================================
-- Follows 20261006_fee_integrity_guards.sql. Adds:
--   1. Sole-admin exception: with only ONE admin account, that admin may approve
--      their own large concession (otherwise it could never be approved).
--   2. Revert / delete requests (fee_action_requests): only admins may approve,
--      and the approver must differ from the requester (unless self-approval is
--      flagged AND there is only one admin). Enforced in the database, so a
--      tampered browser cannot skip the "second admin" rule.
--   3. Month lock: non-admins cannot post or change fee rows dated in a month
--      that Accounts has closed (month_locks). Admins can still correct.
-- REQUIRES 20260925_qbank_rls.sql and 20261006_fee_integrity_guards.sql.
-- Safe to run more than once. The SQL editor / service role is exempt.
-- ============================================================================

create or replace function public.fee_admin_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.portal_users where role in ('Admin', 'Administrator', 'Co-Admin')
$$;
grant execute on function public.fee_admin_count() to anon, authenticated;

-- 1. concession validation: add the sole-admin exception
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
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and public.fee_admin_count() > 1 then
    raise exception 'A concession above ₹% needs a different admin to approve it', public.fee_self_approve_limit();
  end if;
  return new;
end $$;

-- 2. dual control on revert / delete requests
create or replace function public.fee_action_request_guard()
returns trigger
language plpgsql
as $$
begin
  if not public.fee_is_app_caller() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'A new revert/delete request must start as pending';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved', 'executed', 'done') then
    if not public.qbank_is_admin() then
      raise exception 'Only an admin can approve a revert/delete request';
    end if;
    if coalesce(new.approved_by_id, '') = coalesce(old.requested_by_id, '')
       and not (coalesce(new.self_approved, false) and public.fee_admin_count() <= 1) then
      raise exception 'A different admin must approve this request';
    end if;
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.fee_action_requests') is not null then
    execute 'drop trigger if exists fee_action_request_guard on public.fee_action_requests';
    execute 'create trigger fee_action_request_guard before insert or update on public.fee_action_requests for each row execute function public.fee_action_request_guard()';
  end if;
exception when others then
  raise notice 'fee_action_request_guard not installed: %', sqlerrm;
end $$;

-- 3. closed-month lock for non-admin fee writes
create or replace function public.fee_month_lock_guard()
returns trigger
language plpgsql
as $$
declare
  m text := left(coalesce(new.pay_date::text, ''), 7);
begin
  if not public.fee_is_app_caller() or public.qbank_is_admin() or m = '' then return new; end if;
  if to_regclass('public.month_locks') is not null and exists (
       select 1 from public.month_locks where month = m and is_locked = true) then
    raise exception '% is closed in Accounts - ask an admin to post or correct this fee', m;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['adm_flat_fees', 'adm_course_fees', 'adm_fee_collections'] loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('drop trigger if exists fee_month_lock_guard on public.%I', t);
        execute format('create trigger fee_month_lock_guard before insert or update on public.%I for each row execute function public.fee_month_lock_guard()', t);
      exception when others then
        raise notice 'fee_month_lock_guard not installed on %: %', t, sqlerrm;
      end;
    end if;
  end loop;
end $$;


-- ################################################################
-- PART: 20261008_fee_reminders_installments.sql
-- ################################################################

-- ============================================================================
-- Fee reminders (WhatsApp log + promise-to-pay) and installment plans
-- ============================================================================
-- fee_reminders          one row per reminder sent / promise-to-pay note
-- fee_installment_plans  agreed instalment schedule for a student's dues
--                        (record only — money is still collected in Fee Payment)
-- REQUIRES 20260925_qbank_rls.sql first (uses qbank_is_staff / qbank_is_admin).
-- Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.fee_reminders (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  gcc          text not null,
  student_name text,
  channel      text default 'whatsapp',
  message      text,
  due_amount   numeric,
  sent_by      text,
  promise_date date,
  note         text
);
create index if not exists fee_reminders_gcc_idx on public.fee_reminders (gcc);

create table if not exists public.fee_installment_plans (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  gcc          text not null,
  student_name text,
  total_amount numeric not null check (total_amount > 0),
  reason       text,
  status       text default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_by   text,
  approved_by  text,
  installments jsonb not null  -- [{no, due_date, amount, paid_amount, paid_date, receipt_no}]
);
create index if not exists fee_installment_plans_gcc_idx on public.fee_installment_plans (gcc);

alter table public.fee_reminders         enable row level security;
alter table public.fee_installment_plans enable row level security;

drop policy if exists fee_reminders_read   on public.fee_reminders;
drop policy if exists fee_reminders_insert on public.fee_reminders;
drop policy if exists fee_reminders_update on public.fee_reminders;
drop policy if exists fee_reminders_delete on public.fee_reminders;
create policy fee_reminders_read   on public.fee_reminders for select to authenticated using (public.qbank_is_staff());
create policy fee_reminders_insert on public.fee_reminders for insert to authenticated with check (public.qbank_is_staff());
create policy fee_reminders_update on public.fee_reminders for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
create policy fee_reminders_delete on public.fee_reminders for delete to authenticated using (public.qbank_is_admin());

drop policy if exists fee_installment_plans_read   on public.fee_installment_plans;
drop policy if exists fee_installment_plans_insert on public.fee_installment_plans;
drop policy if exists fee_installment_plans_update on public.fee_installment_plans;
drop policy if exists fee_installment_plans_delete on public.fee_installment_plans;
create policy fee_installment_plans_read   on public.fee_installment_plans for select to authenticated using (public.qbank_is_staff());
create policy fee_installment_plans_insert on public.fee_installment_plans for insert to authenticated with check (public.qbank_is_staff());
create policy fee_installment_plans_update on public.fee_installment_plans for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
create policy fee_installment_plans_delete on public.fee_installment_plans for delete to authenticated using (public.qbank_is_admin());


-- ################################################################
-- PART: 20261009_fee_dayclose_refunds_register.sql
-- ################################################################

-- ============================================================================
-- Fees hub: Day closing, Refunds / transfers, Concession register
-- ============================================================================
--   fee_day_close            one cash-reconciliation row per date (unique)
--   fee_refunds              refund / transfer / write-off requests (record only;
--                            the books entry is made in Accounts)
--   fee_concession_register  standing scholarships / concessions per student
--
-- REQUIRES 20260925_qbank_rls.sql first (uses qbank_is_staff / qbank_is_admin).
-- Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.fee_day_close (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  close_date    date not null unique,
  recorded      jsonb,                 -- totals by pay mode from the fee tables
  counted       jsonb,                 -- counted by mode (cash in hand etc.)
  difference    numeric default 0,     -- counted cash - recorded cash
  note          text,
  closed_by     text,
  status        text default 'closed' check (status in ('closed', 'reopened')),
  reopened_by   text,
  reopen_reason text
);
create index if not exists fee_day_close_date_idx on public.fee_day_close (close_date desc);

create table if not exists public.fee_refunds (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  gcc           text not null,
  student_name  text,
  kind          text not null,
  amount        numeric not null check (amount > 0),
  reason        text not null,
  mode          text,
  reference     text,
  target_gcc    text,
  status        text default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  requested_by  text,
  decided_by    text,
  decided_at    timestamptz,
  decision_note text
);
create index if not exists fee_refunds_gcc_idx    on public.fee_refunds (gcc);
create index if not exists fee_refunds_status_idx on public.fee_refunds (status);

create table if not exists public.fee_concession_register (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  gcc            text not null,
  student_name   text,
  kind           text not null,
  basis          text default 'fixed_per_month' check (basis in ('fixed_per_month', 'percent', 'one_time')),
  value          numeric not null check (value > 0),
  applies_to     text default 'course' check (applies_to in ('course', 'flat', 'both', 'all')),
  valid_from     date not null,
  valid_to       date,
  reason         text not null,
  approved_by    text,
  status         text default 'active' check (status in ('active', 'expired', 'revoked')),
  revoked_reason text
);
create index if not exists fee_concession_register_gcc_idx    on public.fee_concession_register (gcc);
create index if not exists fee_concession_register_status_idx on public.fee_concession_register (status);

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.fee_day_close enable row level security;
drop policy if exists fee_day_close_read   on public.fee_day_close;
drop policy if exists fee_day_close_insert on public.fee_day_close;
drop policy if exists fee_day_close_update on public.fee_day_close;
create policy fee_day_close_read   on public.fee_day_close for select to authenticated using (public.qbank_is_staff());
create policy fee_day_close_insert on public.fee_day_close for insert to authenticated with check (public.qbank_is_staff());
create policy fee_day_close_update on public.fee_day_close for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
-- A closing is final for staff; re-closing a reopened day goes through the
-- admin (the app updates the row), so there is no delete policy for staff.

alter table public.fee_refunds enable row level security;
drop policy if exists fee_refunds_read   on public.fee_refunds;
drop policy if exists fee_refunds_insert on public.fee_refunds;
drop policy if exists fee_refunds_update on public.fee_refunds;
drop policy if exists fee_refunds_delete on public.fee_refunds;
create policy fee_refunds_read   on public.fee_refunds for select to authenticated using (public.qbank_is_staff());
create policy fee_refunds_insert on public.fee_refunds for insert to authenticated
  with check (public.qbank_is_staff() and (status = 'pending' or public.qbank_is_admin()));
create policy fee_refunds_update on public.fee_refunds for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
create policy fee_refunds_delete on public.fee_refunds for delete to authenticated using (public.qbank_is_admin());

alter table public.fee_concession_register enable row level security;
drop policy if exists fee_concession_register_read   on public.fee_concession_register;
drop policy if exists fee_concession_register_insert on public.fee_concession_register;
drop policy if exists fee_concession_register_update on public.fee_concession_register;
drop policy if exists fee_concession_register_delete on public.fee_concession_register;
create policy fee_concession_register_read   on public.fee_concession_register for select to authenticated using (public.qbank_is_staff());
-- Standing concessions reduce what students owe, so only admins may add them.
create policy fee_concession_register_insert on public.fee_concession_register for insert to authenticated with check (public.qbank_is_admin());
create policy fee_concession_register_update on public.fee_concession_register for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
create policy fee_concession_register_delete on public.fee_concession_register for delete to authenticated using (public.qbank_is_admin());


-- ################################################################
-- PART: 20261010_fee_server_identity.sql
-- ################################################################

-- ============================================================================
-- Fee approvals: use the SERVER's idea of who is acting
-- ============================================================================
-- Until now the "different admin must approve" rule compared names / ids that
-- the browser sends, so a tampered browser could claim to be someone else.
-- This stamps the real login (auth.uid()) on every revert/delete request and
-- every concession request when it is created, and on every approval when it
-- is decided, and compares THOSE. The stamped columns cannot be edited later
-- from the app.
--
-- REQUIRES 20261006 + 20261007 (it replaces two of their trigger functions).
-- Safe to run more than once. The SQL editor / service role is exempt.
-- ============================================================================

do $$
begin
  if to_regclass('public.fee_action_requests') is not null then
    execute 'alter table public.fee_action_requests add column if not exists requested_by_uid uuid';
    execute 'alter table public.fee_action_requests add column if not exists approved_by_uid uuid';
  end if;
  if to_regclass('public.fee_concessions') is not null then
    execute 'alter table public.fee_concessions add column if not exists requested_by_uid uuid';
    execute 'alter table public.fee_concessions add column if not exists decided_by_uid uuid';
  end if;
end $$;

create or replace function public.fee_action_request_guard()
returns trigger
language plpgsql
as $$
begin
  if not public.fee_is_app_caller() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'A new revert/delete request must start as pending';
    end if;
    new.requested_by_uid := auth.uid();
    new.approved_by_uid := null;
    return new;
  end if;
  -- stamped identity can never be edited from the app
  new.requested_by_uid := old.requested_by_uid;
  new.approved_by_uid := old.approved_by_uid;
  if new.status is distinct from old.status and new.status in ('approved', 'executed', 'done') then
    if not public.qbank_is_admin() then
      raise exception 'Only an admin can approve a revert/delete request';
    end if;
    new.approved_by_uid := auth.uid();
    if old.requested_by_uid is not null and old.requested_by_uid = auth.uid()
       and not (coalesce(new.self_approved, false) and public.fee_admin_count() <= 1) then
      raise exception 'A different admin must approve this request';
    end if;
    if old.requested_by_uid is null and coalesce(new.approved_by_id, '') = coalesce(old.requested_by_id, '')
       and not (coalesce(new.self_approved, false) and public.fee_admin_count() <= 1) then
      raise exception 'A different admin must approve this request';
    end if;
  end if;
  return new;
end $$;

create or replace function public.fee_concession_validate()
returns trigger
language plpgsql
as $$
declare
  same_person boolean;
begin
  if not public.fee_is_app_caller() then return new; end if;
  if tg_op = 'INSERT' then
    new.requested_by_uid := auth.uid();
    new.decided_by_uid := case when new.status = 'approved' then auth.uid() else null end;
  else
    new.requested_by_uid := old.requested_by_uid;
    new.decided_by_uid := case when new.status is distinct from old.status and new.status in ('approved', 'rejected') then auth.uid() else old.decided_by_uid end;
  end if;
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
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and public.fee_admin_count() > 1 then
    same_person := (new.requested_by_uid is not null and new.requested_by_uid = new.decided_by_uid)
                   or lower(trim(coalesce(new.decided_by, ''))) = lower(trim(coalesce(new.requested_by, new.collected_by, '')));
    if same_person then
      raise exception 'A concession above ₹% needs a different admin to approve it', public.fee_self_approve_limit();
    end if;
  end if;
  return new;
end $$;
