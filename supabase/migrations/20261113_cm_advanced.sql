-- ============================================================================
-- 20261113_cm_advanced.sql — Construction & Maintenance: advanced features
--
-- The module shows "Run cm_advanced.sql in the Supabase SQL Editor to enable this"
-- until this has run. It adds:
--   • cm_projects: priority, location, retention % (held till completion), retention released
--   • cm_photos       site photos (before / during / after)
--   • cm_materials    BOQ — bill of quantities with estimated and actual qty / rate
--   • cm_issues       snags / issues with priority, assignee, fix-by date
--   • cm_site_logs    daily site diary
--   • cm_contractors  contractor directory with ratings
--   • cm_maintenance  recurring maintenance schedule
-- plus staff access rules on the new tables (read / add / change: signed-in staff,
-- delete: admins), and the attachments storage bucket for photos, contracts and receipts.
--
-- Needs 20260925_qbank_rls.sql (qbank_is_staff / qbank_is_admin) and the base cm_projects
-- table. Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── cm_projects: extra columns ───────────────────────────────────────────────
alter table public.cm_projects add column if not exists priority           text    default 'Medium';
alter table public.cm_projects add column if not exists location           text;
alter table public.cm_projects add column if not exists retention_pct      numeric default 0;
alter table public.cm_projects add column if not exists retention_released boolean default false;
alter table public.cm_projects add column if not exists contract_file_url  text;
alter table public.cm_project_payments add column if not exists receipt_url text;

-- ── new tables ───────────────────────────────────────────────────────────────
create table if not exists public.cm_photos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  project_id  uuid,
  url         text not null,
  caption     text,
  stage       text default 'During',
  taken_on    date default current_date,
  created_by  text
);
create index if not exists cm_photos_project_idx on public.cm_photos (project_id);

create table if not exists public.cm_materials (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  project_id  uuid,
  item        text not null,
  unit        text,
  est_qty     numeric default 0,
  est_rate    numeric default 0,
  actual_qty  numeric,
  actual_rate numeric,
  supplier    text,
  created_by  text
);
create index if not exists cm_materials_project_idx on public.cm_materials (project_id);

create table if not exists public.cm_issues (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  project_id  uuid,
  title       text not null,
  priority    text default 'Medium',
  status      text default 'Open',
  assigned_to text,
  due_date    date,
  details     text,
  resolved_at timestamptz,
  created_by  text
);
create index if not exists cm_issues_project_idx on public.cm_issues (project_id);

create table if not exists public.cm_site_logs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  project_id     uuid,
  log_date       date default current_date,
  weather        text,
  workers        integer,
  work_done      text not null,
  materials_used text,
  remarks        text,
  created_by     text
);
create index if not exists cm_site_logs_project_idx on public.cm_site_logs (project_id);

create table if not exists public.cm_contractors (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  name        text not null,
  phone       text,
  trade       text,
  gstin       text,
  rating      integer,
  notes       text,
  created_by  text
);

create table if not exists public.cm_maintenance (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  asset          text not null,
  task           text not null,
  location       text,
  frequency_days integer default 90,
  next_due       date default current_date,
  last_done      date,
  vendor         text,
  vendor_phone   text,
  est_cost       numeric default 0,
  notes          text,
  active         boolean default true,
  created_by     text
);

-- ── access rules on every cm_* table (new ones included) ─────────────────────
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'cm\_%' escape '\' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists cm_staff_select on public.%I', t);
    execute format('drop policy if exists cm_staff_insert on public.%I', t);
    execute format('drop policy if exists cm_staff_update on public.%I', t);
    execute format('drop policy if exists cm_admin_delete on public.%I', t);
    execute format('create policy cm_staff_select on public.%I for select to authenticated using (public.qbank_is_staff())', t);
    execute format('create policy cm_staff_insert on public.%I for insert to authenticated with check (public.qbank_is_staff())', t);
    execute format('create policy cm_staff_update on public.%I for update to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff())', t);
    execute format('create policy cm_admin_delete on public.%I for delete to authenticated using (public.qbank_is_admin())', t);
  end loop;
end $$;

-- ── attachments bucket (photos, contract files, receipts) ────────────────────
insert into storage.buckets (id, name, public) values ('cm-attachments', 'cm-attachments', true)
on conflict (id) do nothing;

drop policy if exists cm_attachments_read   on storage.objects;
drop policy if exists cm_attachments_write  on storage.objects;
drop policy if exists cm_attachments_update on storage.objects;
drop policy if exists cm_attachments_delete on storage.objects;
create policy cm_attachments_read   on storage.objects for select to public        using (bucket_id = 'cm-attachments');
create policy cm_attachments_write  on storage.objects for insert to authenticated with check (bucket_id = 'cm-attachments' and public.qbank_is_staff());
create policy cm_attachments_update on storage.objects for update to authenticated using (bucket_id = 'cm-attachments' and public.qbank_is_staff()) with check (bucket_id = 'cm-attachments' and public.qbank_is_staff());
create policy cm_attachments_delete on storage.objects for delete to authenticated using (bucket_id = 'cm-attachments' and public.qbank_is_admin());

-- Make PostgREST pick up the new tables / columns straight away.
notify pgrst, 'reload schema';
