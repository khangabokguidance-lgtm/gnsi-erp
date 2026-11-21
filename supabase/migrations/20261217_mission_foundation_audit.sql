-- Mission Foundation — audit log and test locks.
-- Run AFTER 20261216_mission_foundation.sql. Requires public.qbank_is_staff() / qbank_is_admin() (20260925_qbank_rls.sql). Safe to re-run.

-- 1. Append-only audit log: staff can add and read entries; nobody can edit or delete them.
create table if not exists public.mission_foundation_audit (
  id bigserial primary key, at timestamptz not null default now(),
  actor text, action text not null, ref text, detail jsonb
);
create index if not exists mission_foundation_audit_at_idx on public.mission_foundation_audit (at desc);
alter table public.mission_foundation_audit enable row level security;
drop policy if exists mission_foundation_audit_read on public.mission_foundation_audit;
create policy mission_foundation_audit_read on public.mission_foundation_audit for select to authenticated using (public.qbank_is_staff());
drop policy if exists mission_foundation_audit_add on public.mission_foundation_audit;
create policy mission_foundation_audit_add on public.mission_foundation_audit for insert to authenticated with check (public.qbank_is_staff());

-- 2. Lock a test: once locked, only an admin can change its papers, marks or questions.
alter table public.mission_foundation_tests add column if not exists locked boolean not null default false;
alter table public.mission_foundation_tests add column if not exists locked_by text;
alter table public.mission_foundation_tests add column if not exists locked_at timestamptz;

create or replace function public.mission_foundation_guard() returns trigger language plpgsql as $$
declare tid uuid; is_locked boolean;
begin
  tid := coalesce(case when tg_op = 'DELETE' then old.test_id else new.test_id end, null);
  select locked into is_locked from public.mission_foundation_tests where id = tid;
  if coalesce(is_locked, false) and not public.qbank_is_admin() then
    raise exception 'This test is locked. Ask an admin to unlock it.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['mission_foundation_papers', 'mission_foundation_marks', 'mission_foundation_questions']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard', t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.mission_foundation_guard()', t || '_guard', t);
  end loop;
end $$;

-- Only an admin may lock or unlock a test (staff can still edit the test's other fields while it is unlocked).
create or replace function public.mission_foundation_lock_guard() returns trigger language plpgsql as $$
begin
  if (new.locked is distinct from old.locked) and not public.qbank_is_admin() then
    raise exception 'Only an admin can lock or unlock a test.';
  end if;
  if old.locked and new.locked and not public.qbank_is_admin() then
    raise exception 'This test is locked. Ask an admin to unlock it.';
  end if;
  return new;
end $$;
drop trigger if exists mission_foundation_tests_lock_guard on public.mission_foundation_tests;
create trigger mission_foundation_tests_lock_guard before update on public.mission_foundation_tests
  for each row execute function public.mission_foundation_lock_guard();
