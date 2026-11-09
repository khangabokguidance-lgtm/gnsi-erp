-- ============================================================================
-- 20261111_student_course_history.sql — course / batch changes with an effective month
--
-- A student can move to another course or batch during a session. Each change is
-- kept here with the month it takes effect, so fees for earlier months stay at the
-- old course's rates (past payments and dues are unchanged) and only months from
-- the effective month use the new course. students.course / students.batch always
-- hold the CURRENT course.
--
-- Same shape and rules as student_hostel_history (20260930_hostel_type_history.sql).
-- Needs 20260925_qbank_rls.sql (qbank_is_staff / qbank_is_admin).
-- Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.student_course_history (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  student_id      text,
  gcc_no          text not null,
  student_name    text,
  from_course     text not null,
  to_course       text not null,
  from_batch      text,
  to_batch        text,
  effective_from  date not null,                 -- first day of the month the new course applies
  reason          text,
  changed_by      text,
  changer_email   text default lower(coalesce(auth.jwt() ->> 'email', ''))
);
create index if not exists student_course_history_gcc_idx on public.student_course_history (gcc_no, effective_from);

alter table public.student_course_history enable row level security;
drop policy if exists student_course_history_read   on public.student_course_history;
drop policy if exists student_course_history_insert on public.student_course_history;
drop policy if exists student_course_history_delete on public.student_course_history;
create policy student_course_history_read   on public.student_course_history for select to authenticated using (public.qbank_is_staff());
create policy student_course_history_insert on public.student_course_history for insert to authenticated with check (public.qbank_is_admin());
create policy student_course_history_delete on public.student_course_history for delete to authenticated using (public.qbank_is_admin());

-- Parents' fee lookup (no staff session) needs the timeline too, for the right dues.
-- Only course + batch + month are exposed, for one GCC at a time.
create or replace function public.public_course_history(p_gcc text)
returns table (from_course text, to_course text, from_batch text, to_batch text, effective_from date)
language sql
security definer
set search_path = public
as $$
  select h.from_course, h.to_course, h.from_batch, h.to_batch, h.effective_from
  from public.student_course_history h
  where h.gcc_no = p_gcc
  order by h.effective_from, h.created_at
$$;
grant execute on function public.public_course_history(text) to anon, authenticated;
