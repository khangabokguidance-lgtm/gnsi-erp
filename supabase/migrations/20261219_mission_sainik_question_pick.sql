-- Mission Sainik — several teachers can set the same paper / set; an admin chooses the best questions for the final paper.
-- Run AFTER 20261206_mission_sainik_questions.sql. Safe to re-run.
-- in_paper = the admin marked this question as "use in the paper". When nothing is marked, the first N uploaded questions are used (as before).
alter table public.mission_sainik_questions add column if not exists in_paper boolean not null default false;
alter table public.mission_sainik_questions add column if not exists in_paper_by text;
