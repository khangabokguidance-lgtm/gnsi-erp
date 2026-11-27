-- ============================================================================
-- Fee loophole fixes, part 2 (review of 2026-11-27)
-- ============================================================================
--   H4  Login identity. The database used to decide who a login is (and its
--       role) from the e-mail alone, and anyone can create a Supabase login.
--       Someone who knew the username of a staff member who had never logged
--       in could create that e-mail first and act as them. Now each staff
--       row is tied to ONE login (portal_users.auth_user_id). The tie is made
--       only by staff_claim_auth(), which first checks the GNSI password
--       through the existing staff_link_auth(). Logins that already exist
--       today are tied once, below, so nobody is locked out.
--   M4  Refunds follow rules in the database. The amount cannot exceed what
--       the student has paid (less other refunds). The status must go
--       pending -> approved / rejected -> paid. "Paid" needs a reference.
--       Above Rs 2,000 a different admin must approve, unless there is only
--       one admin. Nobody can edit the amount after it is filed or delete a
--       refund (reject it instead).
--   M3  Back-dated payments. A non-admin can only record a payment dated
--       today or up to fee_controls.backdate_grace_days earlier (default 1),
--       Indian time. Admins can still record older dates, and the database
--       audit log from part 1 records who did it. Future dates are refused
--       for everyone.
--   M5  Receipt numbers. One receipt number can belong to only one student,
--       on all three fee tables. If two counters save the same number at the
--       same moment, the second save is refused instead of creating a
--       duplicate. (The app also adds a random suffix so this is very rare.)
--
-- REQUIRES 20260925_qbank_rls.sql, 20261006, 20261007, 20261009, 20261032 and
-- 20261127_fee_loophole_fixes.sql. Safe to run more than once. The SQL
-- editor / service role is exempt from the app-user rules, like before.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.fee_row_has_money(jsonb)') is null then
    raise exception 'Run 20261127_fee_loophole_fixes.sql first.';
  end if;
  if to_regprocedure('public.fee_admin_count()') is null then
    raise exception 'Run 20261007_fee_integrity_guards_2.sql first.';
  end if;
  if to_regclass('public.fee_controls') is null then
    raise exception 'Run 20261032_fee_accounting_controls.sql first.';
  end if;
  if to_regprocedure('public.staff_link_auth(text, text, boolean)') is null then
    raise exception 'public.staff_link_auth(text, text, boolean) was not found. Nothing was changed. Send this message to Claude.';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- H4. Tie each staff row to one proven login
-- ════════════════════════════════════════════════════════════════════════════
alter table public.portal_users add column if not exists auth_user_id uuid;
create unique index if not exists portal_users_auth_user_id_uidx
  on public.portal_users (auth_user_id) where auth_user_id is not null;

-- One-off: tie the logins that already exist today (first run only).
do $$
begin
  if not exists (select 1 from public.portal_users where auth_user_id is not null) then
    with m as (
      select distinct on (au.id) pu.ctid as row_ref, au.id as uid
        from public.portal_users pu
        join auth.users au
          on lower(au.email) = regexp_replace(lower(trim(pu.username)), '[^a-z0-9._-]', '_', 'g') || '.staff@guidancekhangabok.in'
       order by au.id, pu.username
    )
    update public.portal_users p set auth_user_id = m.uid from m where p.ctid = m.row_ref;
  end if;
end $$;

-- Called by the login screen right after signing in. Checks the GNSI password
-- with the existing staff_link_auth(), and only then ties this login to the
-- staff row. Returns true when the login is tied.
create or replace function public.staff_claim_auth(p_username text, p_password text, p_admin boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res text;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then return false; end if;
  -- the login must be this username's own login address
  if v_email <> regexp_replace(lower(trim(coalesce(p_username, ''))), '[^a-z0-9._-]', '_', 'g') || '.staff@guidancekhangabok.in' then
    return false;
  end if;
  execute 'select public.staff_link_auth($1, $2, $3)::text' into v_res using p_username, p_password, coalesce(p_admin, false);
  if v_res is null or lower(btrim(v_res)) in ('', 'false', 'f', 'null', '{}', '[]', '0') then
    return false;
  end if;
  -- password proven: this login belongs to this staff member
  update public.portal_users set auth_user_id = null
   where auth_user_id = v_uid and lower(trim(username)) <> lower(trim(p_username));
  update public.portal_users set auth_user_id = v_uid
   where lower(trim(username)) = lower(trim(p_username));
  return found;
end $$;
revoke all on function public.staff_claim_auth(text, text, boolean) from public;
grant execute on function public.staff_claim_auth(text, text, boolean) to authenticated;

-- Who is this login? Now by the tied login id, never by the e-mail alone.
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
    and pu.auth_user_id = auth.uid()
  limit 1
$$;
revoke all on function public.qbank_actor_role() from public;
grant execute on function public.qbank_actor_role() to anon, authenticated;

create or replace function public.fee_actor_label()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pu.username from public.portal_users pu where auth.uid() is not null and pu.auth_user_id = auth.uid() limit 1),
    nullif(auth.jwt() ->> 'email', ''),
    case when public.fee_is_app_caller() then 'unknown app user' else 'system (SQL editor / service)' end)
