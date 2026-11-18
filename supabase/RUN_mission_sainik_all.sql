-- Mission Sainik: every migration 20261201 → 20261215 in order, as one paste-and-run script for the Supabase SQL editor.
-- Each part is written to be safe to re-run, so it is fine to run this even if some parts were already applied.

-- ═══ 20261201_mission_sainik_tasks.sql ═══
-- ============================================================================
-- Mission Sainik 2027 — question-setting tasks for the 20 Pre Mock Tests
-- ============================================================================
-- One row per section of each test (kind='test', test_no 1-20, subject, setter) and one row per
-- practice-bank set (kind='practice', test_no 0). The schedule, panel and allotment rules live in
-- src/missionSainikData.js; this table only stores progress:
--   status        Pending → Submitted (setter) → Verified (verifier) → Approved (admin)
--   *_on          the date each step happened
--   question_count  questions in that section / set (25 per test section)
-- The module's "Create allotment" button inserts the 133 starting rows (ignores rows that exist).
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.mission_sainik_tasks (
  id              bigserial primary key,
  kind            text    not null check (kind in ('test', 'practice')),
  test_no         integer not null default 0,
  subject         text    not null,
  setter          text    not null,
  verifier        text,
  question_count  integer,
  status          text    not null default 'Pending'
                    check (status in ('Pending', 'Submitted', 'Verified', 'Approved')),
  submitted_on    date,
  verified_on     date,
  approved_on     date,
  remarks         text,
  updated_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint mission_sainik_tasks_uq unique (kind, test_no, subject, setter)
);

create index if not exists mission_sainik_tasks_setter_idx on public.mission_sainik_tasks (setter);
create index if not exists mission_sainik_tasks_status_idx on public.mission_sainik_tasks (status);

alter table public.mission_sainik_tasks enable row level security;

drop policy if exists mission_sainik_tasks_all on public.mission_sainik_tasks;
create policy mission_sainik_tasks_all on public.mission_sainik_tasks
  for all to anon, authenticated using (true) with check (true);

-- ═══ 20261202_mission_sainik_materials.sql ═══
-- Mission Sainik 2027 — study material uploaded by teachers (files or links).
-- Files go to the existing private 'teacher-materials' bucket under mission-sainik/; this table stores the path.
-- Safe to run more than once.
create table if not exists public.mission_sainik_materials (
  id          bigserial primary key,
  title       text not null,
  subject     text,                 -- SUBJECTS label, or null for general
  test_no     integer not null default 0,  -- 0 = not tied to one test
  link_url    text,                 -- external link (Drive, YouTube…)
  file_path   text,                 -- storage path in 'teacher-materials'
  file_name   text,
  note        text,
  uploaded_by text,
  created_at  timestamptz not null default now(),
  constraint mission_sainik_materials_src check (link_url is not null or file_path is not null)
);
create index if not exists mission_sainik_materials_subject_idx on public.mission_sainik_materials (subject);
alter table public.mission_sainik_materials enable row level security;
drop policy if exists mission_sainik_materials_all on public.mission_sainik_materials;
create policy mission_sainik_materials_all on public.mission_sainik_materials
  for all to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('teacher-materials', 'teacher-materials', false)
  on conflict (id) do nothing;
drop policy if exists teacher_materials_rw on storage.objects;
create policy teacher_materials_rw on storage.objects for all to authenticated
  using (bucket_id = 'teacher-materials') with check (bucket_id = 'teacher-materials');

-- ═══ 20261203_mission_sainik_syllabus_marks.sql ═══
-- Mission Sainik 2027 — syllabus plan (Annexure-III) and Daily Class Test marks tracker (Annexure-V).
-- Open to all staff, like the rest of the module. Safe to run more than once.
create table if not exists public.mission_sainik_syllabus (
  id         bigserial primary key,
  test_no    integer not null,
  subject    text not null,
  chapter    text,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint mission_sainik_syllabus_uq unique (test_no, subject)
);
create table if not exists public.mission_sainik_marks (
  id          bigserial primary key,
  test_no     integer not null,
  batch       text not null default '',
  maths       numeric,   -- /60
  reasoning   numeric,   -- /20
  grammar     numeric,   -- /20
  gk          numeric,   -- /20
  entered_by  text,
  created_at  timestamptz not null default now(),
  constraint mission_sainik_marks_uq unique (test_no, batch)
);
alter table public.mission_sainik_syllabus enable row level security;
alter table public.mission_sainik_marks enable row level security;
drop policy if exists mission_sainik_syllabus_all on public.mission_sainik_syllabus;
create policy mission_sainik_syllabus_all on public.mission_sainik_syllabus for all to anon, authenticated using (true) with check (true);
drop policy if exists mission_sainik_marks_all on public.mission_sainik_marks;
create policy mission_sainik_marks_all on public.mission_sainik_marks for all to anon, authenticated using (true) with check (true);

