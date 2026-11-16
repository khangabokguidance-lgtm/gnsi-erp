-- Mission Sainik 2027 — review notes on a builder section ("request changes" thread between verifier and setter).
-- Run after 20261212. Requires public.qbank_is_staff() (20260925_qbank_rls.sql). Safe to re-run.
create table if not exists public.mission_sainik_reviews (
  id           bigserial primary key,
  series       text not null,
  test_no      integer not null,
  section      text not null,
  note         text not null,
  author       text,
  status       text not null default 'open' check (status in ('open', 'resolved')),
  created_at   timestamptz not null default now(),
  resolved_by  text,
  resolved_at  timestamptz
);
create index if not exists mission_sainik_reviews_idx on public.mission_sainik_reviews (series, test_no, section);
alter table public.mission_sainik_reviews enable row level security;
drop policy if exists mission_sainik_reviews_staff on public.mission_sainik_reviews;
create policy mission_sainik_reviews_staff on public.mission_sainik_reviews for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
