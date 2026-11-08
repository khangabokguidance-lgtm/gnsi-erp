-- ─────────────────────────────────────────────────────────────────────────────
-- Online exam: request limits that work for a whole class on ONE network (run after 20261061).
-- A load test of 300 candidates on one school Wi-Fi address (one shared public IP) found that the per-address limits
-- (60 lookups / 15 wrong numbers / 30 wrong codes per 10 minutes) locked out all but ~30 of them. The limits are there to
-- stop guessing, but a lab full of students looks like one very busy person. New ceilings per address per 10 minutes:
--     find  (GCC lookups, found or not) 600      phone (wrong parent numbers) 100      code (wrong access codes) 150
-- Guessing is still held back by other limits that do NOT depend on the address: each GCC no. allows only 20 wrong
-- numbers per 10 minutes (cbt_start / cbt_lookup), and a 6-digit access code at 150 tries per 10 minutes per address
-- would take weeks. Change the numbers in cbt_limit() below to suit your institute. Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.cbt_limit(p_kind text) returns int
language sql immutable as $$
  select case p_kind when 'find' then 600 when 'phone' then 100 when 'code' then 150 else 30 end
$$;

-- the callers still pass their old numbers; they now act as a floor under cbt_limit()
create or replace function public.cbt_throttled(p_kind text, p_max int) returns boolean
language sql security definer set search_path = public as $$
  select count(*) >= greatest(p_max, public.cbt_limit(p_kind))
  from public.cbt_hits h where h.ip = public.cbt_client_ip() and h.kind = p_kind and h.at > now() - interval '10 minutes'
$$;

revoke all on function public.cbt_limit(text) from public;
revoke all on function public.cbt_throttled(text, int) from public;
