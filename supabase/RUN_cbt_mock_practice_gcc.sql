-- Run this once in the Supabase SQL editor (same as migrations/20261122_cbt_mock_practice_gcc.sql).
-- ────────────────────────────────────────────────────────────────────────────
-- Practice and mock tests: ask for the GCC no. and allow each GCC 5 tries per test.
--   cbt_mock_practice      one small row per start: the GCC no., the test (mock slug or practice-<exam id>) and the time.
--                          Staff (qbank_is_staff) read it; an admin may delete rows to give a student more tries.
--   cbt_mock_begin(slug, gcc)  checks the GCC no. is an active student, counts the tries, records this one.
--                          Returns { ok, used, limit, left } or an { error: 'EXAM-…' } the page shows as text.
-- Needs 20260925_qbank_rls.sql and the CBT online setup (cbt_throttled / cbt_hit). Safe to run more than once.
-- To change the 5-tries limit, change `lim` below and run this file again.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.cbt_mock_practice (
  id bigserial primary key,
  gcc text not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,80}$'),
  started_at timestamptz not null default now()
);
create index if not exists cbt_mock_practice_gcc_slug on public.cbt_mock_practice (gcc, slug);
create index if not exists cbt_mock_practice_slug_time on public.cbt_mock_practice (slug, started_at desc);
alter table public.cbt_mock_practice enable row level security;
drop policy if exists cbt_mock_practice_staff_read on public.cbt_mock_practice;
create policy cbt_mock_practice_staff_read on public.cbt_mock_practice for select to authenticated using (public.qbank_is_staff());
drop policy if exists cbt_mock_practice_admin_delete on public.cbt_mock_practice;
create policy cbt_mock_practice_admin_delete on public.cbt_mock_practice for delete to authenticated using (public.qbank_is_admin());

create or replace function public.cbt_mock_begin(p_slug text, p_gcc text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lim constant int := 5;
  g text := ltrim(regexp_replace(coalesce(p_gcc, ''), '\D', '', 'g'), '0');
  st public.students; n int;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,80}$' then return jsonb_build_object('error', 'EXAM-PRACTICE: This practice link is not valid.'); end if;
  if public.cbt_throttled('find', 60) then return jsonb_build_object('error', 'EXAM-LIMIT: Too many tries from this network. Wait ten minutes and try again.'); end if;
  perform public.cbt_hit('find');
  if g = '' or length(g) > 12 then return jsonb_build_object('error', 'EXAM-GCC: Enter your GCC no.'); end if;
  select * into st from public.students s where ltrim(s.gcc_no::text, '0') = g and coalesce(s.status, 'Active') = 'Active' limit 1;
  if not found then return jsonb_build_object('error', 'EXAM-GCC: This GCC no. was not found. Check it, or ask the office.'); end if;
  perform pg_advisory_xact_lock(hashtext(g || ':' || p_slug));   -- two taps at once cannot both take the last try
  select count(*) into n from public.cbt_mock_practice where gcc = g and slug = p_slug;
  if n >= lim then
    return jsonb_build_object('error', 'EXAM-TRIES: You have already practised this test ' || lim || ' times. Ask your teacher if you need another try.');
  end if;
  insert into public.cbt_mock_practice (gcc, slug) values (g, p_slug);
  return jsonb_build_object('ok', true, 'used', n + 1, 'limit', lim, 'left', lim - n - 1);
end $$;

revoke all on function public.cbt_mock_begin(text, text) from public;
grant execute on function public.cbt_mock_begin(text, text) to anon, authenticated;
