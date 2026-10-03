-- ============================================================================
-- Fee integrity guards, part 2
-- ============================================================================
-- Follows 20261006_fee_integrity_guards.sql. Adds:
--   1. Sole-admin exception: with only ONE admin account, that admin may approve
--      their own large concession (otherwise it could never be approved).
--   2. Revert / delete requests (fee_action_requests): only admins may approve,
--      and the approver must differ from the requester (unless self-approval is
--      flagged AND there is only one admin). Enforced in the database, so a
--      tampered browser cannot skip the "second admin" rule.
--   3. Month lock: non-admins cannot post or change fee rows dated in a month
--      that Accounts has closed (month_locks). Admins can still correct.
-- REQUIRES 20260925_qbank_rls.sql and 20261006_fee_integrity_guards.sql.
-- Safe to run more than once. The SQL editor / service role is exempt.
-- ============================================================================

create or replace function public.fee_admin_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.portal_users where role in ('Admin', 'Administrator', 'Co-Admin')
$$;
grant execute on function public.fee_admin_count() to anon, authenticated;

-- 1. concession validation: add the sole-admin exception
create or replace function public.fee_concession_validate()
returns trigger
language plpgsql
as $$
begin
  if not public.fee_is_app_caller() then return new; end if;
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
     and lower(trim(coalesce(new.decided_by, ''))) = lower(trim(coalesce(new.requested_by, new.collected_by, '')))
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and public.fee_admin_count() > 1 then
    raise exception 'A concession above ₹% needs a different admin to approve it', public.fee_self_approve_limit();
  end if;
  return new;
end $$;

-- 2. dual control on revert / delete requests
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
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved', 'executed', 'done') then
    if not public.qbank_is_admin() then
      raise exception 'Only an admin can approve a revert/delete request';
    end if;
    if coalesce(new.approved_by_id, '') = coalesce(old.requested_by_id, '')
       and not (coalesce(new.self_approved, false) and public.fee_admin_count() <= 1) then
      raise exception 'A different admin must approve this request';
    end if;
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.fee_action_requests') is not null then
    execute 'drop trigger if exists fee_action_request_guard on public.fee_action_requests';
    execute 'create trigger fee_action_request_guard before insert or update on public.fee_action_requests for each row execute function public.fee_action_request_guard()';
  end if;
exception when others then
  raise notice 'fee_action_request_guard not installed: %', sqlerrm;
end $$;

-- 3. closed-month lock for non-admin fee writes
create or replace function public.fee_month_lock_guard()
returns trigger
language plpgsql
as $$
declare
  m text := left(coalesce(new.pay_date::text, ''), 7);
begin
  if not public.fee_is_app_caller() or public.qbank_is_admin() or m = '' then return new; end if;
  if to_regclass('public.month_locks') is not null and exists (
       select 1 from public.month_locks where month = m and is_locked = true) then
    raise exception '% is closed in Accounts - ask an admin to post or correct this fee', m;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['adm_flat_fees', 'adm_course_fees', 'adm_fee_collections'] loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('drop trigger if exists fee_month_lock_guard on public.%I', t);
        execute format('create trigger fee_month_lock_guard before insert or update on public.%I for each row execute function public.fee_month_lock_guard()', t);
      exception when others then
        raise notice 'fee_month_lock_guard not installed on %: %', t, sqlerrm;
      end;
    end if;
  end loop;
end $$;
