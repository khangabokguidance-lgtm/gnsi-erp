-- ============================================================================
-- "Collected By" is compulsory on every fee row
-- ============================================================================
-- The app now fills Collected By from the signed-in user. This makes the database refuse a new fee row
-- that has no name, and refuse blanking a name that is already there, so the rule holds even if the app
-- is bypassed. Existing blank rows (see Fees -> "records missing Collected By") are left alone and can
-- still be updated (e.g. reverted) or filled in; only NEW blanks are refused.
--
-- The SQL editor / service role (webhooks, imports) is exempt, like the other fee guards.
-- REQUIRES 20261006 (fee_is_app_caller). Safe to run more than once.
-- ============================================================================

create or replace function public.fee_collected_by_required()
returns trigger
language plpgsql
as $$
begin
  if not public.fee_is_app_caller() then return new; end if;
  if tg_op = 'INSERT' then
    if length(btrim(coalesce(new.collected_by, ''))) = 0 then
      raise exception 'Collected By is required on every fee record';
    end if;
  elsif length(btrim(coalesce(old.collected_by, ''))) > 0 and length(btrim(coalesce(new.collected_by, ''))) = 0 then
    raise exception 'Collected By cannot be removed from a fee record';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['adm_fee_collections','adm_course_fees','adm_flat_fees'] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='collected_by') then
      execute format('drop trigger if exists fee_collected_by_required on public.%I', t);
      execute format('create trigger fee_collected_by_required before insert or update on public.%I for each row execute function public.fee_collected_by_required()', t);
    end if;
  end loop;
end $$;