$$;
revoke all on function public.fee_actor_label() from public;

-- ════════════════════════════════════════════════════════════════════════════
-- M4. Refund rules
-- ════════════════════════════════════════════════════════════════════════════
alter table public.fee_refunds add column if not exists requested_by_uid uuid;
alter table public.fee_refunds add column if not exists decided_by_uid uuid;

-- Money a student has actually paid (not reverted), across the three fee tables.
create or replace function public.fee_net_paid(p_gcc text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(a), 0) from (
    select amount_paid::numeric as a from public.adm_fee_collections
     where ltrim(adm_app_id::text, '0') = ltrim(btrim(p_gcc), '0') and not coalesce(reverted, false) and coalesce(status, 'paid') = 'paid'
    union all
    select amount::numeric from public.adm_flat_fees
     where ltrim(adm_app_id::text, '0') = ltrim(btrim(p_gcc), '0') and not coalesce(reverted, false) and coalesce(paid, true)
    union all
    select amount_paid::numeric from public.adm_course_fees
     where ltrim(adm_app_id::text, '0') = ltrim(btrim(p_gcc), '0') and not coalesce(reverted, false)
  ) x
$$;
revoke all on function public.fee_net_paid(text) from public;
grant execute on function public.fee_net_paid(text) to authenticated;

create or replace function public.fee_refund_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other numeric;
begin
  if not public.fee_is_app_caller() then return new; end if;

  if tg_op = 'INSERT' then
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'A new refund request must start as pending' using errcode = 'check_violation';
    end if;
    new.status := 'pending';
    new.requested_by_uid := auth.uid();
    new.decided_by_uid := null;
    new.decided_by := null;
    new.decided_at := null;
    if length(btrim(coalesce(new.reason, ''))) < 5 then
      raise exception 'Give a reason for the refund (at least 5 characters)' using errcode = 'check_violation';
    end if;
    -- money going back cannot exceed money that came in (write-offs reduce dues, not paid money)
    if new.kind <> 'Write-off dues' then
      select coalesce(sum(amount), 0) into other from public.fee_refunds
       where ltrim(gcc, '0') = ltrim(btrim(new.gcc), '0') and kind <> 'Write-off dues' and status <> 'rejected';
      if new.amount + other > public.fee_net_paid(new.gcc) then
        raise exception 'Refund of Rs % is more than this student has paid (Rs % paid, Rs % already refunded or pending)',
          new.amount, public.fee_net_paid(new.gcc), other using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: what was filed cannot be changed, and who did what is stamped by the database
  new.requested_by_uid := old.requested_by_uid;
  if new.gcc is distinct from old.gcc or new.kind is distinct from old.kind or new.amount is distinct from old.amount
     or new.target_gcc is distinct from old.target_gcc or new.requested_by is distinct from old.requested_by
     or new.created_at is distinct from old.created_at then
    raise exception 'A filed refund request cannot be edited. Reject it and file a new one.' using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    if not ((old.status = 'pending' and new.status in ('approved', 'rejected'))
            or (old.status = 'approved' and new.status in ('paid', 'rejected'))) then
      raise exception 'A refund cannot go from % to %', old.status, new.status using errcode = 'check_violation';
    end if;
    if new.status in ('approved', 'rejected') then
      new.decided_by_uid := auth.uid();
      new.decided_at := now();
    else
      new.decided_by_uid := old.decided_by_uid;
    end if;
    if new.status = 'approved' and new.amount > public.fee_self_approve_limit_refund()
       and public.fee_admin_count() > 1
       and old.requested_by_uid is not null and old.requested_by_uid = auth.uid() then
      raise exception 'You filed this refund. Another admin must approve refunds above Rs %', public.fee_self_approve_limit_refund() using errcode = 'check_violation';
    end if;
    if new.status = 'paid' and length(btrim(coalesce(new.reference, ''))) < 4 then
      raise exception 'Enter the payment reference (cheque / UTR / receipt) to mark a refund paid' using errcode = 'check_violation';
    end if;
  else
    new.decided_by_uid := old.decided_by_uid;
    if old.status in ('paid', 'rejected') and (new.reference is distinct from old.reference or new.decision_note is distinct from old.decision_note
         or new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at or new.mode is distinct from old.mode) then
      raise exception 'A % refund cannot be changed', old.status using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.fee_refund_guard() from public;

