-- ============================================================================
-- Entrance Examination: exam-board workflow columns
-- ============================================================================
-- Entrance.jsx now runs the full cycle: application window and fees →
-- verification → question paper generated from the Question Bank (with
-- shuffled sets) → seating and hall tickets → attendance → OMR evaluation →
-- ranks and category-wise merit → seat allocation with a waitlist.
--
-- This migration only ADDS nullable columns to the existing entrance tables.
-- Nothing is renamed or dropped, and existing rows keep working: until it is
-- applied the page still loads, saves what it can, and shows a notice naming
-- the missing columns.
--
-- Safe to run more than once (IF NOT EXISTS everywhere).
-- ============================================================================

alter table public.entrance_exams
  add column if not exists course            text,      -- qbankTaxonomy course key: sainik | navodaya | rms | foundation
  add column if not exists pattern           jsonb,     -- [{name, subject, questions, marks_each}]
  add column if not exists paper             jsonb,     -- frozen question paper snapshot + set orders
  add column if not exists rules             jsonb,     -- {min_section_pct, relax_reserved}
  add column if not exists negative_marks    numeric default 0,
  add column if not exists app_open          date,
  add column if not exists app_close         date,
  add column if not exists application_fee   numeric default 0,
  add column if not exists total_seats       integer,
  add column if not exists quotas            jsonb,     -- {"SC":15,"ST":7.5,"OBC":27,"EWS":10}
  add column if not exists rooms             jsonb,     -- [{name, capacity}]
  add column if not exists reporting_time    text,
  add column if not exists result_published  boolean default false;

alter table public.entrance_candidates
  add column if not exists application_no  text,
  add column if not exists gender          text,
  add column if not exists category        text default 'General',
  add column if not exists email           text,
  add column if not exists fee_status      text default 'Unpaid',
  add column if not exists fee_ref         text,
  add column if not exists fee_paid_on     date,
  add column if not exists verified        boolean default false,
  add column if not exists room            text,
  add column if not exists seat_no         integer,
  add column if not exists paper_set       text;

alter table public.entrance_results
  add column if not exists responses       text,        -- OMR string, one char per question (A-D, '-' blank, '*' invalid)
  add column if not exists correct_count   integer,
  add column if not exists wrong_count     integer,
  add column if not exists blank_count     integer,
  add column if not exists overall_rank    integer,
  add column if not exists category_rank   integer,
  add column if not exists allotted_quota  text,
  add column if not exists evaluated_at    timestamptz;

create index if not exists entrance_candidates_exam_idx on public.entrance_candidates (exam_id);
create index if not exists entrance_results_candidate_idx on public.entrance_results (candidate_id);
create index if not exists entrance_results_exam_idx on public.entrance_results (exam_id);

-- Not added on purpose: a UNIQUE (exam_id, roll_number) index. The old page
-- numbered candidates as "count + 1", which repeats a roll number after a
-- delete, so existing data may already hold duplicates. Check first:
--   select exam_id, roll_number, count(*) from entrance_candidates
--   group by 1, 2 having count(*) > 1;
-- and only when that returns nothing:
--   create unique index entrance_candidates_exam_roll_uq
--     on public.entrance_candidates (exam_id, roll_number);
