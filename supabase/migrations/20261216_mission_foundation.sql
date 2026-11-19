-- ============================================================================
-- Mission Foundation 2026-27 — 8 Monday tests for the Foundation batches (Udaan, Pragati)
-- ============================================================================
-- Tables used by src/MissionFoundation.jsx:
--   mission_foundation_tests   one row per test day (date, batches, status)
--   mission_foundation_papers  one row per subject paper of a test: syllabus pattern, setter, checker, progress
--   mission_foundation_panel   which teachers belong to which subject
--   mission_foundation_marks   one row per student × subject × test
--   mission_foundation_materials  study material (file in the private teacher-materials bucket, or a link)
--   mission_foundation_messages   the teachers' group chat
--   mission_foundation_teaching   chapters taught before each test
--   mission_foundation_prizes     prizes decided and handed over
--   mission_foundation_questions  questions of the combined paper (all subjects, one sitting)
-- Staff only (same rule as Mission Sainik): needs public.qbank_is_staff() from 20260925_qbank_rls.sql.
-- Run once in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

create table if not exists public.mission_foundation_tests (
  id          uuid primary key default gen_random_uuid(),
  test_no     integer not null unique,
  test_date   date not null,
  title       text,
  batches     text[] not null default array['Udaan', 'Pragati'],
  status      text not null default 'Planned',         -- Planned / Ready / Conducted / Results out
  notes       text,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists mission_foundation_tests_date_idx on public.mission_foundation_tests (test_date);

create table if not exists public.mission_foundation_papers (
  id            uuid primary key default gen_random_uuid(),
  test_id       uuid not null references public.mission_foundation_tests (id) on delete cascade,
  subject       text not null,
  syllabus      text,                                 -- chapters, "A; B; C"
  questions     integer,
  marks_each    numeric,
  duration_min  integer,
  setter        text,
  verifier      text,
  status        text not null default 'Pending',      -- Pending / Submitted / Checked / Approved
  paper_link    text,
  remarks       text,
  updated_by    text,
  updated_at    timestamptz not null default now(),
  unique (test_id, subject)
);
create index if not exists mission_foundation_papers_setter_idx on public.mission_foundation_papers (setter);

create table if not exists public.mission_foundation_panel (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  teacher     text not null,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (subject, teacher)
);

create table if not exists public.mission_foundation_marks (
  id            uuid primary key default gen_random_uuid(),
  test_id       uuid not null references public.mission_foundation_tests (id) on delete cascade,
  student_id    text not null,
  gcc_no        text,
  student_name  text,
  batch         text,
  subject       text not null,
  marks         numeric,
  absent        boolean not null default false,
  entered_by    text,
  updated_at    timestamptz not null default now(),
  unique (test_id, student_id, subject)
);
create index if not exists mission_foundation_marks_test_idx on public.mission_foundation_marks (test_id);

create table if not exists public.mission_foundation_materials (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  subject      text,
  test_id      uuid references public.mission_foundation_tests (id) on delete set null,
  link_url     text,
  file_path    text,                                  -- path in the 'teacher-materials' storage bucket
  file_name    text,
  note         text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists mission_foundation_materials_subject_idx on public.mission_foundation_materials (subject);

create table if not exists public.mission_foundation_messages (
  id           uuid primary key default gen_random_uuid(),
  author       text not null,
  body         text,
  link_url     text,
  file_path    text,
  file_name    text,
  created_at   timestamptz not null default now()
);
create index if not exists mission_foundation_messages_at_idx on public.mission_foundation_messages (created_at desc);

-- Test day: venue, time, invigilators and the checklist ({"printed": {"done": true, "by": "...", "at": "..."}, ...})
alter table public.mission_foundation_tests add column if not exists venue        text;
alter table public.mission_foundation_tests add column if not exists start_time   text;
alter table public.mission_foundation_tests add column if not exists invigilators text;
alter table public.mission_foundation_tests add column if not exists checklist    jsonb not null default '{}'::jsonb;
-- All six subjects are written in one sitting: one total time per test.
alter table public.mission_foundation_tests add column if not exists duration_min integer default 120;

create table if not exists public.mission_foundation_teaching (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.mission_foundation_tests (id) on delete cascade,
  subject     text not null,
  chapter     text not null,
  done        boolean not null default false,
  taught_by   text,
  taught_on   date,
  updated_at  timestamptz not null default now(),
  unique (test_id, subject, chapter)
);

create table if not exists public.mission_foundation_prizes (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null,                        -- a test id, or 'series'
  award_key     text not null,
  award         text,
  student_id    text not null,
  student_name  text,
  batch         text,
  given         boolean not null default false,
  given_on      date,
  given_by      text,
  updated_at    timestamptz not null default now(),
  unique (scope, award_key, student_id)
);

-- Combined question paper: every subject's questions for a test, printed as one booklet.
create table if not exists public.mission_foundation_questions (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references public.mission_foundation_tests(id) on delete cascade,
  subject      text not null,
  position     integer not null default 0,
  question     text not null,
  option_a     text not null,
  option_b     text not null,
  option_c     text not null,
  option_d     text not null,
  answer       text not null check (answer in ('A', 'B', 'C', 'D')),
  explanation  text,
  topic        text,
  difficulty   text,
  passage      text,
  image_data   text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists mission_foundation_questions_test on public.mission_foundation_questions (test_id, subject, position);

do $$
declare t text;
begin
  foreach t in array array['mission_foundation_tests', 'mission_foundation_papers', 'mission_foundation_panel', 'mission_foundation_marks',
                       'mission_foundation_materials', 'mission_foundation_messages', 'mission_foundation_teaching', 'mission_foundation_prizes',
                       'mission_foundation_questions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff())', t || '_staff', t);
  end loop;
end $$;

-- Files go to the private 'teacher-materials' bucket (staff-only policy from 20261208_mission_sainik_lockdown.sql).
insert into storage.buckets (id, name, public) values ('teacher-materials', 'teacher-materials', false)
  on conflict (id) do nothing;

-- Live group chat: new messages appear without refreshing (the screen also re-checks every 15 seconds).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mission_foundation_messages') then
    execute 'alter publication supabase_realtime add table public.mission_foundation_messages';
  end if;
end $$;
