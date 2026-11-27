-- ============================================================================
-- 20261130_fee_concession_approval.sql — Concession / Special Fee: a lower fee
-- for a student in the SAME course (sibling, staff ward, scholarship, merit,
-- hardship …), with a staff request, admin approval and a printable form.
--
-- What the app already had (kept): fee_concession_register (20261009). Active
-- entries already lower each month's fee in every ledger and the dues engine,
-- and the student's ledger shows them as a separate "Standing concession" line
-- (billed stays the full fee). Only admins could add entries; any admin could
-- delete or edit them, and the audit entry was written by the browser.
--
-- What this adds:
--   1. Status 'pending' (waiting for approval) and 'rejected'. A pending entry
--      never lowers a fee — the app only applies status = 'active'.
--   2. Basis 'fixed_fee': the student pays a special fee of ₹X a month instead
--      of the standard rate (for one fee head: course or flat). ₹0 is allowed
--      only through admin approval (see 5).
--   3. Form number FCR-YYYY-NNNN on every entry (old ones get a number too),
--      the course / batch / hostel type at the time, the fee before/after, who
--      requested, who decided and when (login e-mail stamped by the database).
--   4. Any staff member may REQUEST (insert with status 'pending'). Only an
--      admin may approve, reject, end or cancel.
--   5. Guards, enforced by the database for everyone:
--      • entries are never deleted;
--      • an entry's details (student, amount, basis, start month, reason …)
--        can't be edited — cancel it and request a new one;
--      • status can only move pending → active / rejected, active → revoked /
--        expired; nothing comes back from rejected / revoked / expired;
--      • an approved entry can be ENDED by setting (or bringing forward) its
--        end month; it can't be extended;
--      • only an admin can make an entry active, so a full waiver (₹0 fee)
--        always has an admin's approval and a decision note.
--   6. Every insert and change is written to audit_log by the database.
--
-- Needs: 20260925_qbank_rls.sql, 20261009_fee_dayclose_refunds_register.sql.
-- Independent of 20261127 / 20261128 (fee loophole fixes) and 20261129
-- (course / mode change) — run before or after them.
-- Safe to run more than once. No existing entry is deleted or changed except
-- that each gets a form number.
-- ============================================================================

do $$
begin
  if to_regclass('public.fee_concession_register') is null then
    raise exception 'Run 20261009_fee_dayclose_refunds_register.sql first.';
  end if;
  if to_regprocedure('public.qbank_is_admin()') is null or to_regprocedure('public.qbank_is_staff()') is null then
    raise exception 'Run 20260925_qbank_rls.sql first.';
  end if;
end $$;

-- ── 1 + 2. wider status / basis, ₹0 allowed only for a special fee ──────────
alter table public.fee_concession_register drop constraint if exists fee_concession_register_status_check;
alter table public.fee_concession_register drop constraint if exists fee_concession_register_basis_check;
alter table public.fee_concession_register drop constraint if exists fee_concession_register_value_check;
alter table public.fee_concession_register drop constraint if exists fcr_status_ok;
alter table public.fee_concession_register drop constraint if exists fcr_basis_ok;
alter table public.fee_concession_register drop constraint if exists fcr_value_ok;
alter table public.fee_concession_register drop constraint if exists fcr_fixed_fee_one_head;
alter table public.fee_concession_register drop constraint if exists fcr_valid_range;
alter table public.fee_concession_register
  add constraint fcr_status_ok check (status in ('pending', 'active', 'rejected', 'expired', 'revoked')),
  add constraint fcr_basis_ok  check (basis in ('fixed_per_month', 'percent', 'one_time', 'fixed_fee')),
  add constraint fcr_value_ok  check (value >= 0 and (value > 0 or basis = 'fixed_fee') and (basis <> 'percent' or value <= 100)) not valid,
  add constraint fcr_fixed_fee_one_head check (basis <> 'fixed_fee' or applies_to in ('course', 'flat')),
  add constraint fcr_valid_range check (valid_to is null or valid_to >= valid_from) not valid;

-- ── 3. form number, snapshot and decision columns ───────────────────────────
create sequence if not exists public.fee_concession_form_seq;
alter table public.fee_concession_register
  add column if not exists form_no text default ('FCR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.fee_concession_form_seq')::text, 4, '0'));
