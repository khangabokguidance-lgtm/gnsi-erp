-- ============================================================================
-- Expenditure: genuine data only — no "Other", a real reason
-- ============================================================================
-- Extends the Accounts rules (20261031) so a manual expense entry must say what the money was for:
--
--   ACC-004  the category cannot be a filler: "Other", "Paytm Payment", "Gpay Business", "Misc", "NA"…
--   ACC-005  the reason (note) must be a real description: at least N characters and N words (default 15 / 3),
--            not a filler, and not just the category repeated
--
-- Same scope as the earlier rules: MANUAL expense entries only (fees / store / Razorpay postings carry
-- source_type / source_ref and are never touched). On UPDATE the rules apply only to the field being changed,
-- so attaching a receipt to an old entry is never blocked. Existing rows are not re-checked.
-- Switches: accounting_controls.block_generic_category / generic_description_check / min_reason_length /
-- min_reason_words, and the master switch enforce_in_database.
--
-- REQUIRES 20261031_expenditure_accounting_controls.sql. Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regclass('public.accounting_controls') is null or to_regprocedure('public.accounts_controls_trigger()') is null then
    raise exception 'Run 20261031_expenditure_accounting_controls.sql first.';
  end if;
end $$;

alter table public.accounting_controls add column if not exists block_generic_category boolean not null default true;
alter table public.accounting_controls add column if not exists min_reason_length      int     not null default 15;
alter table public.accounting_controls add column if not exists min_reason_words       int     not null default 3;

-- Normalise like the app does: lower-case, punctuation → space, leading digits dropped ("21Other" → "other").
create or replace function public.accounts_norm_text(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', ' ', 'g'), '^[0-9]+', ''))
$$;

-- Generic = every word is a filler word. Keep this list in step with GENERIC_WORDS in src/lib/expenditureRules.js.
create or replace function public.accounts_is_generic_text(p text)
returns boolean language sql immutable as $$
  select not exists (
    select 1 from unnest(string_to_array(public.accounts_norm_text(p), ' ')) t
    where t <> '' and t <> all (array[
      'paytm','payment','payments','gpay','google','pay','phonepe','upi','cash','bank','transfer','online',
      'business','other','others','misc','miscellaneous','expense','expenses','amount','money','paid','general',
      'na','nil','none','unknown','test','item','items','various','sundry','sundries','stuff','things','thing','etc'])
  )
$$;

create or replace function public.accounts_word_count(p text)
returns int language sql immutable as $$
  select count(*)::int from regexp_split_to_table(btrim(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', ' ', 'g')), ' ') t where t <> ''
$$;

-- The row trigger: previous rules (voucher number, ACC-001/002/003) unchanged, plus ACC-004 / ACC-005.
create or replace function public.accounts_controls_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare c public.accounting_controls%rowtype;
        manual boolean;
        digital boolean;
        money_changed boolean;
        d date;
        n text;
begin
  -- voucher number on every new entry, manual or automatic
  if tg_op = 'INSERT' and coalesce(new.voucher_no, '') = '' then
    begin d := new.entry_date::date; exception when others then d := current_date; end;
    new.voucher_no := public.next_voucher_no(new.type, d);
  end if;

  select * into c from public.accounting_controls where id = 1;
  if not found or not c.enforce_in_database then return new; end if;

  -- rules apply to manual entries only (fees / store / Razorpay carry source_type or source_ref)
  manual := coalesce(new.source_type, '') = '' and coalesce(new.source_ref, '') = '';
  if not manual then return new; end if;

  -- ACC-003: voiding needs a reason
  if tg_op = 'UPDATE' and c.require_delete_reason
     and coalesce(old.is_soft_deleted, false) = false and coalesce(new.is_soft_deleted, false) = true
     and length(btrim(coalesce(new.delete_reason, ''))) < 4 then
    raise exception 'ACC-003: a reason (at least 4 characters) is required to delete an entry.' using errcode = 'check_violation';
  end if;

  if new.type <> 'Expense' or coalesce(new.is_soft_deleted, false) then return new; end if;

  -- ACC-004: no filler category (new entry, or when the category is being changed)
  if c.block_generic_category and (tg_op = 'INSERT' or new.category is distinct from old.category)
     and public.accounts_is_generic_text(new.category) then
    raise exception 'ACC-004: "%" is not a real category. Choose the head the money was spent on (food, salary, repair, construction, medical…).', coalesce(nullif(btrim(new.category), ''), '(blank)') using errcode = 'check_violation';
  end if;

  -- ACC-005: a real reason (new entry, or when the reason is being changed)
  if c.generic_description_check and (tg_op = 'INSERT' or new.note is distinct from old.note) then
    n := btrim(coalesce(new.note, ''));
    if length(n) < c.min_reason_length
       or public.accounts_word_count(n) < c.min_reason_words
       or public.accounts_is_generic_text(n)
       or public.accounts_norm_text(n) = public.accounts_norm_text(new.category) then
      raise exception 'ACC-005: write a real reason — what was bought or paid for, and for whom (at least % characters and % words, not just the category or "Paytm payment").', c.min_reason_length, c.min_reason_words using errcode = 'check_violation';
    end if;
  end if;

  -- ACC-001 / ACC-002: money fields — only on a new entry, or when one of them changes
  money_changed := tg_op = 'INSERT'
    or new.payment_mode is distinct from old.payment_mode
    or new.account_type is distinct from old.account_type
    or new.txn_ref      is distinct from old.txn_ref
    or new.amount       is distinct from old.amount;
  if not money_changed then return new; end if;

  digital := lower(btrim(coalesce(new.payment_mode, ''))) in
    ('upi', 'bank', 'card', 'paytm', 'gpay', 'phonepe', 'cheque', 'neft', 'imps', 'rtgs', 'online', 'bank transfer');

  if digital and c.block_digital_in_cash_acct and coalesce(new.account_type, 'Cash A/c') = 'Cash A/c' then
    raise exception 'ACC-001: a % payment cannot be booked to the Cash A/c. Choose the bank / UPI account.', new.payment_mode using errcode = 'check_violation';
  end if;
  if digital and c.require_txn_ref_for_digital and length(btrim(coalesce(new.txn_ref, ''))) < 6 then
    raise exception 'ACC-002: enter the payment reference (UTR / transaction id, at least 6 characters) for % payments.', new.payment_mode using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.accounts_controls_trigger() from public;
