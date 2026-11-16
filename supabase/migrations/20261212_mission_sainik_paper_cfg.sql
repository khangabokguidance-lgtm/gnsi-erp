-- Mission Sainik 2027 — saved paper settings (columns, fonts, section titles / order) per builder. Run after 20261211.
create table if not exists public.mission_sainik_paper_cfg (
  series      text primary key,            -- pre | mega | daily | practice
  config      jsonb not null,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
alter table public.mission_sainik_paper_cfg enable row level security;
drop policy if exists mission_sainik_paper_cfg_staff on public.mission_sainik_paper_cfg;
create policy mission_sainik_paper_cfg_staff on public.mission_sainik_paper_cfg for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