create unique index if not exists fee_concession_register_form_no_idx on public.fee_concession_register (form_no);
alter table public.fee_concession_register
  add column if not exists course          text,
  add column if not exists batch           text,
  add column if not exists hostel_type     text,
  add column if not exists fee_impact      jsonb,        -- the before / after shown on the form
  add column if not exists requested_by    text,
  add column if not exists requester_email text,
  add column if not exists decided_by      text,
  add column if not exists decider_email   text,
  add column if not exists decided_at      timestamptz,
  add column if not exists decision_note   text,
  add column if not exists revoked_by      text,
  add column if not exists revoker_email   text,
  add column if not exists revoked_at      timestamptz,
  add column if not exists ended_by        text,
  add column if not exists ended_at        timestamptz;
alter table public.fee_concession_register alter column status set default 'pending';
create index if not exists fee_concession_register_status_created_idx on public.fee_concession_register (status, created_at desc);

-- ── 4. who may write ────────────────────────────────────────────────────────
drop policy if exists fee_concession_register_insert on public.fee_concession_register;
drop policy if exists fee_concession_register_update on public.fee_concession_register;
drop policy if exists fee_concession_register_delete on public.fee_concession_register;
-- Staff may only ask; an admin may add an approved entry straight away.
create policy fee_concession_register_insert on public.fee_concession_register for insert to authenticated
  with check (public.qbank_is_admin() or (public.qbank_is_staff() and status = 'pending'));
create policy fee_concession_register_update on public.fee_concession_register for update to authenticated
  using (public.qbank_is_admin()) with check (public.qbank_is_admin());
-- (no delete policy: entries are never deleted)

