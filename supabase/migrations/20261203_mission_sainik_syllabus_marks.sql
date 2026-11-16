-- Mission Sainik 2027 — syllabus plan (Annexure-III) and Daily Class Test marks tracker (Annexure-V).
-- Open to all staff, like the rest of the module. Safe to run more than once.
create table if not exists public.mission_sainik_syllabus (
  id         bigserial primary key,
  test_no    integer not null,
  subject    text not null,
  chapter    text,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint mission_sainik_syllabus_uq unique (test_no, subject)
);
create table if not exists public.mission_sainik_marks (
  id          bigserial primary key,
  test_no     integer not null,
  batch       text not null default '',
  maths       numeric,   -- /60
  reasoning   numeric,   -- /20
  grammar     numeric,   -- /20
  gk          numeric,   -- /20
  entered_by  text,
  created_at  timestamptz not null default now(),
  constraint mission_sainik_marks_uq unique (test_no, batch)
);
alter table public.mission_sainik_syllabus enable row level security;
alter table public.mission_sainik_marks enable row level security;
drop policy if exists mission_sainik_syllabus_all on public.mission_sainik_syllabus;
create policy mission_sainik_syllabus_all on public.mission_sainik_syllabus for all to anon, authenticated using (true) with check (true);
drop policy if exists mission_sainik_marks_all on public.mission_sainik_marks;
create policy mission_sainik_marks_all on public.mission_sainik_marks for all to anon, authenticated using (true) with check (true);
