-- ============================================================================
-- Mock Test Analyzer: House Master / Mistress assigned to a self-study group
-- ============================================================================
-- For each series + basis ('overall' or a subject) + set (a class, or the mixed set of a language) + group
-- number (1 = weakest ... 7 = strongest), the admin picks the House Master / Mistress who looks after the group.
-- Without this table the choice is kept in the browser only (the app falls back automatically).
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.mock_test_group_mentors (
  series        text        not null,
  basis         text        not null default 'overall',
  scope         text        not null,
  grp           smallint    not null check (grp between 1 and 7),
  mentor_name   text        not null,
  mentor_title  text,
  updated_by    text,
  updated_at    timestamptz not null default now(),
  primary key (series, basis, scope, grp)
);

alter table public.mock_test_group_mentors enable row level security;

drop policy if exists mock_test_group_mentors_all on public.mock_test_group_mentors;
create policy mock_test_group_mentors_all on public.mock_test_group_mentors
  for all to anon, authenticated using (true) with check (true);
