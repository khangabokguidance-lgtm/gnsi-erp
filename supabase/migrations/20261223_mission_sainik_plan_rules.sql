-- Mission Sainik 2027 — keep the Pre Mock / Practice upload rules in the DATABASE as well as in the app.
-- Run after 20261203 (syllabus), 20261209 (settings) and 20261214; needs public.qbank_is_admin() from 20260925. Safe to run more than once.
--
-- The rules (the app already applies them; this stops anyone who calls the database API directly):
--   1. Pre Mock and Practice questions must be on the chapter that the Syllabus Plan gives that test and section.
--      Exactly ONE chapter per test and section: a plan cell listing several chapters (a;b) blocks uploads until it is fixed.
--   2. Pre Mock holds 25 questions per section (per teacher while "multiple sets" is on). Extras belong in the Practice bank.
--   3. The Syllabus Plan itself can be changed by admins only. Every rule above follows the plan, so whoever can edit the plan controls them.
--
-- OFF until an admin switches it on: Mission Sainik → Admin → "Enforce the syllabus plan and the 25 limit in the database".
-- (That saves the setting enforce_plan = 'on'.) Check the list below first, because switching it on does not change existing rows.
-- Scripts and the SQL editor (no signed-in user) are never blocked. Soft delete, restore, "in paper" picks and edits that keep the
-- question on the same test, section and chapter always work.
--
-- Not enforced here: WHO may upload. The database cannot tell which teacher is acting (all staff share the portal login), so
-- "only the section's setter can upload" is applied by the app only.

create or replace function public.mission_sainik_norm(t text) returns text language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g'))
$$;

-- Existing questions that break rule 1 — look at this BEFORE switching enforcement on. Empty = nothing to fix.
create or replace view public.mission_sainik_plan_violations with (security_invoker = true) as
  select q.id, q.series, q.test_no, q.section, q.topic, q.uploaded_by, s.chapter as planned
  from public.mission_sainik_questions q
  join public.mission_sainik_syllabus s on s.test_no = q.test_no and s.subject = q.section
  where q.series in ('pre', 'practice') and q.deleted_at is null and btrim(coalesce(s.chapter, '')) <> ''
    and (position(';' in s.chapter) > 0 or public.mission_sainik_norm(q.topic) <> public.mission_sainik_norm(s.chapter));

create or replace function public.mission_sainik_enforce_plan()
returns trigger language plpgsql as $$
declare plan text; per_teacher boolean; have integer; label text;
begin
  if auth.uid() is null then return new; end if;                                    -- scripts / SQL editor
  if new.series not in ('pre', 'practice') or new.deleted_at is not null then return new; end if;
  if not exists (select 1 from public.mission_sainik_settings where key = 'enforce_plan' and value = 'on') then return new; end if;
  if tg_op = 'UPDATE' and new.series = old.series and new.test_no = old.test_no and new.section = old.section
     and public.mission_sainik_norm(new.topic) = public.mission_sainik_norm(old.topic) then return new; end if;

  label := case new.series when 'pre' then 'PMT-' else 'Practice PMT-' end || lpad(new.test_no::text, 2, '0') || ' · ' || new.section;
  select s.chapter into plan from public.mission_sainik_syllabus s where s.test_no = new.test_no and s.subject = new.section;
  if plan is not null and btrim(plan) <> '' then
    if position(';' in plan) > 0 then
      raise exception '% lists more than one chapter in the Syllabus Plan. Every teacher must set the one same chapter, so an admin must keep just one.', label using errcode = '23514';
    end if;
    if public.mission_sainik_norm(new.topic) <> public.mission_sainik_norm(plan) then
      raise exception '% follows the Syllabus Plan: %. "%" is not planned for this test.', label, btrim(plan), coalesce(nullif(btrim(new.topic), ''), 'no chapter') using errcode = '23514';
    end if;
  end if;

  if new.series = 'pre' then
    -- Two people uploading to the same section at the same moment would both see "24 so far". Taking a lock per section makes them go one after the other.
    perform pg_advisory_xact_lock(hashtextextended('mission_sainik:' || new.series || ':' || new.test_no || ':' || new.section, 0));
    per_teacher := exists (select 1 from public.mission_sainik_settings where key = 'pre_versions' and value = 'on');
    select count(*) into have from public.mission_sainik_questions q
      where q.series = 'pre' and q.test_no = new.test_no and q.section = new.section and q.deleted_at is null
        and (not per_teacher or q.uploaded_by is not distinct from new.uploaded_by)
        and (tg_op = 'INSERT' or q.id <> new.id);
    if have >= 25 then
      raise exception '% already holds 25 questions. Extra questions go to the Practice bank.', label using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists mission_sainik_questions_enforce_plan on public.mission_sainik_questions;
create trigger mission_sainik_questions_enforce_plan before insert or update on public.mission_sainik_questions
  for each row execute function public.mission_sainik_enforce_plan();

-- Rule 3: with enforcement on, only admins may add, change or remove plan rows (staff could otherwise rewrite the plan and then upload "on plan").
create or replace function public.mission_sainik_guard_plan()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null
     and exists (select 1 from public.mission_sainik_settings where key = 'enforce_plan' and value = 'on')
     and not public.qbank_is_admin() then
    raise exception 'Only an admin can change the Syllabus Plan.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists mission_sainik_syllabus_guard_plan on public.mission_sainik_syllabus;
create trigger mission_sainik_syllabus_guard_plan before insert or update or delete on public.mission_sainik_syllabus
  for each row execute function public.mission_sainik_guard_plan();
