-- Mission Foundation: study material written in the portal (a builder, not only an uploaded file).
-- body holds the notes in the same simple markup as Mission Sainik study material (headings, lists, tables, maths, figures).
-- Run once in the Supabase SQL editor. Safe to run more than once.
alter table public.mission_foundation_materials add column if not exists body text;
alter table public.mission_foundation_materials add column if not exists updated_at timestamptz;
