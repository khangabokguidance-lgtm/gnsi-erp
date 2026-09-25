-- ============================================================================
-- Question Bank: server-side access control
-- ============================================================================
-- Until now every QuestionBank.jsx permission (admin-only delete, staff-only
-- writes) was enforced only in the browser. Anyone holding the public anon
-- key could insert/update/delete qbank rows directly, including the
-- "delete every question" call. This migration moves those rules into
-- Postgres row-level security.
--
-- WHAT IT ENFORCES
--   qbank_questions      read: everyone (cast receiver on a TV, viewer, dashboards)
--                        insert/update: linked staff · delete: admins
--   qbank_cast_sessions  read: everyone (cast receiver) · insert/update: staff
--                        delete: admins
--   qbank_test_results   read/insert: staff · update/delete: admins
--   mayek_dictionary     read: everyone · insert/update: staff · delete: admins
--   storage bucket question-diagrams: PNG/JPEG/WebP/GIF only, 5 MB max;
--                        upload/replace/delete: staff
--
-- HOW "STAFF" IS DETERMINED
--   Staff sessions are Supabase Auth sessions created by linkSupabaseAuth()
--   in Login.jsx, whose email is staffEmail(username) =
--   lower(username) with [^a-z0-9._-] -> '_' , + '.staff@guidancekhangabok.in'.
--   qbank_actor_role() maps the signed-in email back to portal_users.role.
--   Admin roles match roles.js ADMIN_ROLES.
--
-- REVIEW BEFORE APPLYING
--   1. If staff_link_auth() records the auth link in a column (e.g.
--      portal_users.auth_user_id), change qbank_actor_role() to match on
--      auth.uid() against that column instead of the email. That is stronger:
--      with open sign-ups and "Confirm email" off, someone could pre-register
--      the auth email of a staff member who has never logged in.
--   2. Staff whose login shows "Supabase Auth link skipped" in the console
--      have no auth session, and their question-bank writes will be refused
--      after this runs. Check that linking works for everyone first.
--   3. Write rules are RESTRICTIVE policies: they are AND-ed with any
--      policies already on these tables, so they can only tighten access.
--      The permissive "base" policies re-state reads as open (the app
--      already relies on that); drop them if reads were meant to be
--      narrower. Service-role scripts (src/*.cjs) bypass RLS as before.
-- ============================================================================

create or replace function public.qbank_actor_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pu.role
  from public.portal_users pu
  where auth.uid() is not null
    and regexp_replace(lower(trim(pu.username)), '[^a-z0-9._-]', '_', 'g')
        || '.staff@guidancekhangabok.in'
        = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

create or replace function public.qbank_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.qbank_actor_role() is not null
$$;

create or replace function public.qbank_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.qbank_actor_role() in ('Admin', 'Administrator', 'Co-Admin'), false)
$$;

revoke all on function public.qbank_actor_role() from public;
grant execute on function public.qbank_actor_role() to anon, authenticated;
grant execute on function public.qbank_is_staff()   to anon, authenticated;
grant execute on function public.qbank_is_admin()   to anon, authenticated;

-- ── qbank_questions ─────────────────────────────────────────────────────────
alter table public.qbank_questions enable row level security;

drop policy if exists qbank_questions_read_all      on public.qbank_questions;
drop policy if exists qbank_questions_write_base    on public.qbank_questions;
drop policy if exists qbank_questions_insert_staff  on public.qbank_questions;
drop policy if exists qbank_questions_update_staff  on public.qbank_questions;
drop policy if exists qbank_questions_delete_admin  on public.qbank_questions;

create policy qbank_questions_read_all on public.qbank_questions
  for select to anon, authenticated using (true);
create policy qbank_questions_write_base on public.qbank_questions
  for all to authenticated using (true) with check (true);
create policy qbank_questions_insert_staff on public.qbank_questions
  as restrictive for insert to public with check (public.qbank_is_staff());
create policy qbank_questions_update_staff on public.qbank_questions
  as restrictive for update to public
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
create policy qbank_questions_delete_admin on public.qbank_questions
  as restrictive for delete to public using (public.qbank_is_admin());

-- ── qbank_cast_sessions ─────────────────────────────────────────────────────
alter table public.qbank_cast_sessions enable row level security;

drop policy if exists qbank_cast_read_all      on public.qbank_cast_sessions;
drop policy if exists qbank_cast_write_base    on public.qbank_cast_sessions;
drop policy if exists qbank_cast_insert_staff  on public.qbank_cast_sessions;
drop policy if exists qbank_cast_update_staff  on public.qbank_cast_sessions;
drop policy if exists qbank_cast_delete_admin  on public.qbank_cast_sessions;

create policy qbank_cast_read_all on public.qbank_cast_sessions
  for select to anon, authenticated using (true);
create policy qbank_cast_write_base on public.qbank_cast_sessions
  for all to authenticated using (true) with check (true);
create policy qbank_cast_insert_staff on public.qbank_cast_sessions
  as restrictive for insert to public with check (public.qbank_is_staff());
create policy qbank_cast_update_staff on public.qbank_cast_sessions
  as restrictive for update to public
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
create policy qbank_cast_delete_admin on public.qbank_cast_sessions
  as restrictive for delete to public using (public.qbank_is_admin());

-- ── qbank_test_results ──────────────────────────────────────────────────────
alter table public.qbank_test_results enable row level security;

drop policy if exists qbank_results_base          on public.qbank_test_results;
drop policy if exists qbank_results_read_staff    on public.qbank_test_results;
drop policy if exists qbank_results_insert_staff  on public.qbank_test_results;
drop policy if exists qbank_results_update_admin  on public.qbank_test_results;
drop policy if exists qbank_results_delete_admin  on public.qbank_test_results;

create policy qbank_results_base on public.qbank_test_results
  for all to authenticated using (true) with check (true);
create policy qbank_results_read_staff on public.qbank_test_results
  as restrictive for select to public using (public.qbank_is_staff());
create policy qbank_results_insert_staff on public.qbank_test_results
  as restrictive for insert to public with check (public.qbank_is_staff());
create policy qbank_results_update_admin on public.qbank_test_results
  as restrictive for update to public
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
create policy qbank_results_delete_admin on public.qbank_test_results
  as restrictive for delete to public using (public.qbank_is_admin());

-- ── mayek_dictionary ────────────────────────────────────────────────────────
alter table public.mayek_dictionary enable row level security;

drop policy if exists mayek_dict_read_all      on public.mayek_dictionary;
drop policy if exists mayek_dict_write_base    on public.mayek_dictionary;
drop policy if exists mayek_dict_insert_staff  on public.mayek_dictionary;
drop policy if exists mayek_dict_update_staff  on public.mayek_dictionary;
drop policy if exists mayek_dict_delete_admin  on public.mayek_dictionary;

create policy mayek_dict_read_all on public.mayek_dictionary
  for select to anon, authenticated using (true);
create policy mayek_dict_write_base on public.mayek_dictionary
  for all to authenticated using (true) with check (true);
create policy mayek_dict_insert_staff on public.mayek_dictionary
  as restrictive for insert to public with check (public.qbank_is_staff());
create policy mayek_dict_update_staff on public.mayek_dictionary
  as restrictive for update to public
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
create policy mayek_dict_delete_admin on public.mayek_dictionary
  as restrictive for delete to public using (public.qbank_is_admin());

-- ── storage: question-diagrams bucket ──────────────────────────────────────
-- Server-side type/size limits (the client checks too, but that is only a
-- convenience). SVG is excluded: it can carry script and is served publicly.
update storage.buckets
set file_size_limit    = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'question-diagrams';

drop policy if exists qbank_diagrams_write_base    on storage.objects;
drop policy if exists qbank_diagrams_insert_staff  on storage.objects;
drop policy if exists qbank_diagrams_update_staff  on storage.objects;
drop policy if exists qbank_diagrams_delete_staff  on storage.objects;

create policy qbank_diagrams_write_base on storage.objects
  for all to authenticated
  using (bucket_id = 'question-diagrams') with check (bucket_id = 'question-diagrams');
-- Restrictive policies on storage.objects apply to every bucket, so each
-- one passes rows from other buckets through untouched.
create policy qbank_diagrams_insert_staff on storage.objects
  as restrictive for insert to public
  with check (bucket_id <> 'question-diagrams' or public.qbank_is_staff());
create policy qbank_diagrams_update_staff on storage.objects
  as restrictive for update to public
  using (bucket_id <> 'question-diagrams' or public.qbank_is_staff())
  with check (bucket_id <> 'question-diagrams' or public.qbank_is_staff());
create policy qbank_diagrams_delete_staff on storage.objects
  as restrictive for delete to public
  using (bucket_id <> 'question-diagrams' or public.qbank_is_staff());
