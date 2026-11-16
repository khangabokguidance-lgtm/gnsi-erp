-- Mission Sainik 2027 — reading passages and figures for the exam-book paper layout.
-- passage: shared text printed once above a run of questions. image_data: a small figure (data: URL, resized in the browser).
-- Run after 20261210. Safe to re-run.
alter table public.mission_sainik_questions add column if not exists passage text;
alter table public.mission_sainik_questions add column if not exists image_data text;
