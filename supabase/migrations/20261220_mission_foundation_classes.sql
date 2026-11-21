-- Mission Foundation — admin-defined classes, a second setter per paper, and a separate paper per class.
-- Run AFTER 20261216_mission_foundation.sql (and 20261217 if you use locks). Safe to re-run.

-- 1. Classes (batches) that sit the Foundation tests. Until a row exists the built-in Udaan and Pragati are used.
--    The name must match the batch name used in Students, so the live roster picks the students up.
create table if not exists public.mission_foundation_classes (
  name        text primary key,
  sort_no     integer not null default 0,
  created_by  text,
  created_at  timestamptz not null default now()
);
alter table public.mission_foundation_classes enable row level security;
drop policy if exists mission_foundation_classes_staff on public.mission_foundation_classes;
create policy mission_foundation_classes_staff on public.mission_foundation_classes for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());

-- 2. A second setter on a paper.
alter table public.mission_foundation_papers add column if not exists setter2 text;

-- 3. A paper can be made for one class only. class_name '' = the shared paper every class sits.
alter table public.mission_foundation_papers add column if not exists class_name text not null default '';
alter table public.mission_foundation_papers drop constraint if exists mission_foundation_papers_test_id_subject_key;
create unique index if not exists mission_foundation_papers_test_subject_class_uq
  on public.mission_foundation_papers (test_id, subject, class_name);
