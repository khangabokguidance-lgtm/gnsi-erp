-- Mission Sainik 2027 — make "only the section's setter can upload" true in the DATABASE, not just in the app.
-- Run after 20261223 (and 20261218 co-setters, 20261210 panel). Safe to run more than once.
--
-- How the database knows who is acting: the signed-in Supabase Auth email maps back to the portal user (the same mapping qbank_actor_role()
-- uses), and from there to the staff profile whose FULL NAME the panel names are matched against — exactly what the app does.
--
-- OFF until an admin switches it on: Mission Sainik → Admin → "Enforce setters in the database" (setting enforce_setters = 'on').
-- Before switching it on: (1) load the panel into the database (Panel → "Load from notice" or add members), (2) check that every staff
-- member's portal user is linked to their staff profile, (3) check the allotment (tasks) has a setter for every test and section.
-- Scripts and the SQL editor (no signed-in user) are never blocked.
--
-- With it ON:
--   • "uploaded by" is stamped by the database from the signed-in person. It can no longer be typed in or changed.
--   • Pre Mock, Mock and Practice questions can be added only by the section's allotted setter. Admins cannot add questions.
--     (A Pre Mock setter may send overflow questions to the practice set of THEIR test, up to one practice set.)
--   • Moving a question into a section needs the same right.
--   • The allotment (who sets / verifies what) can be changed by admins only.
-- A panel name that matches more than one staff member identifies nobody (same rule as the app), so an admin must make it specific.

create or replace function public.mission_sainik_name_matches(who text, want text) returns boolean language sql immutable as $$
  select case when btrim(coalesce(want, '')) = '' then false else
    lower(btrim(want)) = any (regexp_split_to_array(lower(coalesce(who, '')), '[^a-z0-9]+'))
    or (length(btrim(want)) >= 4 and exists (
      select 1 from unnest(regexp_split_to_array(lower(coalesce(who, '')), '[^a-z0-9]+')) w where w like lower(btrim(want)) || '%'))
  end
$$;

create or replace function public.mission_sainik_flag(k text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mission_sainik_settings where key = k and value = 'on')
$$;

-- Who is acting: login name (what the app stamps as "uploaded by") and full staff name (what panel names are matched against).
create or replace function public.mission_sainik_actor()
returns table (login_name text, full_name text) language sql stable security definer set search_path = public as $$
  select pu.name::text, coalesce(nullif(btrim(sp.name), ''), pu.name)::text
  from public.portal_users pu left join public.staff_profiles sp on sp.id = pu.staff_profile_id
  where auth.uid() is not null
    and regexp_replace(lower(trim(pu.username)), '[^a-z0-9._-]', '_', 'g') || '.staff@guidancekhangabok.in' = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

-- A panel name counts only when it points at exactly ONE staff member.
create or replace function public.mission_sainik_token_is(who text, token text) returns boolean language sql stable security definer set search_path = public as $$
  select public.mission_sainik_name_matches(who, token)
     and (select count(*) from public.staff_profiles s where public.mission_sainik_name_matches(s.name, token)) <= 1
$$;

create or replace function public.mission_sainik_subject_keys(section text) returns text[] language sql immutable as $$
  select case section
    when 'Mathematics' then array['maths'] when 'Reasoning' then array['reasoning'] when 'Science' then array['science']
    when 'General Knowledge' then array['gk'] when 'English Grammar' then array['grammar'] when 'Vocabulary' then array['vocab']
    when 'Intelligence' then array['reasoning'] when 'Grammar + Vocabulary' then array['grammar', 'vocab'] when 'Science + GK' then array['science', 'gk']
    else array[]::text[] end
$$;