-- ═══ 20261204_mission_sainik_difficulty.sql ═══
-- Mission Sainik 2027 — difficulty mix per submitted section (notice asks for ~40% easy / 40% medium / 20% hard).
alter table public.mission_sainik_tasks add column if not exists easy_count   integer;
alter table public.mission_sainik_tasks add column if not exists medium_count integer;
alter table public.mission_sainik_tasks add column if not exists hard_count   integer;

-- ═══ 20261205_mission_sainik_material_text.sql ═══
-- Mission Sainik 2027 — typed study material (stored in the portal, printable). Adds a body column.
alter table public.mission_sainik_materials add column if not exists body text;
alter table public.mission_sainik_materials drop constraint if exists mission_sainik_materials_src;
alter table public.mission_sainik_materials add constraint mission_sainik_materials_src
  check (link_url is not null or file_path is not null or body is not null);

-- ═══ 20261206_mission_sainik_questions.sql ═══
-- Mission Sainik 2027 — question bank behind the Pre Mock Test Builder and Mega Mock Test Builder.
-- Teachers upload questions per series/test/section; the builder assembles the paper and answer key.
-- Safe to run more than once.
create table if not exists public.mission_sainik_questions (
  id           bigserial primary key,
  series       text not null check (series in ('pre', 'mega')),
  test_no      integer not null,
  section      text not null,
  question     text not null,
  option_a     text not null,
  option_b     text not null,
  option_c     text not null,
  option_d     text not null,
  answer       text not null check (answer in ('A', 'B', 'C', 'D')),
  explanation  text,
  topic        text,
  difficulty   text check (difficulty in ('Easy', 'Medium', 'Hard')),
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists mission_sainik_questions_idx on public.mission_sainik_questions (series, test_no, section);
alter table public.mission_sainik_questions enable row level security;
drop policy if exists mission_sainik_questions_all on public.mission_sainik_questions;
create policy mission_sainik_questions_all on public.mission_sainik_questions for all to authenticated using (true) with check (true);

-- ═══ 20261207_mission_sainik_questions_daily_practice.sql ═══
-- Mission Sainik 2027 — let the question bank also hold Daily Class Test ('daily') and Practice Bank ('practice') questions.
alter table public.mission_sainik_questions drop constraint if exists mission_sainik_questions_series_check;
alter table public.mission_sainik_questions add constraint mission_sainik_questions_series_check
  check (series in ('pre', 'mega', 'daily', 'practice'));

-- ═══ 20261208_mission_sainik_lockdown.sql ═══
-- Mission Sainik 2027 — lock the module's data to STAFF only.
-- Earlier migrations (20261201-20261207) used `using (true)`, some `to anon`, so signed-out visitors and parent / student
-- logins could read and write tasks, materials and (worse) the question bank with answers. Run this AFTER those files.
-- Requires public.qbank_is_staff() from 20260925_qbank_rls.sql. Safe to run more than once.

do $$
declare t text;
begin
  foreach t in array array['mission_sainik_tasks', 'mission_sainik_materials', 'mission_sainik_syllabus', 'mission_sainik_marks', 'mission_sainik_questions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff())', t || '_staff', t);
  end loop;
end $$;

-- The shared private bucket: staff only (it was open to every authenticated account, parents and students included).
drop policy if exists teacher_materials_rw on storage.objects;
drop policy if exists teacher_materials_staff on storage.objects;
create policy teacher_materials_staff on storage.objects for all to authenticated
  using (bucket_id = 'teacher-materials' and public.qbank_is_staff())
  with check (bucket_id = 'teacher-materials' and public.qbank_is_staff());

-- ═══ 20261209_mission_sainik_launch.sql ═══
-- Mission Sainik 2027 — launch hardening: admin settings, append-only audit log, soft delete + verification for questions.
-- Run AFTER 20261201-20261208. Requires public.qbank_is_staff() / qbank_is_admin() (20260925_qbank_rls.sql). Safe to re-run.

-- 1. Admin-editable settings (deadline, order no/date, exam date, embargo switch)
create table if not exists public.mission_sainik_settings (
  key text primary key, value text, updated_by text, updated_at timestamptz not null default now()
);

-- 2. Append-only audit log: staff can add and read entries; nobody can edit or delete them
create table if not exists public.mission_sainik_audit (
  id bigserial primary key, at timestamptz not null default now(),
  actor text, action text not null, ref text, detail jsonb
);
create index if not exists mission_sainik_audit_at_idx on public.mission_sainik_audit (at desc);

-- 3. Questions: soft delete (recycle bin) + per-section verification
alter table public.mission_sainik_questions add column if not exists deleted_at timestamptz;
alter table public.mission_sainik_questions add column if not exists deleted_by text;
create table if not exists public.mission_sainik_signoffs (
  id bigserial primary key, series text not null, test_no integer not null, section text not null,
  verified_by text not null, verified_at timestamptz not null default now(),
  constraint mission_sainik_signoffs_uq unique (series, test_no, section)
);

alter table public.mission_sainik_settings enable row level security;
alter table public.mission_sainik_audit    enable row level security;
alter table public.mission_sainik_signoffs enable row level security;

drop policy if exists mission_sainik_settings_staff on public.mission_sainik_settings;
create policy mission_sainik_settings_staff on public.mission_sainik_settings for select to authenticated using (public.qbank_is_staff());
drop policy if exists mission_sainik_settings_admin on public.mission_sainik_settings;
create policy mission_sainik_settings_admin on public.mission_sainik_settings for all to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());

