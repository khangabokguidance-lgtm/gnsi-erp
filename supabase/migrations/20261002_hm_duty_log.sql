-- 20261002_hm_duty_log.sql — daily study-duty roster completion per house.
-- One row per (house, date); `done` maps checklist item keys to true.
-- Safe to run more than once.
create table if not exists public.hm_duty_log (
  id               bigserial primary key,
  house            text not null,
  duty_date        date not null,
  housemaster_name text,
  done             jsonb not null default '{}',
  photo_sent       boolean not null default false,
  erp_checked      boolean not null default false,
  notes            text,
  updated_at       timestamptz default now(),
  unique (house, duty_date)
);
alter table public.hm_duty_log disable row level security;
