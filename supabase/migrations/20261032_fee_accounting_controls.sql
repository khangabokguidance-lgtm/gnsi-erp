-- ============================================================================
-- Fees → proper accountancy controls
-- ============================================================================
-- The fee module already has money guards, dual-control reverts, concession
-- approval, day closing and an append-only audit log. This adds what was missing:
--
--   1. A sequential receipt serial       R/2026-27/000123   (one per receipt, gap-free,
--                                                             independent of any computer's clock)
--   2. FEE-001  a day that has been closed in Day Close cannot be changed by non-admins
--               (new payment, revert or edit dated on that day) until an admin reopens it
--   3. FEE-002  UPI / cheque / bank transfer / DD payments must carry a payment reference
--   4. FEE-003  reverting a payment needs a written reason (at least 4 characters)
--   5. fee_controls — one row of switches the admin can change
--
-- Rules apply to people using the app. The SQL editor / service role (Razorpay webhook,
-- online payments) are exempt, exactly like the existing fee guards. Existing rows are never
-- changed or blocked. The three fee tables keep every existing column and trigger.
--
-- REQUIRES 20260925_qbank_rls.sql and 20261006_fee_integrity_guards.sql
-- (qbank_is_staff / qbank_is_admin / fee_is_app_caller). fee_day_close
-- (20261009) is optional: without it rule FEE-001 is simply skipped.
-- Safe to run more than once. Optional, run once to number old receipts:
--   select public.fee_backfill_receipt_serials();
-- ============================================================================

do $$
begin
  if to_regprocedure('public.qbank_is_admin()') is null
     or to_regprocedure('public.qbank_is_staff()') is null
     or to_regprocedure('public.fee_is_app_caller()') is null then
    raise exception 'Run 20260925_qbank_rls.sql and 20261006_fee_integrity_guards.sql first.';
  end if;
end $$;

-- ── controls (one row) ──────────────────────────────────────────────────────
create table if not exists public.fee_controls (
  id                    int primary key default 1 check (id = 1),
  lock_closed_days      boolean not null default true,    -- FEE-001
  require_digital_ref   boolean not null default true,    -- FEE-002
  min_ref_length        int     not null default 4,
  require_revert_reason boolean not null default true,    -- FEE-003
  enforce_in_database   boolean not null default true,    -- master switch
  updated_by            text,
  updated_at            timestamptz default now()
);
insert into public.fee_controls (id) values (1) on conflict (id) do nothing;

alter table public.fee_controls enable row level security;
drop policy if exists fee_controls_read  on public.fee_controls;
drop policy if exists fee_controls_write on public.fee_controls;
create policy fee_controls_read  on public.fee_controls for select to authenticated using (public.qbank_is_staff());
create policy fee_controls_write on public.fee_controls for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());

-- ── receipt serials ─────────────────────────────────────────────────────────
create table if not exists public.fee_serial_counters (
  fy      text primary key,
  last_no integer not null default 0
);
create table if not exists public.fee_receipt_serials (
  receipt_no text primary key,
  serial     text not null unique,
  fy         text not null,
  issued_at  timestamptz not null default now()
);
alter table public.fee_serial_counters enable row level security;   -- no policies: only the definer functions touch them
alter table public.fee_receipt_serials enable row level security;
drop policy if exists fee_receipt_serials_read on public.fee_receipt_serials;
create policy fee_receipt_serials_read on public.fee_receipt_serials for select to authenticated using (public.qbank_is_staff());

create or replace function public.fee_fy(d date)
returns text language sql immutable as $$
  select case when extract(month from d) >= 4
    then extract(year from d)::int::text || '-' || lpad(((extract(year from d)::int + 1) % 100)::text, 2, '0')
    else (extract(year from d)::int - 1)::text || '-' || lpad((extract(year from d)::int % 100)::text, 2, '0')
  end
$$;

