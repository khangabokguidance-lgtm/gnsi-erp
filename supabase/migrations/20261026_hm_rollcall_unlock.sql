-- ============================================================================
-- Roll call cutoff: housemasters ask the admin to unlock a closed roll call
-- ============================================================================
-- Morning roll call closes at 7:30 AM and night roll call at 10:00 PM. After
-- that the roll call is blocked for that house and day. The housemaster sends
-- a request here; an admin approves or declines it from Hostel → Roll Call.
-- Until this table exists nobody is blocked.
--
-- Run once in the Supabase SQL editor. Safe to run again.
-- ============================================================================

create table if not exists hm_rollcall_unlock (
  id           bigserial primary key,
  house        text not null,
  date         date not null,
  session      text not null,
  requested_by text,
  reason       text,
  status       text not null default 'pending',
  decided_by   text,
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (house, date, session)
);

create index if not exists hm_rollcall_unlock_status
  on hm_rollcall_unlock (status, date);

alter table hm_rollcall_unlock disable row level security;