-- ── audit helper (audit_log column types differ between installs) ───────────
create or replace function public.fcr_audit(p_action text, p_by text, p_target text, p_old jsonb, p_new jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.audit_log') is null then return; end if;
  execute format(
    'insert into public.audit_log (action, changed_by, target_id, old_values, new_values, created_at) values (%L, %L, %L, %L, %L, %L)',
    p_action, p_by, p_target, p_old::text, p_new::text, now());
end $$;
revoke all on function public.fcr_audit(text, text, text, jsonb, jsonb) from public;

create or replace function public.fcr_email()
returns text
language sql
stable
as $$ select coalesce(nullif(lower(auth.jwt() ->> 'email'), ''), 'system (SQL editor / service)') $$;

-- ── 5. guards ───────────────────────────────────────────────────────────────
create or replace function public.fcr_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := public.qbank_is_admin();
  full_waiver boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'Concession entries are never deleted. Cancel (revoke) it instead.';
  end if;

  if tg_op = 'INSERT' then
    if length(btrim(coalesce(new.reason, ''))) < 3 then
      raise exception 'Give a reason for the concession.';
    end if;
    new.requester_email := public.fcr_email();
    new.requested_by := coalesce(nullif(btrim(new.requested_by), ''), new.approved_by, new.requester_email);
    new.created_at := now();
    new.revoked_by := null; new.revoker_email := null; new.revoked_at := null; new.revoked_reason := null;
    new.ended_by := null; new.ended_at := null;
    if new.status = 'pending' then
      new.decided_by := null; new.decider_email := null; new.decided_at := null; new.decision_note := null; new.approved_by := null;
    elsif new.status = 'active' then
      -- An admin adding it directly is its own approval (the policy already
      -- stops anyone else, but SQL-editor / service inserts land here too).
      if not is_admin and auth.uid() is not null then
        raise exception 'Only an admin can approve a concession. Save it as a request.';
      end if;
      new.decided_by := coalesce(nullif(btrim(new.decided_by), ''), new.approved_by, public.fcr_email());
      new.approved_by := coalesce(new.approved_by, new.decided_by);
      new.decider_email := public.fcr_email();
      new.decided_at := now();
    else
      raise exception 'A new concession must be pending or approved (active).';
    end if;
    return new;
  end if;

  -- UPDATE
  if not is_admin and auth.uid() is not null then
    raise exception 'Only an admin can approve, end or cancel a concession.';
  end if;
  if row(new.gcc, new.student_name, new.kind, new.basis, new.value, new.applies_to, new.valid_from, new.reason, new.form_no, new.created_at,
         new.requested_by, new.requester_email, new.course, new.batch, new.hostel_type, new.fee_impact)
     is distinct from
     row(old.gcc, old.student_name, old.kind, old.basis, old.value, old.applies_to, old.valid_from, old.reason, old.form_no, old.created_at,
         old.requested_by, old.requester_email, old.course, old.batch, old.hostel_type, old.fee_impact) then
    raise exception 'A concession''s details can''t be edited. Cancel it and request a new one.';
  end if;

  if new.status is distinct from old.status then
    if not ((old.status = 'pending' and new.status in ('active', 'rejected'))
         or (old.status = 'active'  and new.status in ('revoked', 'expired'))) then
      raise exception 'This concession is % and can''t be changed to %.', old.status, new.status;
    end if;
    if old.status = 'pending' then
      full_waiver := (new.basis = 'percent' and new.value >= 100) or (new.basis = 'fixed_fee' and new.value = 0);
      if new.status = 'rejected' and length(btrim(coalesce(new.decision_note, ''))) < 3 then
        raise exception 'Give a reason for rejecting it.';
      end if;
      if new.status = 'active' and full_waiver and length(btrim(coalesce(new.decision_note, ''))) < 5 then
        raise exception 'This makes the fee ₹0 — write an approval note (5+ characters).';
      end if;
      new.decided_by := coalesce(nullif(btrim(new.decided_by), ''), public.fcr_email());
      new.decider_email := public.fcr_email();
      new.decided_at := now();
      if new.status = 'active' then new.approved_by := new.decided_by; end if;
    elsif new.status = 'revoked' then
      if length(btrim(coalesce(new.revoked_reason, ''))) < 3 then
        raise exception 'Give a reason for cancelling it.';
      end if;
      new.revoked_by := coalesce(nullif(btrim(new.revoked_by), ''), public.fcr_email());
      new.revoker_email := public.fcr_email();
      new.revoked_at := now();
    end if;
  else
    -- same status: the decision stamps can't be rewritten
    if row(new.decided_by, new.decider_email, new.decided_at, new.decision_note, new.approved_by, new.revoked_by, new.revoker_email, new.revoked_at, new.revoked_reason)
       is distinct from
       row(old.decided_by, old.decider_email, old.decided_at, old.decision_note, old.approved_by, old.revoked_by, old.revoker_email, old.revoked_at, old.revoked_reason) then
      raise exception 'The approval record of a concession can''t be edited.';
    end if;
  end if;

  if new.valid_to is distinct from old.valid_to then
    if old.status <> 'active' or new.status <> 'active' then
      raise exception 'Only an approved, active concession can be given an end month.';
    end if;
    if new.valid_to is null or new.valid_to < new.valid_from then
      raise exception 'The end month must be on or after the start month.';
    end if;
    if old.valid_to is not null and new.valid_to > old.valid_to then
      raise exception 'A concession can''t be extended. Request a new one from the next month.';
    end if;
    new.ended_by := coalesce(nullif(btrim(new.ended_by), ''), public.fcr_email());
    new.ended_at := now();
  elsif new.ended_by is distinct from old.ended_by or new.ended_at is distinct from old.ended_at then
    raise exception 'The end record of a concession can''t be edited.';
  end if;
  return new;
end $$;
revoke all on function public.fcr_guard() from public;

drop trigger if exists fcr_guard on public.fee_concession_register;
create trigger fcr_guard before insert or update or delete on public.fee_concession_register
  for each row execute function public.fcr_guard();

-- ── 6. audit, written by the database ───────────────────────────────────────
create or replace function public.fcr_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare act text;
begin
  if tg_op = 'INSERT' then
    act := case when new.status = 'active' then 'fee_concession_added_approved' else 'fee_concession_requested' end;
    perform public.fcr_audit(act, public.fcr_email(), new.gcc, null, to_jsonb(new) || jsonb_build_object('source', 'database'));
  else
    act := case
      when new.status is distinct from old.status then 'fee_concession_' || case new.status when 'active' then 'approved' else new.status end
      when new.valid_to is distinct from old.valid_to then 'fee_concession_ended'
      else 'fee_concession_updated' end;
    perform public.fcr_audit(act, public.fcr_email(), new.gcc, to_jsonb(old), to_jsonb(new) || jsonb_build_object('source', 'database'));
  end if;
  return null;
end $$;
revoke all on function public.fcr_log() from public;

drop trigger if exists fcr_log on public.fee_concession_register;
create trigger fcr_log after insert or update on public.fee_concession_register
  for each row execute function public.fcr_log();

notify pgrst, 'reload schema';
