-- ============================================================================
-- Before-roll-call checklist: "Nothing to report" confirmations
-- ============================================================================
-- Before a housemaster can start a roll call, each compulsory tab
-- (Discipline, Sickbay, Repairs, Journal, Mess Duty, Activities — chosen by
-- an admin) must have an entry for that session, or the housemaster must
-- confirm "Nothing to report" for it. Those confirmations are saved here, so
-- they count for the later compliance check and the housemaster ranking.
--
-- Which tabs are compulsory is saved in system_settings under the key
-- hostel_rollcall_required_tabs (set from Hostel → Roll Call, admins only).
--
-- Run once in the Supabase SQL editor. Safe to run again.
-- ============================================================================

create table if not exists hm_rollcall_precheck (
  id           bigserial primary key,
  house        text not null,
  date         date not null,
  session      text not null,            -- 'morning' or 'night'
  tab_key      text not null,            -- discipline, sickbay, maintenance, journal, messduty, activities
  status       text not null default 'none', -- 'none' = Nothing to report
  confirmed_by text,
  created_at   timestamptz not null default now(),
  unique (house, date, session, tab_key)
);

create index if not exists hm_rollcall_precheck_house_date
  on hm_rollcall_precheck (house, date);

-- Same access as hm_neglect_log (the app's staff login is not Supabase auth).
alter table hm_rollcall_precheck disable row level security;
