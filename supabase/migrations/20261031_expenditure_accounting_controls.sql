-- ============================================================================
-- Expenditure → proper accountancy controls
-- ============================================================================
-- Adds what the Accounts module was missing for sound bookkeeping:
--   1. Sequential voucher numbers      PV/2026-27/0001 (payment) · RV/… (receipt)
--   2. Payment reference (UTR / txn id) + capital / revenue / drawings nature
--   3. Database-level rules for MANUAL expense entries (the screen's checks can
--      be bypassed; these cannot):
--        ACC-001  UPI / Bank / Card / Paytm payments may not sit in the "Cash A/c"
--        ACC-002  digital payments must carry a payment reference
--        ACC-003  deleting (voiding) an entry needs a written reason
--   4. Staff advance register + recoveries
--   5. Vendor bills (payables) so each supplier / contractor has a balance
--   6. accounting_controls — one row of switches the admin can change
--
-- Automatic postings (fees, store, Razorpay: rows that carry source_type /
-- source_ref) are never touched by rules 3.
--
-- REQUIRES 20260925_qbank_rls.sql and 20261018_vendors_payers_write_policies.sql
-- (they create qbank_is_staff / qbank_is_admin / accounts_can_write).
-- Safe to run more than once. Existing rows are NOT changed or blocked; use
-- select public.backfill_voucher_numbers(); once if you want old entries numbered.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.accounts_can_write()') is null
     or to_regprocedure('public.qbank_is_staff()') is null
     or to_regprocedure('public.qbank_is_admin()') is null then
    raise exception 'Run 20260925_qbank_rls.sql and 20261018_vendors_payers_write_policies.sql first.';
  end if;
  if to_regclass('public.accounts') is null then
    raise exception 'public.accounts does not exist.';
  end if;
end $$;

-- ── 1. columns on accounts ──────────────────────────────────────────────────
alter table public.accounts add column if not exists voucher_no     text;
alter table public.accounts add column if not exists txn_ref        text;
alter table public.accounts add column if not exists expense_nature text;  -- Revenue | Capital | Drawings | Advance
alter table public.accounts add column if not exists delete_reason  text;
alter table public.accounts add column if not exists bill_id        bigint; -- payment made against a vendor bill

create index if not exists accounts_voucher_no_idx on public.accounts (voucher_no);
create index if not exists accounts_bill_id_idx    on public.accounts (bill_id) where bill_id is not null;

-- ── 2. controls (one row) ───────────────────────────────────────────────────
create table if not exists public.accounting_controls (
  id                          int primary key default 1 check (id = 1),
  receipt_required_above      numeric default 10000,           -- expenses above this need a bill / receipt photo (NULL = rule off)
  require_txn_ref_for_digital boolean not null default true,
  block_digital_in_cash_acct  boolean not null default true,
  require_delete_reason       boolean not null default true,
  generic_description_check   boolean not null default true,
  enforce_in_database         boolean not null default true,   -- master switch for ACC-001..003
  updated_by                  text,
  updated_at                  timestamptz default now()
);
insert into public.accounting_controls (id) values (1) on conflict (id) do nothing;

alter table public.accounting_controls enable row level security;
drop policy if exists accounting_controls_read  on public.accounting_controls;
drop policy if exists accounting_controls_write on public.accounting_controls;
create policy accounting_controls_read  on public.accounting_controls for select to authenticated using (public.qbank_is_staff());
create policy accounting_controls_write on public.accounting_controls for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());

-- ── 3. voucher numbering ────────────────────────────────────────────────────
create table if not exists public.voucher_counters (
  fy      text    not null,
  kind    text    not null,
  last_no integer not null default 0,
  primary key (fy, kind)
);
alter table public.voucher_counters enable row level security;  -- no policies: only the trigger (definer) touches it

-- Indian financial year label for a date: 2026-04-01 .. 2027-03-31 → '2026-27'
create or replace function public.accounts_fy(d date)
returns text language sql immutable as $$
  select case when extract(month from d) >= 4
    then extract(year from d)::int::text || '-' || lpad(((extract(year from d)::int + 1) % 100)::text, 2, '0')
    else (extract(year from d)::int - 1)::text || '-' || lpad((extract(year from d)::int % 100)::text, 2, '0')
  end
$$;

