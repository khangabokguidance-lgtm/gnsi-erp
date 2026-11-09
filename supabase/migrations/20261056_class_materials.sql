-- Class Material: view-only study material and test-series papers uploaded by the admin for classroom use.
create table if not exists public.class_materials (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'material',        -- 'material' | 'test_series'
  course text not null,                         -- Navodaya | Sainik | Foundation
  batch text default '',                        -- '' = every class of the course
  subject text not null,
  title text not null,
  series_name text default '',
  test_no integer,
  description text default '',
  file_path text not null,
  file_name text default '',
  file_type text default 'pdf',                 -- 'pdf' | 'image'
  file_size bigint default 0,
  uploaded_by text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists class_materials_browse_idx on public.class_materials (course, subject);

alter table public.class_materials enable row level security;
drop policy if exists class_materials_read on public.class_materials;
create policy class_materials_read on public.class_materials for select to authenticated using (true);
drop policy if exists class_materials_write on public.class_materials;
create policy class_materials_write on public.class_materials for all to authenticated using (true) with check (true);

-- private bucket: files are never public links; the app streams them to the on-screen viewer
insert into storage.buckets (id, name, public) values ('class-materials', 'class-materials', false) on conflict (id) do nothing;
drop policy if exists class_materials_files on storage.objects;
create policy class_materials_files on storage.objects for all to authenticated
  using (bucket_id = 'class-materials') with check (bucket_id = 'class-materials');
