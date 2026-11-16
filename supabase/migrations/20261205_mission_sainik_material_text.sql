-- Mission Sainik 2027 — typed study material (stored in the portal, printable). Adds a body column.
alter table public.mission_sainik_materials add column if not exists body text;
alter table public.mission_sainik_materials drop constraint if exists mission_sainik_materials_src;
alter table public.mission_sainik_materials add constraint mission_sainik_materials_src
  check (link_url is not null or file_path is not null or body is not null);
