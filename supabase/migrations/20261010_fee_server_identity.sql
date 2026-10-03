-- ============================================================================
-- Fee approvals: use the SERVER's idea of who is acting
-- ============================================================================
-- Until now the "different admin must approve" rule compared names / ids that
-- the browser sends, so a tampered browser could claim to be someone else.
-- This stamps the real login (auth.uid()) on every revert/delete request and
-- every concession request when it is created, and on every approval when it
-- is decided, and compares THOSE. The stamped columns cannot be edited later
-- from the app.
--
-- REQUIRES 20261006 + 20261007 (it replaces two of their trigger functions).
-- Safe to run more than once. The SQL editor / service role is exempt.
-- ============================================================================

do $$
begin
  if to_regclass('public.fee_action_requests') is not null then
    execute 'alter table public.fee_action_requests add column if not exists requested_by_uid uuid';
    execute 'alter table public.fee_action_requests add column if not exists approved_by_uid uuid';
  end if;
  if to_regclass('public.fee_concessions') is not null then
    execute 'alter table public.fee_concessions add column if not exists requested_by_uid uuid';
    execute 'alter table public.fee_concessions add column if not exists decided_by_uid uuid';
  end if;
end $$;

create or replace function public.fee_action_request_guard()
returns trigger
language plpgsql
as $$
begin
  if not public.fee_is_app_caller() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'A new revert/delete request must start as pending';
    end if;
    new.requested_by_uid := auth.uid();
    new.approved_by_uid := null;
    return new;
  end if;
  -- stamped identity can never be edited from the app
  new.requested_by_uid := old.requested_by_uid;
  new.approved_by_uid := old.approved_by_uid;
  if new.status is distinct from old.status and new.status in ('approved', 'executed', 'done') then
    if not public.qbank_is_admin() then
      raise exception 'Only an admin can approve a revert/delete request';
    end if;
    new.approved_by_uid := auth.uid();
    if old.requested_by_uid is not null and old.requested_by_uid = auth.uid()
       and not (coalesce(new.self_approved, false) and public.fee_admin_count() <= 1) then
      raise exception 'A different admin must approve this request';
    end if;
    if old.requested_by_uid is null and coalesce(new.approved_by_id, '') = coalesce(old.requested_by_id, '')
       and not (coalesce(new.self_approved, false) and public.fee_admin_count() <= 1) then
      raise exception 'A different admin must approve this request';
    end if;
  end if;
  return new;
end $$;

create or replace function public.fee_concession_validate()
returns trigger
language plpgsql
as $$
declare
  same_person boolean;
begin
  if not public.fee_is_app_caller() then return new; end if;
  if tg_op = 'INSERT' then
    new.requested_by_uid := auth.uid();
    new.decided_by_uid := case when new.status = 'approved' then auth.uid() else null end;
  else
    new.requested_by_uid := old.requested_by_uid;
    new.decided_by_uid := case when new.status is distinct from old.status and new.status in ('approved', 'rejected') then auth.uid() else old.decided_by_uid end;
  end if;
  if new.collected_amount < 0 or new.standard_amount <= 0 or new.collected_amount >= new.standard_amount then
    raise exception 'Concession shortfall must be a positive part of the standard fee';
  end if;
  if abs(new.shortfall - (new.standard_amount - new.collected_amount)) > 0.01 then
    raise exception 'Concession shortfall does not match standard minus collected';
  end if;
  if new.reason = 'Other' and length(trim(coalesce(new.reason_note, ''))) < 3 then
    raise exception 'A concession with reason "Other" needs a written explanation';
  end if;
  if new.status = 'approved'
     and new.shortfall > public.fee_self_approve_limit()
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and public.fee_admin_count() > 1 then
    same_person := (new.requested_by_uid is not null and new.requested_by_uid = new.decided_by_uid)
                   or lower(trim(coalesce(new.decided_by, ''))) = lower(trim(coalesce(new.requested_by, new.collected_by, '')));
    if same_person then
      raise exception 'A concession above ₹% needs a different admin to approve it', public.fee_self_approve_limit();
    end if;
  end if;
  return new;
end $$;