create or replace function public.next_voucher_no(p_type text, p_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_fy text := public.accounts_fy(coalesce(p_date, current_date));
        v_kind text := case when p_type = 'Income' then 'RV' else 'PV' end;
        v_n integer;
begin
  insert into public.voucher_counters (fy, kind, last_no) values (v_fy, v_kind, 1)
  on conflict (fy, kind) do update set last_no = public.voucher_counters.last_no + 1
  returning last_no into v_n;
  return v_kind || '/' || v_fy || '/' || lpad(v_n::text, 4, '0');
end $$;
revoke all on function public.next_voucher_no(text, date) from public;

-- ── 4. the row trigger: numbering + rules ───────────────────────────────────
create or replace function public.accounts_controls_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare c public.accounting_controls%rowtype;
        manual boolean;
        digital boolean;
        d date;
begin
  -- 3a. voucher number on every new entry, manual or automatic
  if tg_op = 'INSERT' and coalesce(new.voucher_no, '') = '' then
    begin d := new.entry_date::date; exception when others then d := current_date; end;
    new.voucher_no := public.next_voucher_no(new.type, d);
  end if;

  select * into c from public.accounting_controls where id = 1;
  if not found or not c.enforce_in_database then return new; end if;

  -- rules apply to manual entries only (fees / store / Razorpay carry source_type or source_ref)
  manual := coalesce(new.source_type, '') = '' and coalesce(new.source_ref, '') = '';
  if not manual then return new; end if;

  -- 3b. voiding needs a reason
  if tg_op = 'UPDATE' and c.require_delete_reason
     and coalesce(old.is_soft_deleted, false) = false and coalesce(new.is_soft_deleted, false) = true
     and length(btrim(coalesce(new.delete_reason, ''))) < 4 then
    raise exception 'ACC-003: a reason (at least 4 characters) is required to delete an entry.' using errcode = 'check_violation';
  end if;

  -- 3c/3d. only for expenses, and on UPDATE only when the money fields changed
  if new.type <> 'Expense' or coalesce(new.is_soft_deleted, false) then return new; end if;
  if tg_op = 'UPDATE' and new.payment_mode is not distinct from old.payment_mode
     and new.account_type is not distinct from old.account_type
     and new.txn_ref is not distinct from old.txn_ref
     and new.amount is not distinct from old.amount then
    return new;
  end if;

  digital := lower(btrim(coalesce(new.payment_mode, ''))) in
    ('upi', 'bank', 'card', 'paytm', 'gpay', 'phonepe', 'cheque', 'neft', 'imps', 'rtgs', 'online', 'bank transfer');

  if digital and c.block_digital_in_cash_acct and coalesce(new.account_type, 'Cash A/c') = 'Cash A/c' then
    raise exception 'ACC-001: a % payment cannot be booked to the Cash A/c. Choose the bank / UPI account.', new.payment_mode using errcode = 'check_violation';
  end if;
  if digital and c.require_txn_ref_for_digital and length(btrim(coalesce(new.txn_ref, ''))) < 6 then
    raise exception 'ACC-002: enter the payment reference (UTR / transaction id, at least 6 characters) for % payments.', new.payment_mode using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.accounts_controls_trigger() from public;

drop trigger if exists accounts_controls on public.accounts;
create trigger accounts_controls
  before insert or update on public.accounts
  for each row execute function public.accounts_controls_trigger();

-- Optional, run once: give existing entries a number, oldest first. Idempotent.
create or replace function public.backfill_voucher_numbers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; n integer := 0; d date;
begin
  if not public.qbank_is_admin() then raise exception 'admin only'; end if;
  for r in select id, type, entry_date from public.accounts
           where coalesce(voucher_no, '') = '' order by entry_date, id loop
    begin d := r.entry_date::date; exception when others then d := current_date; end;
    update public.accounts set voucher_no = public.next_voucher_no(r.type, d) where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.backfill_voucher_numbers() from public;
grant execute on function public.backfill_voucher_numbers() to authenticated;

-- ── 5. staff advance register ───────────────────────────────────────────────
create table if not exists public.staff_advances (
  id          bigserial primary key,
  staff_name  text    not null,
  advance_date date   not null default current_date,
  amount      numeric not null check (amount > 0),
  purpose     text,
  account_id  text,                         -- id of the expense entry that paid it out (optional; text so any id type works)
  status      text    not null default 'Open' check (status in ('Open', 'Settled', 'Written off')),
  created_by  text,
  created_at  timestamptz not null default now()
);
create table if not exists public.staff_advance_recoveries (
  id           bigserial primary key,
  advance_id   bigint  not null references public.staff_advances(id) on delete cascade,
  recovery_date date   not null default current_date,
  amount       numeric not null check (amount > 0),
  method       text    not null default 'Salary deduction',   -- Salary deduction | Cash returned | Adjusted
  note         text,
  created_by   text,
  created_at   timestamptz not null default now()
);
create index if not exists staff_advances_name_idx on public.staff_advances (lower(staff_name));
create index if not exists staff_advance_recoveries_adv_idx on public.staff_advance_recoveries (advance_id);

create or replace view public.staff_advance_balances with (security_invoker = true) as
select a.id, a.staff_name, a.advance_date, a.amount, a.purpose, a.status, a.account_id,
       coalesce(sum(r.amount), 0)              as recovered,
       a.amount - coalesce(sum(r.amount), 0)   as balance
from public.staff_advances a
left join public.staff_advance_recoveries r on r.advance_id = a.id
group by a.id;

-- ── 6. vendor bills (payables) ──────────────────────────────────────────────
create table if not exists public.vendor_bills (
  id          bigserial primary key,
  vendor_id   bigint  not null,
  bill_no     text,
  bill_date   date    not null default current_date,
  due_date    date,
  amount      numeric not null check (amount > 0),
  description text,
  nature      text    default 'Revenue',     -- Revenue | Capital
  receipt_url text,
  status      text    not null default 'Open' check (status in ('Open', 'Paid', 'Cancelled')),
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists vendor_bills_vendor_idx on public.vendor_bills (vendor_id);

-- bill balance = bill amount − confirmed, not-deleted expense payments linked to it
create or replace view public.vendor_bill_balances with (security_invoker = true) as
select b.*, coalesce(p.paid, 0) as paid, b.amount - coalesce(p.paid, 0) as balance
from public.vendor_bills b
left join (
  select bill_id, sum(amount) as paid from public.accounts
  where bill_id is not null and coalesce(is_soft_deleted, false) = false
    and coalesce(status, 'Confirmed') = 'Confirmed'
  group by bill_id
) p on p.bill_id = b.id;

-- ── 7. row-level security for the new tables ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['staff_advances', 'staff_advance_recoveries', 'vendor_bills'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.qbank_is_staff())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.accounts_can_write())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.accounts_can_write()) with check (public.accounts_can_write())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.qbank_is_admin())', t || '_delete', t);
  end loop;
end $$;
