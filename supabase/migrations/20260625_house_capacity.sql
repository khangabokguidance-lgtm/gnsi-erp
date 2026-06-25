-- supabase/migrations/20260625_house_capacity.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds a real `capacity` column to the `houses` table (managed in
-- Hostel.jsx's HouseTab) so that Admissions.jsx, Hostel.jsx, and
-- promoteToStudent() in feeEngine.js can all check occupancy against ONE
-- number instead of three independent hardcoded guesses.
--
-- Backfills using the exact same defaults Admissions.jsx already hardcodes
-- in HOUSE_CAPACITIES, so nothing changes behaviorally on day one — this
-- migration only makes the existing assumption real and shared, it doesn't
-- change any limit.
-- ─────────────────────────────────────────────────────────────────────────────

alter table houses
  add column if not exists capacity integer not null default 40;

-- Backfill to match what Admissions.jsx has assumed all along
-- (HOUSE_CAPACITIES = { Kombirei:40, Shiroi:40, ..., 'Block-B':30, 'Day Scholar':999 })
update houses set capacity = 30  where lower(name) = 'block-b';
update houses set capacity = 999 where lower(name) = 'day scholar';
-- everything else stays at the column default of 40

comment on column houses.capacity is
  'Maximum number of students this house can hold. Checked by promoteToStudent() (feeEngine.js) and by Admissions.jsx before any house assignment — this is the single source of truth for house capacity across the whole portal. Update here, not in any hardcoded JS constant.';
