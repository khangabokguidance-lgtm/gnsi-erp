-- ============================================================================
-- Mock Test Analyzer: manual self-study group choices
-- ============================================================================
-- The admin can move a student to a different self-study group (1 = weakest ... 7 = strongest) than the
-- automatic one. One row per series + basis ('overall' or a subject) + student. Without this table the choices
-- are kept in the browser only (the app falls back automatically). Safe to run more than once.
-- ============================================================================

create table if not exists public.mock_test_study_groups (
  series       text        not null,
  basis        text        not null default 'overall',
  student_key  text        not null,
  grp          smallint    not null check (grp between 1 and 7),
  updated_by   text,
  updated_at   timestamptz not null default now(),
  primary key (series, basis, student_key)
);

alter table public.mock_test_study_groups enable row level security;

drop policy if exists mock_test_study_groups_all on public.mock_test_study_groups;
create policy mock_test_study_groups_all on public.mock_test_study_groups
  for all to anon, authenticated using (true) with check (true);