-- Is this person an allotted setter of that series / test / section?  true | false | null (null = the database has no data to decide: skip).
create or replace function public.mission_sainik_is_setter(p_series text, p_test integer, p_section text, p_who text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare tokens text[]; t text;
begin
  if p_series = 'pre' then
    select coalesce(array_agg(x), '{}') into tokens from (
      select btrim(unnest(array_prepend(k.setter, string_to_array(coalesce(k.co_setters, ''), ';')))) as x
      from public.mission_sainik_tasks k where k.kind = 'test' and k.test_no = p_test and k.subject = p_section) q where x <> '';
  elsif p_series in ('practice', 'mega') then
    if not exists (select 1 from public.mission_sainik_panel) then return null; end if;       -- panel not loaded: the app's built-in names apply, the database cannot see them
    select coalesce(array_agg(m.name), '{}') into tokens from public.mission_sainik_panel m
      where m.subject_key = any (public.mission_sainik_subject_keys(p_section)) and m.role = case p_series when 'practice' then 'assistant' else 'setter' end;
  else
    return null;
  end if;
  foreach t in array tokens loop
    if public.mission_sainik_token_is(p_who, t) then return true; end if;
  end loop;
  return false;
end $$;

create or replace function public.mission_sainik_enforce_setters()
returns trigger language plpgsql as $$
declare a record; ok boolean; subj text; quota integer; have integer; moved boolean;
begin
  if auth.uid() is null or not public.mission_sainik_flag('enforce_setters') then return new; end if;
  select * into a from public.mission_sainik_actor();
  if a.login_name is null then raise exception 'The database could not identify you, so the question was not saved. Ask an admin to check your portal login.' using errcode = '42501'; end if;

  if tg_op = 'UPDATE' then
    new.uploaded_by := old.uploaded_by;                                        -- the author can never be rewritten
    moved := new.series is distinct from old.series or new.test_no is distinct from old.test_no or new.section is distinct from old.section;
    if not moved or new.series not in ('pre', 'mega', 'practice') or public.qbank_is_admin() then return new; end if;   -- admins re-file; everyone else must be a setter of the target
  else
    if new.series not in ('pre', 'mega', 'practice') then new.uploaded_by := a.login_name; return new; end if;
  end if;

  if public.qbank_is_admin() then
    raise exception 'Only the section''s setter can add questions here; admins verify, edit, delete and lock.' using errcode = '42501';
  end if;
  ok := public.mission_sainik_is_setter(new.series, new.test_no, new.section, a.full_name);
  if ok is null then
    if tg_op = 'INSERT' then new.uploaded_by := a.login_name; end if;
    return new;
  end if;
  if not ok then
    -- A Pre Mock setter may send overflow to the practice set of their own test, up to one practice set.
    if new.series = 'practice' and public.mission_sainik_is_setter('pre', new.test_no, new.section, a.full_name) is true then
      subj := (public.mission_sainik_subject_keys(new.section))[1];
      select least(200, greatest(5, coalesce(nullif((select s.value from public.mission_sainik_settings s where s.key = 'practice_q:' || subj), '')::integer, 25))) into quota;
      select count(*) into have from public.mission_sainik_questions q
        where q.series = 'practice' and q.test_no = new.test_no and q.section = new.section and q.deleted_at is null
          and q.uploaded_by is not distinct from case when tg_op = 'INSERT' then a.login_name else new.uploaded_by end and (tg_op = 'INSERT' or q.id <> new.id);
      if have >= quota then
        raise exception 'The practice set for PMT-% · % takes at most % questions from you.', lpad(new.test_no::text, 2, '0'), new.section, quota using errcode = '23514';
      end if;
    else
      raise exception 'Only the section''s setter can add questions to % · %.', case new.series when 'pre' then 'PMT-' || lpad(new.test_no::text, 2, '0') when 'practice' then 'Practice PMT-' || lpad(new.test_no::text, 2, '0') else 'Mock ' || new.test_no end, new.section using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' then new.uploaded_by := a.login_name; end if;
  return new;
end $$;

drop trigger if exists mission_sainik_questions_a_enforce_setters on public.mission_sainik_questions;
create trigger mission_sainik_questions_a_enforce_setters before insert or update on public.mission_sainik_questions
  for each row execute function public.mission_sainik_enforce_setters();

-- The allotment: only admins decide who sets and who verifies. Teachers keep updating status, question count and remarks.
create or replace function public.mission_sainik_guard_allotment()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and public.mission_sainik_flag('enforce_setters') and not public.qbank_is_admin() then
    if tg_op in ('INSERT', 'DELETE') then raise exception 'Only an admin can change who sets and who verifies.' using errcode = '42501'; end if;
    if new.kind is distinct from old.kind or new.test_no is distinct from old.test_no or new.subject is distinct from old.subject
       or new.setter is distinct from old.setter or new.verifier is distinct from old.verifier or coalesce(new.co_setters, '') is distinct from coalesce(old.co_setters, '') then
      raise exception 'Only an admin can change who sets and who verifies.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists mission_sainik_tasks_guard_allotment on public.mission_sainik_tasks;
create trigger mission_sainik_tasks_guard_allotment before insert or update or delete on public.mission_sainik_tasks
  for each row execute function public.mission_sainik_guard_allotment();
