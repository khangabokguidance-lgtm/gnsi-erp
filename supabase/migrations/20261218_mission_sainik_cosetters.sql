-- Mission Sainik — several setters on one paper.
-- Run AFTER 20261201_mission_sainik_tasks.sql. Safe to re-run.
-- `setter` stays the main setter; `co_setters` holds the other teachers who set the same paper, separated by ";" (e.g. 'Kabiraj; Lenin').
alter table public.mission_sainik_tasks add column if not exists co_setters text;
