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
