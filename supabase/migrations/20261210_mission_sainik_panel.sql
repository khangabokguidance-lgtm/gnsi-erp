-- Mission Sainik 2027 — editable Question Setting Panel (add / edit / delete members from the Panel tab).
-- When this table has rows it replaces the panel written in the code; when empty the code's panel is used.
-- Run after 20261209. Requires public.qbank_is_staff() (20260925_qbank_rls.sql). Safe to re-run.
create table if not exists public.mission_sainik_panel (
  id          bigserial primary key,
  subject_key text not null,                      -- maths | reasoning | science | gk | grammar | vocab
  name        text not null,                      -- as in the notice, e.g. Sumanta
  role        text not null default 'setter' check (role in ('setter', 'verifier', 'assistant')),
  created_by  text,
  created_at  timestamptz not null default now(),
  constraint mission_sainik_panel_uq unique (subject_key, name, role)
);
alter table public.mission_sainik_panel enable row level security;
drop policy if exists mission_sainik_panel_staff on public.mission_sainik_panel;
create policy mission_sainik_panel_staff on public.mission_sainik_panel for all to authenticated
  using (public.qbank_is_staff()) with check (public.qbank_is_staff());
