-- Checklist "Today" tool: teacher daily tasks + materials for the day's classes.
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  owner_name text not null,
  course text not null,
  batch text default '',
  subject text default '',
  title text not null,
  notes text default '',
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists daily_tasks_day_idx on public.daily_tasks (task_date, owner_name);

create table if not exists public.daily_materials (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  owner_name text not null,
  course text not null,
  batch text default '',
  subject text default '',
  title text not null,
  kind text not null default 'note',
  url text default '',
  body text default '',
  file_name text default '',
  task_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists daily_materials_day_idx on public.daily_materials (task_date, owner_name);

alter table public.daily_tasks enable row level security;
alter table public.daily_materials enable row level security;
drop policy if exists daily_tasks_all on public.daily_tasks;
create policy daily_tasks_all on public.daily_tasks for all using (true) with check (true);
drop policy if exists daily_materials_all on public.daily_materials;
create policy daily_materials_all on public.daily_materials for all using (true) with check (true);

-- private bucket for uploaded material files
insert into storage.buckets (id, name, public) values ('teacher-materials', 'teacher-materials', false)
  on conflict (id) do nothing;
drop policy if exists teacher_materials_rw on storage.objects;
create policy teacher_materials_rw on storage.objects for all to authenticated
  using (bucket_id = 'teacher-materials') with check (bucket_id = 'teacher-materials');