-- Refunds keep the Rs 2,000 two-admin limit (concessions were changed to one admin in 20261017).
create or replace function public.fee_self_approve_limit_refund() returns numeric
language sql immutable as $$ select 2000::numeric $$;

create or replace function public.fee_refund_no_delete()
returns trigger
language plpgsql
as $$
begin
  if public.fee_is_app_caller() then
    raise exception 'Refund requests cannot be deleted. Reject it instead.' using errcode = 'insufficient_privilege';
  end if;
  return old;
end $$;

drop trigger if exists fee_refund_guard on public.fee_refunds;
create trigger fee_refund_guard before insert or update on public.fee_refunds
  for each row execute function public.fee_refund_guard();
drop trigger if exists fee_refund_no_delete on public.fee_refunds;
create trigger fee_refund_no_delete before delete on public.fee_refunds
  for each row execute function public.fee_refund_no_delete();
drop policy if exists fee_refunds_delete on public.fee_refunds;

-- ════════════════════════════════════════════════════════════════════════════
-- M3. No back-dated payments by non-admins
-- ════════════════════════════════════════════════════════════════════════════
alter table public.fee_controls add column if not exists backdate_grace_days int not null default 1;

create or replace function public.fee_backdate_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nj jsonb := to_jsonb(new);
  oj jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  d date;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  grace int;
begin
  if not public.fee_is_app_caller() then return new; end if;
  if not public.fee_row_has_money(nj) then return new; end if;
  -- only when a payment is being recorded, or its date is being changed
  if tg_op = 'UPDATE' and public.fee_row_has_money(oj) and (nj -> 'pay_date') is not distinct from (oj -> 'pay_date') then
    return new;
  end if;
  begin d := (nj ->> 'pay_date')::date; exception when others then d := null; end;
  if d is null then return new; end if;
  if d > today then
    raise exception 'Payment date % is in the future', d using errcode = 'check_violation';
  end if;
  if public.qbank_is_admin() then return new; end if;
  select coalesce(backdate_grace_days, 1) into grace from public.fee_controls where id = 1;
  if d < today - coalesce(grace, 1) then
    raise exception 'Payment date % is too far back. Staff can record payments dated today or up to % day(s) earlier; ask an admin to record older payments.', d, coalesce(grace, 1) using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.fee_backdate_guard() from public;

-- ════════════════════════════════════════════════════════════════════════════
-- M5. One receipt number = one student
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.fee_receipt_owners (
  receipt_no text primary key,
  gcc        text not null,
  created_at timestamptz not null default now()
);
alter table public.fee_receipt_owners enable row level security;   -- no policies: only the trigger touches it

-- First owner of each receipt number that already exists (oldest payment wins).
insert into public.fee_receipt_owners (receipt_no, gcc)
select distinct on (receipt_no) receipt_no, g from (
  select receipt_no, ltrim(adm_app_id::text, '0') as g, pay_date::text as d from public.adm_fee_collections where coalesce(receipt_no, '') <> ''
  union all select receipt_no, ltrim(adm_app_id::text, '0'), pay_date::text from public.adm_flat_fees where coalesce(receipt_no, '') <> ''
  union all select receipt_no, ltrim(adm_app_id::text, '0'), pay_date::text from public.adm_course_fees where coalesce(receipt_no, '') <> ''
) x
order by receipt_no, d nulls last
on conflict (receipt_no) do nothing;

create or replace function public.fee_receipt_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text := btrim(coalesce(to_jsonb(new) ->> 'receipt_no', ''));
  g text := ltrim(coalesce(new.adm_app_id::text, ''), '0');
  owner text;
begin
  if r = '' then return new; end if;
  if tg_op = 'UPDATE' and r is not distinct from btrim(coalesce(to_jsonb(old) ->> 'receipt_no', ''))
     and g is not distinct from ltrim(coalesce(old.adm_app_id::text, ''), '0') then
    return new;
  end if;
  insert into public.fee_receipt_owners (receipt_no, gcc) values (r, g) on conflict (receipt_no) do nothing;
  select o.gcc into owner from public.fee_receipt_owners o where o.receipt_no = r;
  if owner is distinct from g then
    raise exception 'Receipt number % is already used for another student (GCC %). Save again to get a new receipt number.', r, owner
      using errcode = 'unique_violation';
  end if;
  return new;
end $$;
revoke all on function public.fee_receipt_owner_guard() from public;

-- ── install ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['adm_flat_fees', 'adm_course_fees', 'adm_fee_collections'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists fee_backdate_guard on public.%I', t);
    execute format('create trigger fee_backdate_guard before insert or update on public.%I for each row execute function public.fee_backdate_guard()', t);
    execute format('drop trigger if exists fee_receipt_owner_guard on public.%I', t);
    execute format('create trigger fee_receipt_owner_guard before insert or update on public.%I for each row execute function public.fee_receipt_owner_guard()', t);
  end loop;
end $$;
