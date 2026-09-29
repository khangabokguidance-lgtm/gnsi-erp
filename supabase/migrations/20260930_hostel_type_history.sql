-- ============================================================================
-- 20260930_hostel_type_history.sql — hostel type changes with an effective month
--
-- A student can move between Boarder / Day Boarder / Day Scholar during a
-- session. Each change is kept here with the month it takes effect, so fees
-- for earlier months stay at the old type's rate (past payments and dues are
-- unchanged) and only months from the effective month use the new rate.
-- students.hostel_type always holds the CURRENT type.
--
-- Needs 20260925_qbank_rls.sql (qbank_is_staff / qbank_is_admin).
-- Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.student_hostel_history (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  student_id      text,
  gcc_no          text not null,
  student_name    text,
  from_type       text not null check (from_type in ('Boarder', 'Day Boarder', 'Day Scholar')),
  to_type         text not null check (to_type   in ('Boarder', 'Day Boarder', 'Day Scholar')),
  effective_from  date not null,                 -- first day of the month the new type applies
  reason          text,
  changed_by      text,
  changer_email   text default lower(coalesce(auth.jwt() ->> 'email', ''))
);
create index if not exists student_hostel_history_gcc_idx on public.student_hostel_history (gcc_no, effective_from);

-- Staff read (fee screens need it); only admins change a student's hostel type.
alter table public.student_hostel_history enable row level security;
drop policy if exists student_hostel_history_read   on public.student_hostel_history;
drop policy if exists student_hostel_history_insert on public.student_hostel_history;
drop policy if exists student_hostel_history_delete on public.student_hostel_history;
create policy student_hostel_history_read   on public.student_hostel_history for select to authenticated using (public.qbank_is_staff());
create policy student_hostel_history_insert on public.student_hostel_history for insert to authenticated with check (public.qbank_is_admin());
create policy student_hostel_history_delete on public.student_hostel_history for delete to authenticated using (public.qbank_is_admin());

-- Parents' fee lookup (no staff session) needs the timeline too, for the right
-- dues. Only type + month are exposed, for one GCC at a time.
create or replace function public.public_hostel_history(p_gcc text)
returns table (from_type text, to_type text, effective_from date)
language sql
security definer
set search_path = public
as $$
  select h.from_type, h.to_type, h.effective_from
  from public.student_hostel_history h
  where h.gcc_no = p_gcc
  order by h.effective_from, h.created_at
$$;
grant execute on function public.public_hostel_history(text) to anon, authenticated;
