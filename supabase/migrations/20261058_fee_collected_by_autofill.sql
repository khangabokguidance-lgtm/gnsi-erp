-- ============================================================================
-- "Collected By": fill it from the row's staff_id instead of failing the save
-- ============================================================================
-- 20261048 rejected any new fee row with a blank collected_by. Older app builds
-- (and the flat / course-fee save path before the fix in feeEngine.js) send
-- staff_id (the signed-in user) but not collected_by, so every course/flat fee
-- save failed with "Collected By is required on every fee record".
--
-- Now: on INSERT, a blank collected_by is filled from staff_id. The row is only
-- refused when BOTH are blank, so the rule "every fee row names who collected
-- it" still holds. Blanking an existing name is still refused.
--
-- REQUIRES 20261006 (fee_is_app_caller) and 20261048. Safe to run more than once.
-- The SQL editor / service role is exempt, like the other fee guards.
-- ============================================================================

create or replace function public.fee_collected_by_required()
returns trigger
language plpgsql
as $$
declare
  fallback text;
begin
  if not public.fee_is_app_caller() then return new; end if;
  if tg_op = 'INSERT' then
    if length(btrim(coalesce(new.collected_by, ''))) = 0 then
      -- staff_id is read via jsonb so this works on every fee table
      fallback := btrim(coalesce(to_jsonb(new) ->> 'staff_id', ''));
      if length(fallback) > 0 then
        new.collected_by := fallback;
      else
        raise exception 'Collected By is required on every fee record';
      end if;
    end if;
  elsif length(btrim(coalesce(old.collected_by, ''))) > 0 and length(btrim(coalesce(new.collected_by, ''))) = 0 then
    raise exception 'Collected By cannot be removed from a fee record';
  end if;
  return new;
end $$;
