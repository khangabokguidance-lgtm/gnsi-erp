-- ============================================================================
-- Mock Test Analyzer: study schedule (a time slot for each subject, a room for each group)
-- ============================================================================
-- kind 'subject' : key = the subject name, time_from / time_to ('HH:MM', 24-hour), days ('Mon,Wed' or empty)
-- kind 'room'    : key = the group number '1'..'7', room = the room name (e.g. 'Room 1')
-- Anything not saved here uses the built-in defaults (Passage 6:00-7:00 am, Mathematics 3:15-4:45 pm,
-- EVS 5:30-7:00 pm; Group 1..7 -> Room 1..7). Without this table the schedule is kept in the browser only (the app
-- falls back automatically). Safe to run more than once.
-- ============================================================================

create table if not exists public.mock_test_study_schedule (
  series      text        not null,
  kind        text        not null check (kind in ('subject', 'room')),
  key         text        not null,
  time_from   text,
  time_to     text,
  days        text,
  room        text,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (series, kind, key)
);

alter table public.mock_test_study_schedule enable row level security;

drop policy if exists mock_test_study_schedule_all on public.mock_test_study_schedule;
create policy mock_test_study_schedule_all on public.mock_test_study_schedule
  for all to anon, authenticated using (true) with check (true);
