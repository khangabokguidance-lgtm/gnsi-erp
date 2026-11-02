-- ============================================================================
-- Mock Test Analyzer: instructions for every duty assignment (where / why / when)
-- ============================================================================
-- Each person on duty for a self-study group (House Master / Mistress or teacher) gets an instruction:
--   venue       where they are assigned (room / place)
--   reason      why - what the duty is for
--   days        the days, e.g. 'Mon,Wed'
--   time_from / time_to   the time slot, 24-hour 'HH:MM'
--   instruction anything else they must do
-- Added to the assignment table and to the manually built groups. Without these columns the app keeps the
-- instructions in the browser only (it falls back automatically). Safe to run more than once.
-- Requires 20261050 (mock_test_group_mentors) and 20261052 (mock_test_custom_groups).
-- ============================================================================

alter table public.mock_test_group_mentors
  add column if not exists venue       text,
  add column if not exists reason      text,
  add column if not exists days        text,
  add column if not exists time_from   text,
  add column if not exists time_to     text,
  add column if not exists instruction text;

alter table public.mock_test_custom_groups
  add column if not exists venue       text,
  add column if not exists reason      text,
  add column if not exists days        text,
  add column if not exists time_from   text,
  add column if not exists time_to     text,
  add column if not exists instruction text;
