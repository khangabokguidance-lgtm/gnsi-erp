-- One primary payment per student per fee month, enforced in the database.
-- The app already checks this before saving, but two counters saving at once
-- could both pass that check. A balance (top-up) row for a part-paid month has
-- an id ending _b<n> and is exempt; every other non-reverted row for the same
-- student + month + year must be unique. An advisory lock serialises the check.
create or replace function public.fee_one_primary_per_month()
returns trigger language plpgsql as $$
declare
  m text;
  dup int;
begin
  if coalesce(new.reverted, false) or new.id ~ '_b[0-9]+$' then return new; end if;
  if tg_table_name = 'adm_flat_fees' then
    if not coalesce(new.paid, true) then return new; end if;
    m := new.month;
  else
    m := new.for_month;
  end if;
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || new.adm_app_id::text || ':' || m || ':' || new.year::text));
  if tg_table_name = 'adm_flat_fees' then
    select count(*) into dup from public.adm_flat_fees
      where adm_app_id = new.adm_app_id and month = m and year = new.year
        and id <> new.id and id !~ '_b[0-9]+$' and reverted = false and paid = true;
  else
    select count(*) into dup from public.adm_course_fees
      where adm_app_id = new.adm_app_id and for_month = m and year = new.year
        and id <> new.id and id !~ '_b[0-9]+$' and reverted = false;
  end if;
  if dup > 0 then
    raise exception 'A % payment for % % already exists for this student', tg_table_name, m, new.year;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['adm_flat_fees', 'adm_course_fees'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists fee_one_primary_per_month on public.%I', t);
      execute format('create trigger fee_one_primary_per_month before insert or update on public.%I for each row execute function public.fee_one_primary_per_month()', t);
    end if;
  end loop;
end $$;
