-- One fee row per Razorpay payment. webhook.js checks "already recorded?" and then inserts; two
-- deliveries of the same payment running at once could both pass the check and record the money twice.
-- A unique index makes the database the final judge. Only Razorpay payment ids ("pay_...") are
-- constrained: manual UPI/cheque references may legitimately repeat.
--
-- If a table already holds duplicates the index is skipped with a NOTICE (it cannot be built); clean
-- the duplicates, then re-run this file.
do $$
declare t text;
begin
  foreach t in array array['adm_fee_collections','adm_course_fees','adm_flat_fees'] loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='txn_ref') then
      begin
        execute format('create unique index if not exists %I on public.%I (txn_ref) where txn_ref like %L',
                       t || '_rzp_txn_ref_uidx', t, 'pay\_%');
      exception when unique_violation then
        raise notice 'duplicate Razorpay payment ids in %: unique index skipped — remove duplicates and re-run', t;
      end;
    end if;
  end loop;
end $$;