drop policy if exists mission_sainik_audit_read on public.mission_sainik_audit;
create policy mission_sainik_audit_read on public.mission_sainik_audit for select to authenticated using (public.qbank_is_staff());
drop policy if exists mission_sainik_audit_add on public.mission_sainik_audit;
create policy mission_sainik_audit_add on public.mission_sainik_audit for insert to authenticated with check (public.qbank_is_staff());

drop policy if exists mission_sainik_signoffs_staff on public.mission_sainik_signoffs;
create policy mission_sainik_signoffs_staff on public.mission_sainik_signoffs for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());

-- ═══ 20261210_mission_sainik_panel.sql ═══
-- Mission Sainik 2027 — editable Question Setting Panel (add / edit / delete members from the Panel tab).
-- When this table has rows it replaces the panel written in the code; when empty the code's panel is used.
-- Run after 20261209. Requires public.qbank_is_staff() (20260925_qbank_rls.sql). Safe to re-run.
create table if not exists public.mission_sainik_panel (
  id          bigserial primary key,
  subject_key text not null,                      -- maths | reasoning | science | gk | grammar | vocab
  name        text not null,                      -- as in the notice, e.g. Sumanta
  role        text not null default 'setter' check (role in ('setter', 'verifier', 'assistant')),
  created_by  text,
  created_at  timestamptz not null default now(),
  constraint mission_sainik_panel_uq unique (subject_key, name, role)
);
alter table public.mission_sainik_panel enable row level security;
drop policy if exists mission_sainik_panel_staff on public.mission_sainik_panel;
create policy mission_sainik_panel_staff on public.mission_sainik_panel for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());

-- ═══ 20261211_mission_sainik_figures.sql ═══
-- Mission Sainik 2027 — reading passages and figures for the exam-book paper layout.
-- passage: shared text printed once above a run of questions. image_data: a small figure (data: URL, resized in the browser).
-- Run after 20261210. Safe to re-run.
alter table public.mission_sainik_questions add column if not exists passage text;
alter table public.mission_sainik_questions add column if not exists image_data text;

-- ═══ 20261212_mission_sainik_paper_cfg.sql ═══
-- Mission Sainik 2027 — saved paper settings (columns, fonts, section titles / order) per builder. Run after 20261211.
create table if not exists public.mission_sainik_paper_cfg (
  series      text primary key,            -- pre | mega | daily | practice
  config      jsonb not null,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
alter table public.mission_sainik_paper_cfg enable row level security;
drop policy if exists mission_sainik_paper_cfg_staff on public.mission_sainik_paper_cfg;
create policy mission_sainik_paper_cfg_staff on public.mission_sainik_paper_cfg for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());

-- ═══ 20261213_mission_sainik_reviews.sql ═══
-- Mission Sainik 2027 — review notes on a builder section ("request changes" thread between verifier and setter).
-- Run after 20261212. Requires public.qbank_is_staff() (20260925_qbank_rls.sql). Safe to re-run.
create table if not exists public.mission_sainik_reviews (
  id           bigserial primary key,
  series       text not null,
  test_no      integer not null,
  section      text not null,
  note         text not null,
  author       text,
  status       text not null default 'open' check (status in ('open', 'resolved')),
  created_at   timestamptz not null default now(),
  resolved_by  text,
  resolved_at  timestamptz
);
create index if not exists mission_sainik_reviews_idx on public.mission_sainik_reviews (series, test_no, section);
alter table public.mission_sainik_reviews enable row level security;
drop policy if exists mission_sainik_reviews_staff on public.mission_sainik_reviews;
create policy mission_sainik_reviews_staff on public.mission_sainik_reviews for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());

