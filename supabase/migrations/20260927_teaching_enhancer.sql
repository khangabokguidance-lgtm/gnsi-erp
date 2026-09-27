-- ============================================================================
-- Study Materials → Teaching Enhancer: lesson plans, ratings/bookmarks,
-- material requests
-- ============================================================================
-- The Teaching Enhancer tab (inside Study Materials, so it also shows in the
-- Teaching module) lets staff:
--   • plan lessons per chapter and reuse them  → teaching_lesson_plans
--   • rate and bookmark study materials        → study_material_feedback
--   • request missing material for a chapter    → study_material_requests
--     (admins mark requests in progress / done / declined)
--
-- REQUIRES 20260925_qbank_rls.sql first: the policies below reuse its
-- qbank_is_staff() / qbank_is_admin() helpers, which map the signed-in
-- Supabase Auth email back to portal_users.role.
--
-- Until this runs the page still works: the enhancer shows a notice and the
-- rating/bookmark buttons stay hidden.
--
-- Rows record the author's auth email (set by default from the session) so
-- staff can edit only their own plans, feedback and requests; admins can
-- edit everything. Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Lesson plans ────────────────────────────────────────────────────────────
create table if not exists public.teaching_lesson_plans (
  id            uuid primary key default gen_random_uuid(),
  course        text not null,
  subject       text not null,
  chapter       text not null,
  title         text not null,
  class_label   text,                         -- e.g. "Class 6 · Section A"
  duration_min  integer default 40,
  objectives    text,
  blocks        jsonb default '[]'::jsonb,    -- [{kind, title, minutes, notes}]
  material_ids  jsonb default '[]'::jsonb,    -- study_materials ids attached
  question_ids  jsonb default '[]'::jsonb,    -- qbank_questions ids for the quick quiz
  homework      text,
  status        text default 'draft',         -- draft | ready | taught
  taught_on     date,
  author_name   text,
  author_email  text default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists teaching_lesson_plans_chapter_idx on public.teaching_lesson_plans (course, subject, chapter);

-- ── Ratings + bookmarks (one row per staff member per material) ─────────────
create table if not exists public.study_material_feedback (
  id            uuid primary key default gen_random_uuid(),
  material_id   text not null,               -- study_materials.id (stored as text)
  rating        smallint check (rating between 1 and 5),
  bookmarked    boolean default false,
  author_name   text,
  author_email  text default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (material_id, author_email)
);
create index if not exists study_material_feedback_material_idx on public.study_material_feedback (material_id);

-- ── Requests for missing material ───────────────────────────────────────────
create table if not exists public.study_material_requests (
  id              uuid primary key default gen_random_uuid(),
  course          text not null,
  subject         text not null,
  chapter         text,
  material_type   text,                       -- notes | formula | practice | … (Study Materials types)
  note            text,
  priority        text default 'normal',      -- normal | urgent
  status          text default 'open',        -- open | in_progress | done | declined
  admin_note      text,
  requested_by    text,
  author_email    text default lower(coalesce(auth.jwt() ->> 'email', '')),
  handled_by      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists study_material_requests_status_idx on public.study_material_requests (status);

-- ── Row-level security ─────────────────────────────────────────────────────
-- Staff read everything (plans and requests are shared across the staff
-- room); writes are limited to the author or an admin.
create or replace function public.teaching_is_author(email text)
returns boolean
language sql
stable
as $$
  select coalesce(lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')), false)
$$;
grant execute on function public.teaching_is_author(text) to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['teaching_lesson_plans', 'study_material_feedback', 'study_material_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read_staff', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_staff', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.qbank_is_staff())', t || '_read_staff', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.qbank_is_staff())', t || '_insert_staff', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.qbank_is_admin() or public.teaching_is_author(author_email)) with check (public.qbank_is_admin() or public.teaching_is_author(author_email))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.qbank_is_admin() or public.teaching_is_author(author_email))', t || '_delete_own', t);
  end loop;
end $$;

-- Authors cannot move their own request to done/declined; only admins
-- handle requests. (Authors may still edit the note or cancel by deleting.)
create or replace function public.study_material_requests_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and not public.qbank_is_admin() then
    raise exception 'Only admins can change a request''s status';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists study_material_requests_guard on public.study_material_requests;
create trigger study_material_requests_guard
  before update on public.study_material_requests
  for each row execute function public.study_material_requests_guard();
