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
