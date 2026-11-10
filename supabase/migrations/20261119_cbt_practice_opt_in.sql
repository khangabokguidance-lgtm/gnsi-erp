-- ────────────────────────────────────────────────────────────────────────────
-- Online exam: past-exam PRACTICE is now OPT-IN per test (run after 20261118; safe to run more than once).
--   Why: with the switch on by default, the moment a test closed its whole paper and answer key could be taken by anyone —
--   a problem if the same questions are used again for another batch. Now an admin turns it on for a test on purpose
--   (Publish → "Allow practice after it closes", ticked by default for a NEW publish).
--   This makes the column default OFF and switches it off for tests that exist now; tick it again in Publish for the
--   past exams you want students to practise.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.cbt_tests add column if not exists practice_after_close boolean not null default false;
alter table public.cbt_tests alter column practice_after_close set default false;
update public.cbt_tests set practice_after_close = false where practice_after_close is distinct from false;
