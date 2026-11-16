-- Mission Sainik 2027 — question bank behind the Pre Mock Test Builder and Mega Mock Test Builder.
-- Teachers upload questions per series/test/section; the builder assembles the paper and answer key.
-- Safe to run more than once.
create table if not exists public.mission_sainik_questions (
  id           bigserial primary key,
  series       text not null check (series in ('pre', 'mega')),
  test_no      integer not null,
  section      text not null,
  question     text not null,
  option_a     text not null,
  option_b     text not null,
  option_c     text not null,
  option_d     text not null,
  answer       text not null check (answer in ('A', 'B', 'C', 'D')),
  explanation  text,
  topic        text,
  difficulty   text check (difficulty in ('Easy', 'Medium', 'Hard')),
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists mission_sainik_questions_idx on public.mission_sainik_questions (series, test_no, section);
alter table public.mission_sainik_questions enable row level security;
drop policy if exists mission_sainik_questions_all on public.mission_sainik_questions;
create policy mission_sainik_questions_all on public.mission_sainik_questions for all to authenticated using (true) with check (true);
