-- ============================================================================
-- student_mismatch_log: let signed-in staff read and write the mismatch log
-- ============================================================================
-- Symptom this fixes (browser console, repeated hundreds of times):
--   mismatchLog: insert failed: new row violates row-level security policy
--   for table "student_mismatch_log"
--
-- The cross-module mismatch scan (Student 360° → Notify Admin, plus the hourly
-- admin auto-scan) writes one row per detected data problem. The table has
-- row-level security switched on but no policy that lets the app's session
-- insert, so every write is refused.
--
-- This grants access to the `authenticated` role only — i.e. staff who are
-- signed in to the secure Supabase session at login. It is deliberately NOT
-- granted to `anon`, because the log holds student names and GCC numbers and
-- the public website uses the anon key.
--
-- If the error continues after running this, the browser has no secure
-- session: look for the "Secure database connection is off" banner and use
-- "Sign in again".
--
-- Only touches the table if it exists. Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regclass('public.student_mismatch_log') is null then
    raise notice 'public.student_mismatch_log does not exist yet - create the table first, then re-run this file.';
    return;
  end if;

  execute 'alter table public.student_mismatch_log enable row level security';
  execute 'drop policy if exists student_mismatch_log_staff_all on public.student_mismatch_log';
  execute 'create policy student_mismatch_log_staff_all on public.student_mismatch_log
             for all to authenticated using (true) with check (true)';
end $$;