-- One serial per receipt number, however many fee rows share it. The counter lives in the same
-- transaction as the insert, so a failed save never burns a number (no gaps).
create or replace function public.fee_serial_for(p_receipt text, p_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare s text; v_fy text; n integer;
begin
  if coalesce(btrim(p_receipt), '') = '' then return null; end if;
  select serial into s from public.fee_receipt_serials where receipt_no = p_receipt;
  if found then return s; end if;
  perform pg_advisory_xact_lock(hashtext('fee_serial:' || p_receipt));
  select serial into s from public.fee_receipt_serials where receipt_no = p_receipt;
  if found then return s; end if;
  v_fy := public.fee_fy(coalesce(p_date, current_date));
  insert into public.fee_serial_counters (fy, last_no) values (v_fy, 1)
    on conflict (fy) do update set last_no = public.fee_serial_counters.last_no + 1
    returning last_no into n;
  s := 'R/' || v_fy || '/' || lpad(n::text, 6, '0');
  insert into public.fee_receipt_serials (receipt_no, serial, fy) values (p_receipt, s, v_fy);
  return s;
end $$;
revoke all on function public.fee_serial_for(text, date) from public;

-- ── the guard: serial + FEE-001 / 002 / 003 ─────────────────────────────────
-- Works on to_jsonb(row) so it does not care which fee table (or which optional column) it is on.
create or replace function public.fee_controls_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nj jsonb := to_jsonb(new);
  oj jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  c public.fee_controls%rowtype;
  money_new boolean; money_old boolean;
  mode_ text;
  d_new date; d_old date;
  digital boolean;
begin
  -- 1. serial on every receipt row that has a receipt number and no serial yet (everyone, including the
  --    service role). Also on UPDATE: unpaid placeholder rows get their receipt number when they are paid.
  if nj ? 'receipt_serial' and coalesce(nj ->> 'receipt_serial', '') = '' and coalesce(nj ->> 'receipt_no', '') <> ''
     and (tg_op = 'INSERT' or coalesce(oj ->> 'receipt_serial', '') = '') then
    begin d_new := (nj ->> 'pay_date')::date; exception when others then d_new := current_date; end;
    new := jsonb_populate_record(new, jsonb_build_object('receipt_serial', public.fee_serial_for(nj ->> 'receipt_no', d_new)));
  end if;

  if not public.fee_is_app_caller() then return new; end if;
  select * into c from public.fee_controls where id = 1;
  if not found or not c.enforce_in_database then return new; end if;

  -- "money is in": not reverted, and (flat fees) paid, or (others) a positive amount
  money_new := not coalesce((nj ->> 'reverted')::boolean, false)
               and case when nj ? 'paid' then coalesce((nj ->> 'paid')::boolean, false)
                        else coalesce((coalesce(nj ->> 'amount_paid', nj ->> 'amount'))::numeric, 0) > 0 end;
  money_old := oj is not null
               and not coalesce((oj ->> 'reverted')::boolean, false)
               and case when oj ? 'paid' then coalesce((oj ->> 'paid')::boolean, false)
                        else coalesce((coalesce(oj ->> 'amount_paid', oj ->> 'amount'))::numeric, 0) > 0 end;

  -- FEE-003: a revert needs a reason (all app callers, admins included)
  if c.require_revert_reason and tg_op = 'UPDATE'
     and not coalesce((oj ->> 'reverted')::boolean, false) and coalesce((nj ->> 'reverted')::boolean, false)
     and length(btrim(coalesce(nj ->> 'revert_reason', ''))) < 4 then
    raise exception 'FEE-003: a reason (at least 4 characters) is required to revert a payment.' using errcode = 'check_violation';
  end if;

  -- FEE-002: a payment that becomes real with a digital mode needs a reference
  if c.require_digital_ref and money_new and (tg_op = 'INSERT' or not money_old) then
    mode_ := lower(btrim(coalesce(nj ->> 'pay_mode', nj ->> 'payment_mode', '')));
    digital := mode_ in ('upi', 'cheque', 'bank transfer', 'dd', 'neft', 'imps', 'rtgs', 'online', 'card');
    if digital and length(btrim(coalesce(nj ->> 'txn_ref', ''))) < c.min_ref_length then
      raise exception 'FEE-002: enter the payment reference (UPI / cheque / transaction no.) for % payments.', coalesce(nj ->> 'pay_mode', nj ->> 'payment_mode') using errcode = 'check_violation';
    end if;
  end if;

  -- FEE-001: no changes to money on a day that is closed (admins reopen the day first)
  if c.lock_closed_days and not public.qbank_is_admin() and to_regclass('public.fee_day_close') is not null then
    begin d_new := (nj ->> 'pay_date')::date; exception when others then d_new := null; end;
    if oj is not null then begin d_old := (oj ->> 'pay_date')::date; exception when others then d_old := null; end; end if;
    if (money_new or money_old)
       and (tg_op = 'INSERT'
            or money_new is distinct from money_old
            or d_new is distinct from d_old
            or (nj ->> 'pay_mode') is distinct from (oj ->> 'pay_mode')
            or coalesce(nj ->> 'amount_paid', nj ->> 'amount') is distinct from coalesce(oj ->> 'amount_paid', oj ->> 'amount'))
       and exists (select 1 from public.fee_day_close dc
                   where dc.status = 'closed' and dc.close_date in (d_new, d_old)) then
      raise exception 'FEE-001: this day is already closed. Ask an admin to reopen it in Fees → Day Close before recording or changing a payment dated %.', coalesce(d_new, d_old) using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.fee_controls_guard() from public;

-- ── install on the three fee tables ─────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['adm_fee_collections', 'adm_flat_fees', 'adm_course_fees'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'public.% does not exist - skipped.', t;
      continue;
    end if;
    execute format('alter table public.%I add column if not exists receipt_serial text', t);
    execute format('create index if not exists %I on public.%I (receipt_serial)', t || '_receipt_serial_idx', t);
    execute format('drop trigger if exists fee_controls_guard on public.%I', t);
    execute format('create trigger fee_controls_guard before insert or update on public.%I for each row execute function public.fee_controls_guard()', t);
  end loop;
end $$;

-- ── optional one-off: number the receipts that already exist, oldest first ───
create or replace function public.fee_backfill_receipt_serials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; t text; n integer := 0; q text;
begin
  if not public.qbank_is_admin() then raise exception 'admin only'; end if;
  for r in
    select receipt_no, min(pay_date) as d from (
      select receipt_no, pay_date from public.adm_fee_collections where coalesce(receipt_no, '') <> ''
      union all select receipt_no, pay_date from public.adm_flat_fees where coalesce(receipt_no, '') <> ''
      union all select receipt_no, pay_date from public.adm_course_fees where coalesce(receipt_no, '') <> ''
    ) x group by receipt_no order by min(pay_date), receipt_no
  loop
    perform public.fee_serial_for(r.receipt_no, r.d);
    n := n + 1;
  end loop;
  foreach t in array array['adm_fee_collections', 'adm_flat_fees', 'adm_course_fees'] loop
    if to_regclass('public.' || t) is not null then
      execute format('update public.%I x set receipt_serial = s.serial from public.fee_receipt_serials s where s.receipt_no = x.receipt_no and coalesce(x.receipt_serial, '''') = ''''', t);
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.fee_backfill_receipt_serials() from public;
grant execute on function public.fee_backfill_receipt_serials() to authenticated;
