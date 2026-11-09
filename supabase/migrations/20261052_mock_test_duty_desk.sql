-- ============================================================================
-- Mock Test Analyzer: Duty Desk (students removed from a group, manually built groups)
-- ============================================================================
-- mock_test_removed_students : a duty teacher / admin takes a student out of the self-study groups of a series
--                              (per basis: 'overall' or a subject). Delete the row to bring the student back.
-- mock_test_custom_groups    : a group built from a manual choice of students, with a name, an optional subject,
--                              the person on duty and the list of student keys.
-- Without these tables the app keeps the data in the browser only (it falls back automatically).
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.mock_test_removed_students (
  series       text        not null,
  basis        text        not null default 'overall',
  student_key  text        not null,
  reason       text,
  removed_by   text,
  removed_at   timestamptz not null default now(),
  primary key (series, basis, student_key)
);

create table if not exists public.mock_test_custom_groups (
  id            text        primary key,
  series        text        not null,
  name          text        not null,
  basis         text,
  duty_name     text,
  duty_title    text,
  student_keys  jsonb       not null default '[]'::jsonb,
  note          text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists mock_test_custom_groups_series_idx on public.mock_test_custom_groups (series);

alter table public.mock_test_removed_students enable row level security;
alter table public.mock_test_custom_groups    enable row level security;

drop policy if exists mock_test_removed_students_all on public.mock_test_removed_students;
create policy mock_test_removed_students_all on public.mock_test_removed_students
  for all to anon, authenticated using (true) with check (true);

drop policy if exists mock_test_custom_groups_all on public.mock_test_custom_groups;
create policy mock_test_custom_groups_all on public.mock_test_custom_groups
  for all to anon, authenticated using (true) with check (true);
