-- ============================================================================
-- Mission Sainik 2027 — question-setting tasks for the 20 Pre Mock Tests
-- ============================================================================
-- One row per section of each test (kind='test', test_no 1-20, subject, setter) and one row per
-- practice-bank set (kind='practice', test_no 0). The schedule, panel and allotment rules live in
-- src/missionSainikData.js; this table only stores progress:
--   status        Pending → Submitted (setter) → Verified (verifier) → Approved (admin)
--   *_on          the date each step happened
--   question_count  questions in that section / set (25 per test section)
-- The module's "Create allotment" button inserts the 133 starting rows (ignores rows that exist).
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.mission_sainik_tasks (
  id              bigserial primary key,
  kind            text    not null check (kind in ('test', 'practice')),
  test_no         integer not null default 0,
  subject         text    not null,
  setter          text    not null,
  verifier        text,
  question_count  integer,
  status          text    not null default 'Pending'
                    check (status in ('Pending', 'Submitted', 'Verified', 'Approved')),
  submitted_on    date,
  verified_on     date,
  approved_on     date,
  remarks         text,
  updated_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint mission_sainik_tasks_uq unique (kind, test_no, subject, setter)
);

create index if not exists mission_sainik_tasks_setter_idx on public.mission_sainik_tasks (setter);
create index if not exists mission_sainik_tasks_status_idx on public.mission_sainik_tasks (status);

alter table public.mission_sainik_tasks enable row level security;

drop policy if exists mission_sainik_tasks_all on public.mission_sainik_tasks;
create policy mission_sainik_tasks_all on public.mission_sainik_tasks
  for all to anon, authenticated using (true) with check (true);
