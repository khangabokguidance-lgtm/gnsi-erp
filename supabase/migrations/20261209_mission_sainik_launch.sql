-- Mission Sainik 2027 — launch hardening: admin settings, append-only audit log, soft delete + verification for questions.
-- Run AFTER 20261201-20261208. Requires public.qbank_is_staff() / qbank_is_admin() (20260925_qbank_rls.sql). Safe to re-run.

-- 1. Admin-editable settings (deadline, order no/date, exam date, embargo switch)
create table if not exists public.mission_sainik_settings (
  key text primary key, value text, updated_by text, updated_at timestamptz not null default now()
);

-- 2. Append-only audit log: staff can add and read entries; nobody can edit or delete them
create table if not exists public.mission_sainik_audit (
  id bigserial primary key, at timestamptz not null default now(),
  actor text, action text not null, ref text, detail jsonb
);
create index if not exists mission_sainik_audit_at_idx on public.mission_sainik_audit (at desc);

-- 3. Questions: soft delete (recycle bin) + per-section verification
alter table public.mission_sainik_questions add column if not exists deleted_at timestamptz;
alter table public.mission_sainik_questions add column if not exists deleted_by text;
create table if not exists public.mission_sainik_signoffs (
  id bigserial primary key, series text not null, test_no integer not null, section text not null,
  verified_by text not null, verified_at timestamptz not null default now(),
  constraint mission_sainik_signoffs_uq unique (series, test_no, section)
);

alter table public.mission_sainik_settings enable row level security;
alter table public.mission_sainik_audit    enable row level security;
alter table public.mission_sainik_signoffs enable row level security;

drop policy if exists mission_sainik_settings_staff on public.mission_sainik_settings;
create policy mission_sainik_settings_staff on public.mission_sainik_settings for select to authenticated using (public.qbank_is_staff());
drop policy if exists mission_sainik_settings_admin on public.mission_sainik_settings;
create policy mission_sainik_settings_admin on public.mission_sainik_settings for all to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());

drop policy if exists mission_sainik_audit_read on public.mission_sainik_audit;
create policy mission_sainik_audit_read on public.mission_sainik_audit for select to authenticated using (public.qbank_is_staff());
drop policy if exists mission_sainik_audit_add on public.mission_sainik_audit;
create policy mission_sainik_audit_add on public.mission_sainik_audit for insert to authenticated with check (public.qbank_is_staff());

drop policy if exists mission_sainik_signoffs_staff on public.mission_sainik_signoffs;
create policy mission_sainik_signoffs_staff on public.mission_sainik_signoffs for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
