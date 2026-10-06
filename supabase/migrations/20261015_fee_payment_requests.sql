-- Low-fee payments now WAIT for an admin before any money is recorded.
-- A non-admin collector files a request (the full payment details); an admin
-- approves or rejects it; only after approval does the collector "Collect" it,
-- which records the payment and prints the receipt.
create table if not exists public.fee_payment_requests (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  gcc                text not null,
  student_name       text,
  requested_by       text,                 -- collector's display name / login
  payload            jsonb not null,       -- everything collectFee() needs (no receipt no. yet)
  summary            jsonb,                -- months, standard, collected, shortfall, reasons
  shortfall          numeric default 0,
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'collected')),
  decided_by         text,
  decided_at         timestamptz,
  decision_note      text,
  collected_receipt_no text,
  collected_at       timestamptz
);
create index if not exists fee_payment_requests_status_idx on public.fee_payment_requests (status, created_at desc);
create index if not exists fee_payment_requests_gcc_idx    on public.fee_payment_requests (gcc);

alter table public.fee_payment_requests enable row level security;
drop policy if exists fee_payment_requests_read   on public.fee_payment_requests;
drop policy if exists fee_payment_requests_insert on public.fee_payment_requests;
drop policy if exists fee_payment_requests_update on public.fee_payment_requests;
drop policy if exists fee_payment_requests_delete on public.fee_payment_requests;
create policy fee_payment_requests_read   on public.fee_payment_requests for select to authenticated using (public.qbank_is_staff());
-- Staff may only file PENDING requests.
create policy fee_payment_requests_insert on public.fee_payment_requests for insert to authenticated
  with check (public.qbank_is_staff() and status = 'pending');
-- Admins decide; staff may only flip an APPROVED request to 'collected'.
create policy fee_payment_requests_update on public.fee_payment_requests for update to authenticated
  using (public.qbank_is_admin() or (public.qbank_is_staff() and status = 'approved'))
  with check (public.qbank_is_admin() or status = 'collected');
create policy fee_payment_requests_delete on public.fee_payment_requests for delete to authenticated
  using (public.qbank_is_admin() or (public.qbank_is_staff() and status = 'pending'));

notify pgrst, 'reload schema';
