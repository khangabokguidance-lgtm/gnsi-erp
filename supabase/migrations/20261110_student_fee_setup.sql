-- ============================================================================
-- 20261110_student_fee_setup.sql — custom fee setup for one student
--
-- student_fee_overrides used to hold only a per-student FLAT fee. An admin can
-- now also give a student their own COURSE fee and ADMISSION fee for a session.
-- A column left empty (NULL) means "use the standard rate from Fee Setup", so a
-- student with no row — or an empty column — stays on the default.
--
-- Safe to run more than once.
-- ============================================================================

alter table public.student_fee_overrides add column if not exists course_fee_override    numeric;
alter table public.student_fee_overrides add column if not exists admission_fee_override numeric;

-- A row may now set only some of the three fees.
alter table public.student_fee_overrides alter column flat_fee_override drop not null;
