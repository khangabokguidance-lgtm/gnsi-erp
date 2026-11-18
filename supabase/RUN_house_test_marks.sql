-- House Marks tab (Hostel → 📝 Marks): one row per house test.
-- Run once in the Supabase SQL editor. RLS is off, like the rest of the portal tables.
create table if not exists public.house_test_marks (
  id          uuid primary key default gen_random_uuid(),
  test_name   text not null,
  test_date   date not null default current_date,
  house       text not null default 'All',
  subjects    jsonb not null default '[]'::jsonb,   -- [{n, max, min}]
  marks       jsonb not null default '{}'::jsonb,   -- { "<student_id>": { gcc, name, m: [mark|"AB"|null,...] } }
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists house_test_marks_house_date_idx on public.house_test_marks (house, test_date desc);
alter table public.house_test_marks disable row level security;

-- ── Student progress analysis: one row per student per test (written when a test is saved) ──
-- Run once in the Supabase SQL editor (safe to re-run). RLS is off, like the rest of the portal tables.
create table if not exists public.house_test_results (
  id             bigint generated always as identity primary key,
  test_id        uuid not null references public.house_test_marks(id) on delete cascade,
  student_id     text not null,
  gcc_no         text,
  student_name   text,
  class_name     text,
  group_name     text,
  house          text,
  test_name      text not null,
  test_date      date not null,
  subjects       jsonb not null default '[]'::jsonb,   -- [{n, max, min}]
  marks          jsonb not null default '[]'::jsonb,   -- [mark | "AB" | null, ...] in subject order
  total          numeric,
  max_total      numeric,
  percent        numeric,                              -- total / max_total * 100
  rank           int,                                  -- ties share a rank; null if unranked
  ranked_of      int,                                  -- how many students were ranked in this test
  class_avg_pct  numeric,                              -- average % of the ranked students in this test
  absent         boolean not null default false,
  updated_at     timestamptz not null default now(),
  unique (test_id, student_id)
);
create index if not exists house_test_results_student_idx on public.house_test_results (student_id, test_date);
create index if not exists house_test_results_gcc_idx on public.house_test_results (gcc_no, test_date);
alter table public.house_test_results disable row level security;

-- ── Saved student lists (one-tap "Class VI", "Navodaya batch"...), kept per house ──
-- Run once in the Supabase SQL editor (safe to re-run). RLS is off, like the rest of the portal tables.
create table if not exists public.house_test_groups (
  id           uuid primary key default gen_random_uuid(),
  house        text not null default 'All',
  name         text not null,
  student_ids  jsonb not null default '[]'::jsonb,   -- [student id, ...]
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (house, name)
);
alter table public.house_test_groups disable row level security;

-- ── Saved lists belong to each housemaster (run once; safe to re-run) ──
alter table public.house_test_groups add column if not exists owner text not null default '';
alter table public.house_test_groups drop constraint if exists house_test_groups_house_name_key;
create unique index if not exists house_test_groups_owner_name_uidx on public.house_test_groups (owner, name);
