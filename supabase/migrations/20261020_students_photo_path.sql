-- ============================================================================
-- students.photo_path: where a student's stored photo lives
-- ============================================================================
-- Symptom: "Student saved, but the photo failed: Save failed"
--
-- The photo uploads to the private 'gnsi' bucket, then the app records its
-- storage path in students.photo_path (and clears photo_url). If that column
-- is missing the update is refused. Adds both photo columns if absent, and
-- asks the API to refresh its schema cache.
--
-- Safe to run more than once.
-- ============================================================================

alter table public.students add column if not exists photo_path text;
alter table public.students add column if not exists photo_url  text;

notify pgrst, 'reload schema';