-- ═══ 20261214_mission_sainik_tighten.sql ═══
-- Mission Sainik 2027 — tighten what staff can do (server-side, not just in the browser).
-- Run AFTER 20261213. Requires public.qbank_is_staff() / qbank_is_admin() (20260925_qbank_rls.sql). Safe to re-run.
-- Restrictive policies are AND-ed with the existing ones, so this can only REMOVE access, never add it.
-- Admins are unaffected. Service-role scripts bypass RLS as before.

-- 1. The question-setting panel decides who may upload to which section: only admins may change it.
--    (Before, any staff member could add themselves as a setter of any subject.)
drop policy if exists mission_sainik_panel_admin_write on public.mission_sainik_panel;
create policy mission_sainik_panel_admin_write on public.mission_sainik_panel as restrictive for insert to authenticated with check (public.qbank_is_admin());
drop policy if exists mission_sainik_panel_admin_upd on public.mission_sainik_panel;
create policy mission_sainik_panel_admin_upd on public.mission_sainik_panel as restrictive for update to authenticated using (public.qbank_is_admin()) with check (public.qbank_is_admin());
drop policy if exists mission_sainik_panel_admin_del on public.mission_sainik_panel;
create policy mission_sainik_panel_admin_del on public.mission_sainik_panel as restrictive for delete to authenticated using (public.qbank_is_admin());

-- 2. Paper layout (columns, fonts, section titles) is low-harm and easy to reset, so every staff member may change it.
--    Branding (institute name, logo, watermark, cover page) is printed on every paper: only admins may change that part.
--    For non-admins the saved branding is kept exactly as it was, whatever they send.
create or replace function public.mission_sainik_keep_brand()
returns trigger language plpgsql as $$
begin
  if public.qbank_is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.config := new.config - 'brand';
  elsif old.config ? 'brand' then
    new.config := jsonb_set(new.config, '{brand}', old.config -> 'brand');
  else
    new.config := new.config - 'brand';
  end if;
  return new;
end $$;
drop trigger if exists mission_sainik_paper_cfg_keep_brand on public.mission_sainik_paper_cfg;
create trigger mission_sainik_paper_cfg_keep_brand before insert or update on public.mission_sainik_paper_cfg
  for each row execute function public.mission_sainik_keep_brand();
drop policy if exists mission_sainik_paper_cfg_admin_write on public.mission_sainik_paper_cfg;
drop policy if exists mission_sainik_paper_cfg_admin_upd on public.mission_sainik_paper_cfg;
drop policy if exists mission_sainik_paper_cfg_admin_del on public.mission_sainik_paper_cfg;
-- Resetting a paper type's layout is a delete: admins only (staff can still "Reset to default" in the app, which saves defaults).
create policy mission_sainik_paper_cfg_admin_del on public.mission_sainik_paper_cfg as restrictive for delete to authenticated using (public.qbank_is_admin());

-- 3. Questions: staff soft-delete (recycle bin, an UPDATE); permanent delete is admin-only.
drop policy if exists mission_sainik_questions_admin_del on public.mission_sainik_questions;
create policy mission_sainik_questions_admin_del on public.mission_sainik_questions as restrictive for delete to authenticated using (public.qbank_is_admin());

-- 4. A locked paper cannot be changed by non-admins, even by calling the API directly.
create or replace function public.mission_sainik_guard_locked()
returns trigger language plpgsql as $$
declare keys text[] := '{}'; locked boolean;
begin
  if public.qbank_is_admin() then
    if tg_op = 'DELETE' then return old; end if; return new;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then keys := keys || ('lock:' || old.series || ':' || old.test_no); end if;
  if tg_op in ('INSERT', 'UPDATE') then keys := keys || ('lock:' || new.series || ':' || new.test_no); end if;
  select exists (select 1 from public.mission_sainik_settings s where s.value = 'on' and s.key = any (keys)) into locked;
  if locked then raise exception 'This paper is locked by an admin.' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists mission_sainik_questions_guard_locked on public.mission_sainik_questions;
create trigger mission_sainik_questions_guard_locked before insert or update or delete on public.mission_sainik_questions
  for each row execute function public.mission_sainik_guard_locked();

-- 5. Nobody (admins included) can rewrite who uploaded a question or when.
create or replace function public.mission_sainik_freeze_origin()
returns trigger language plpgsql as $$
begin
  new.uploaded_by := old.uploaded_by; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists mission_sainik_questions_freeze_origin on public.mission_sainik_questions;
create trigger mission_sainik_questions_freeze_origin before update on public.mission_sainik_questions
  for each row execute function public.mission_sainik_freeze_origin();

-- ═══ 20261215_mission_sainik_panel_quota.sql ═══
-- Mission Sainik 2027 — number of questions each panel member must upload. Run after 20261214. Safe to re-run.
alter table public.mission_sainik_panel add column if not exists question_quota integer check (question_quota is null or question_quota >= 0);
