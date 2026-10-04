-- ============================================================================
-- Mock Test Analyzer: pass marks per test series
-- ============================================================================
-- The pass mark (and optional per-batch pass marks) are stored here so they
-- follow the user across browsers and devices instead of living in one
-- browser's localStorage.
--   pass_pct       series-wide pass mark (%)
--   pass_by_batch  {"Lakshya A": 60, "Umeed": 45} overrides per batch
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.mock_test_settings (
  series         text primary key,
  pass_pct       numeric not null default 40,
  pass_by_batch  jsonb   not null default '{}'::jsonb,
  updated_by     text,
  updated_at     timestamptz not null default now()
);

alter table public.mock_test_settings enable row level security;

drop policy if exists mock_test_settings_all on public.mock_test_settings;
create policy mock_test_settings_all on public.mock_test_settings
  for all to anon, authenticated using (true) with check (true);
