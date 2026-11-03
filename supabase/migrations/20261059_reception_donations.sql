-- ============================================================================
-- Reception -> Donations: donation records, each with uploaded documents that
-- carry the amount paid.
-- ============================================================================
-- reception_donations           one row per donation (donor, purpose, mode, who took it)
-- reception_donation_documents  one row per uploaded document (receipt, cheque
--                               photo, letter...) with the amount paid shown on it
-- The donation total is the sum of its documents' amounts_paid; donations with no
-- documents can still carry their own amount_paid.
-- Private storage bucket 'donation-docs'. Safe to run more than once.
-- ============================================================================

create table if not exists public.reception_donations (
  id            uuid primary key default gen_random_uuid(),
  donor_name    text not null,
  phone         text,
  student_name  text,
  gcc_no        text,
  purpose       text,
  donation_date date not null default current_date,
  pay_mode      text not null default 'Cash',
  txn_ref       text,
  amount_paid   numeric(12,2) not null default 0 check (amount_paid >= 0),
  receipt_no    text,
  remarks       text,
  collected_by  text not null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists reception_donations_date_idx on public.reception_donations (donation_date desc);

create table if not exists public.reception_donation_documents (
  id           uuid primary key default gen_random_uuid(),
  donation_id  uuid not null references public.reception_donations(id) on delete cascade,
  doc_type     text not null default 'Receipt',
  file_name    text,
  storage_path text not null,
  amount_paid  numeric(12,2) not null default 0 check (amount_paid >= 0),
  note         text,
  uploaded_by  text,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists reception_donation_docs_idx on public.reception_donation_documents (donation_id);

alter table public.reception_donations enable row level security;
drop policy if exists reception_donations_all on public.reception_donations;
create policy reception_donations_all on public.reception_donations for all to authenticated using (true) with check (true);

alter table public.reception_donation_documents enable row level security;
drop policy if exists reception_donation_docs_all on public.reception_donation_documents;
create policy reception_donation_docs_all on public.reception_donation_documents for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('donation-docs', 'donation-docs', false) on conflict (id) do nothing;
drop policy if exists donation_docs_files on storage.objects;
create policy donation_docs_files on storage.objects for all to authenticated
  using (bucket_id = 'donation-docs') with check (bucket_id = 'donation-docs');
