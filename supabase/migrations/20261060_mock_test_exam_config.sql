-- ============================================================================
-- Mock Test Analyzer: Navodaya / Sainik targets per test series
-- ============================================================================
--   exam_config  {"navodaya":{"cutoff":50,"seats":10,"sectionMin":0},
--                 "sainik":{...}, "override":{"Batch name":"sainik"}}
-- Safe to run more than once. Needs 20261013_mock_test_settings.sql first.
-- ============================================================================

alter table public.mock_test_settings
  add column if not exists exam_config jsonb not null default '{}'::jsonb;
