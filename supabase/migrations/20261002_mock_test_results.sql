-- ============================================================================
-- Mock Test Analyzer: permanent record of mock-test result sheets
-- ============================================================================
-- Exams → "Mock Analyzer" uploads Excel result sheets (one per batch per test)
-- and keeps them here so every future report can compare against past tests.
--
-- One row = one student in one test.  Subjects are stored as JSON so a series
-- can use any subjects / maximum marks (e.g. Mental Ability, EVS, Mathematics,
-- Passage – each out of 25).  Re-uploading a sheet replaces that
-- (series, test_no, batch) in the app (delete + insert), so no unique index is
-- needed.  Safe to run more than once.
--
-- Access follows the other exam tables (exam_marks etc.): the portal's own
-- login gates the screen; tighten these policies if you move exam data to
-- staff-only access.
-- ============================================================================

create table if not exists public.mock_test_results (
  id            uuid primary key default gen_random_uuid(),
  series        text    not null,                 -- e.g. 'Pre Mock Test 2026'
  test_no       integer not null,                 -- 1, 2, 3 …
  test_name     text,
  test_date     date,
  batch         text    not null,                 -- e.g. 'Lakshya A'
  gcc_no        text,                             -- as written on the sheet (may be blank)
  student_name  text    not null,
  marks         jsonb   not null default '{}'::jsonb,   -- {"Mathematics": 21.25, …}
  max_marks     jsonb   not null default '{}'::jsonb,   -- {"Mathematics": 25, …}
  total         numeric not null default 0,
  max_total     numeric not null default 0,
  rank          integer,                          -- rank printed on the sheet
  source_file   text,
  uploaded_by   text,
  created_at    timestamptz not null default now()
);

create index if not exists mock_test_results_series_idx on public.mock_test_results (series, test_no, batch);
create index if not exists mock_test_results_gcc_idx    on public.mock_test_results (gcc_no);

alter table public.mock_test_results enable row level security;

drop policy if exists mock_test_results_all on public.mock_test_results;
create policy mock_test_results_all on public.mock_test_results
  for all to anon, authenticated using (true) with check (true);
