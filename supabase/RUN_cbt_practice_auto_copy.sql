-- Automatic practice copies: the site's server (service role) reads a closed exam's paper ONCE through cbt_practice_paper and
-- stores it on the CDN (bucket cbt-practice). Most projects already allow this; the grant makes sure. Safe to run more than once.
-- Needs supabase/RUN_cbt_practice_bucket.sql (the bucket) and SUPABASE_SERVICE_ROLE_KEY on the server (already used by the site).
grant execute on function public.cbt_practice_paper(text) to service_role;
