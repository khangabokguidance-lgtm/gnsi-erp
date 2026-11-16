-- Mission Sainik 2027 — study material uploaded by teachers (files or links).
-- Files go to the existing private 'teacher-materials' bucket under mission-sainik/; this table stores the path.
-- Safe to run more than once.
create table if not exists public.mission_sainik_materials (
  id          bigserial primary key,
  title       text not null,
  subject     text,                 -- SUBJECTS label, or null for general
  test_no     integer not null default 0,  -- 0 = not tied to one test
  link_url    text,                 -- external link (Drive, YouTube…)
  file_path   text,                 -- storage path in 'teacher-materials'
  file_name   text,
  note        text,
  uploaded_by text,
  created_at  timestamptz not null default now(),
  constraint mission_sainik_materials_src check (link_url is not null or file_path is not null)
);
create index if not exists mission_sainik_materials_subject_idx on public.mission_sainik_materials (subject);
alter table public.mission_sainik_materials enable row level security;
drop policy if exists mission_sainik_materials_all on public.mission_sainik_materials;
create policy mission_sainik_materials_all on public.mission_sainik_materials
  for all to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('teacher-materials', 'teacher-materials', false)
  on conflict (id) do nothing;
drop policy if exists teacher_materials_rw on storage.objects;
create policy teacher_materials_rw on storage.objects for all to authenticated
  using (bucket_id = 'teacher-materials') with check (bucket_id = 'teacher-materials');
