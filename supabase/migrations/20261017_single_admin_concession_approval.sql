-- Low-fee concessions: ONE admin may approve any amount.
-- The "a concession above ₹2000 needs a different admin" rule (fee_concession_validate)
-- keys off fee_self_approve_limit(); raising it removes that rule for concessions only.
-- (Only the concession trigger uses this function; refunds keep their own check.)
create or replace function public.fee_self_approve_limit() returns numeric
language sql immutable as $$ select 1000000000::numeric $$;
