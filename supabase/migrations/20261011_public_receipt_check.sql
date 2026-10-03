-- ============================================================================
-- Public receipt check (parents scan the QR on a receipt)
-- ============================================================================
-- Returns ONLY: whether the receipt exists for that GCC, the total of its
-- non-reverted lines, the latest payment date, and whether it was reverted.
-- No name, phone, or other student data. Both the receipt number AND the GCC
-- must match, so a guessed receipt number alone reveals nothing.
-- Safe to run more than once.
-- ============================================================================
create or replace function public.verify_public_receipt(p_receipt text, p_gcc text)
returns table (found boolean, total numeric, pay_date date, all_reverted boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r text := trim(coalesce(p_receipt, ''));
  g text := ltrim(trim(coalesce(p_gcc, '')), '0');
  t numeric := 0;
  d date := null;
  n int := 0;
  live int := 0;
begin
  if length(r) < 6 or g = '' then
    return query select false, 0::numeric, null::date, false;
    return;
  end if;

  select count(*), count(*) filter (where not coalesce(x.reverted, false)),
         coalesce(sum(x.amt) filter (where not coalesce(x.reverted, false)), 0), max(x.dt)
    into n, live, t, d
  from (
    select amount_paid::numeric as amt, reverted, pay_date::date as dt from public.adm_fee_collections where receipt_no = r and ltrim(adm_app_id::text, '0') = g
    union all
    select amount::numeric, reverted, pay_date::date from public.adm_flat_fees where receipt_no = r and ltrim(adm_app_id::text, '0') = g
    union all
    select amount_paid::numeric, reverted, pay_date::date from public.adm_course_fees where receipt_no = r and ltrim(adm_app_id::text, '0') = g
  ) x;

  return query select n > 0, t, d, (n > 0 and live = 0);
end $$;

revoke all on function public.verify_public_receipt(text, text) from public;
grant execute on function public.verify_public_receipt(text, text) to anon, authenticated;
