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

-- 2. Paper settings, branding and watermark are printed on every paper: only admins may change them.
drop policy if exists mission_sainik_paper_cfg_admin_write on public.mission_sainik_paper_cfg;
create policy mission_sainik_paper_cfg_admin_write on public.mission_sainik_paper_cfg as restrictive for insert to authenticated with check (public.qbank_is_admin());
drop policy if exists mission_sainik_paper_cfg_admin_upd on public.mission_sainik_paper_cfg;
create policy mission_sainik_paper_cfg_admin_upd on public.mission_sainik_paper_cfg as restrictive for update to authenticated using (public.qbank_is_admin()) with check (public.qbank_is_admin());
drop policy if exists mission_sainik_paper_cfg_admin_del on public.mission_sainik_paper_cfg;
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
