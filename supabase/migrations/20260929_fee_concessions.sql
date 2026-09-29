-- ============================================================================
-- Low-fee (concession) approvals
-- ============================================================================
-- When a flat or course fee is collected BELOW its standard (Fee Setup) rate,
-- the collector must give a reason, and the shortfall needs admin approval:
--   • approved  → the shortfall is waived (the month counts as settled)
--   • rejected  → the shortfall stays due and must be collected
--   • pending   → waiting for an admin; the shortfall shows as due meanwhile
-- A payment collected by an admin (or authorised by an admin in the Collect
-- Fee popup) is recorded as approved straight away.
--
-- fee_concessions holds one row per below-standard fee line, and the fee row
-- itself carries concession_amount / concession_status so every ledger view
-- (Student Fee Ledger, Monthly Fee Ledger, Month-wise Dues, receipts) reads
-- the decision without an extra query.
--
-- REQUIRES 20260925_qbank_rls.sql first (uses qbank_is_staff / qbank_is_admin).
-- Until this runs, fees still collect normally; reasons are kept in the
-- audit log and the Low-fee Approvals tab shows a setup notice.
-- Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.fee_concessions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  gcc              text not null,
  student_name     text,
  fee_table        text not null check (fee_table in ('adm_flat_fees', 'adm_course_fees')),
  fee_row_id       text not null,                 -- id of the fee row (stored as text)
  fee_kind         text,                          -- flat | course
  month            text,
  year             integer,
  course           text,
  standard_amount  numeric not null,
  collected_amount numeric not null,
  shortfall        numeric not null check (shortfall > 0),
  reason           text not null,                 -- category, e.g. Sibling concession
  reason_note      text,                          -- free-text explanation
  receipt_no       text,
  pay_date         date,
  collected_by     text,
  requested_by     text,
  requester_email  text default lower(coalesce(auth.jwt() ->> 'email', '')),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by       text,
  decided_at       timestamptz,
  decision_note    text
);
create index if not exists fee_concessions_status_idx  on public.fee_concessions (status);
create index if not exists fee_concessions_gcc_idx     on public.fee_concessions (gcc);
create unique index if not exists fee_concessions_row_uq on public.fee_concessions (fee_table, fee_row_id);

alter table public.adm_flat_fees   add column if not exists concession_amount numeric default 0;
alter table public.adm_flat_fees   add column if not exists concession_status text;
alter table public.adm_course_fees add column if not exists concession_amount numeric default 0;
alter table public.adm_course_fees add column if not exists concession_status text;

-- ── Row-level security ──────────────────────────────────────────────────────
-- Staff can read and file requests; only admins decide them.
alter table public.fee_concessions enable row level security;
drop policy if exists fee_concessions_read   on public.fee_concessions;
drop policy if exists fee_concessions_insert on public.fee_concessions;
drop policy if exists fee_concessions_update on public.fee_concessions;
drop policy if exists fee_concessions_delete on public.fee_concessions;
create policy fee_concessions_read   on public.fee_concessions for select to authenticated using (public.qbank_is_staff());
create policy fee_concessions_insert on public.fee_concessions for insert to authenticated
  with check (public.qbank_is_staff() and (status = 'pending' or public.qbank_is_admin()));
create policy fee_concessions_update on public.fee_concessions for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
-- Admins delete; staff may withdraw a still-pending request (replaced on re-collection).
create policy fee_concessions_delete on public.fee_concessions for delete to authenticated using (public.qbank_is_admin() or (status = 'pending' and public.qbank_is_staff()));

-- Only admins may approve/waive: block non-admins from setting a fee row's
-- concession to approved (they may record 'pending' when collecting).
create or replace function public.fee_concession_row_guard()
returns trigger
language plpgsql
as $$
begin
  -- Anyone may record 'pending' or clear it (a new full-rate payment); only an
  -- admin may set approved/rejected or a waived amount.
  if (new.concession_status is distinct from old.concession_status or new.concession_amount is distinct from old.concession_amount)
     and (coalesce(new.concession_status, '') in ('approved', 'rejected') or coalesce(new.concession_amount, 0) > 0)
     and not public.qbank_is_admin() then
    raise exception 'Only an admin can approve or reject a fee concession';
  end if;
  return new;
end $$;

drop trigger if exists fee_concession_guard on public.adm_flat_fees;
create trigger fee_concession_guard before update on public.adm_flat_fees
  for each row execute function public.fee_concession_row_guard();
drop trigger if exists fee_concession_guard on public.adm_course_fees;
create trigger fee_concession_guard before update on public.adm_course_fees
  for each row execute function public.fee_concession_row_guard();
