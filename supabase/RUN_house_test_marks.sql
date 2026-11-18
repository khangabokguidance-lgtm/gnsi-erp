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
