-- Mission Sainik 2027 — difficulty mix per submitted section (notice asks for ~40% easy / 40% medium / 20% hard).
alter table public.mission_sainik_tasks add column if not exists easy_count   integer;
alter table public.mission_sainik_tasks add column if not exists medium_count integer;
alter table public.mission_sainik_tasks add column if not exists hard_count   integer;
