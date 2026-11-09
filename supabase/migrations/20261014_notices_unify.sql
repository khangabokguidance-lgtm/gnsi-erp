-- Unify the ERP Notice tab and website notices on one `notices` table.
alter table public.notices
  add column if not exists body text,
  add column if not exists description text,
  add column if not exists notice_date date,
  add column if not exists publish_date date,
  add column if not exists expiry_date date,
  add column if not exists is_archived boolean not null default false,
  add column if not exists is_public boolean not null default false,
  add column if not exists status text not null default 'Published',
  add column if not exists category text,
  add column if not exists pinned boolean not null default false;

-- Backfill so rows created by either side are readable by both.
update public.notices set description = body where description is null and body is not null;
update public.notices set body = description where body is null and description is not null;
update public.notices set notice_date = coalesce(notice_date, publish_date, created_at::date) where notice_date is null;
-- Notices previously created from the website tab were public by definition.
update public.notices set is_public = true where is_public = false and body is not null and publish_date is null and category is null;
