-- Mission Sainik 2027 — student results for the Pre Mock (PMT-01..20) and Mega Mock (MT-01..20) analyzers.
-- scores is a JSON object keyed by section (see MissionSainikAnalyzer.jsx). Safe to run more than once.
create table if not exists public.mission_sainik_results (
  id          bigserial primary key,
  series      text not null check (series in ('pre', 'mega')),
  test_no     integer not null,
  student     text not null,
  roll        text,
  batch       text,
  scores      jsonb not null default '{}'::jsonb,
  entered_by  text,
  created_at  timestamptz not null default now(),
  constraint mission_sainik_results_uq unique (series, test_no, student)
);
create index if not exists mission_sainik_results_series_idx on public.mission_sainik_results (series, test_no);
alter table public.mission_sainik_results enable row level security;
drop policy if exists mission_sainik_results_all on public.mission_sainik_results;
create policy mission_sainik_results_all on public.mission_sainik_results for all to anon, authenticated using (true) with check (true);
