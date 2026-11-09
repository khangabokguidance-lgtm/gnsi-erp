-- Persist "Absent" separately from a real score of 0 so it survives a reload.
-- The app works without this column (it falls back to the old behaviour), so
-- running it is safe at any time.
alter table public.exam_marks add column if not exists is_absent boolean not null default false;
