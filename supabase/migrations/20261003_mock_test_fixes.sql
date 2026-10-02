-- ============================================================================
-- Mock Test Analyzer: Student Data Fix Engine rules
-- ============================================================================
-- Uploaded result sheets are never edited. Corrections (wrong / blank GCC,
-- merging two spellings of one child, removing a bad record) are stored here as
-- small rules and re-applied every time the analyzer loads, so they also fix
-- future uploads of the same child and can be undone by deleting the rule.
--
--   kind     'row'  rewrite gcc / name / batch on matching rows
--            'drop' ignore matching rows
--   match    {"batch":"Lakshya A","test_no":1,"gcc":"566","name":"AVAT ARIBAM"}
--            (all given keys must match the ORIGINAL row; gcc "" = blank)
--   changes  {"gcc":"966","name":"AYAT ARIBAM"}
--   grp      rules created together (one issue / one merge) share a group so
--            "Undo" removes them together
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.mock_test_fixes (
  id          uuid primary key default gen_random_uuid(),
  series      text,                                   -- null = every series
  kind        text    not null default 'row',
  match       jsonb   not null default '{}'::jsonb,
  changes     jsonb   not null default '{}'::jsonb,
  note        text,
  grp         text,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists mock_test_fixes_series_idx on public.mock_test_fixes (series);
create index if not exists mock_test_fixes_grp_idx    on public.mock_test_fixes (grp);

alter table public.mock_test_fixes enable row level security;

drop policy if exists mock_test_fixes_all on public.mock_test_fixes;
create policy mock_test_fixes_all on public.mock_test_fixes
  for all to anon, authenticated using (true) with check (true);
