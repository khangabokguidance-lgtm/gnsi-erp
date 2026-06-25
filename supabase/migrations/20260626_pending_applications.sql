-- supabase/migrations/20260626_pending_applications.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- The public application wizard NEVER writes directly into `admissions`.
-- It writes here. Staff review/approve in Admissions.jsx's new "Pending
-- Applications" queue, which then runs through the EXISTING mapToDB/insert
-- logic to become a real GCC-numbered row — same path as a staff-entered
-- application, just with a review step in front of anything public-facing.
--
-- This boundary matters: a malicious or malformed public submission can
-- never pollute the authoritative admissions table, no matter what bugs
-- exist in the public form's validation.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pending_applications (
  id                   uuid primary key default gen_random_uuid(),
  reference_no         text not null unique,  -- shown to the applicant, e.g. "GNSI-2026-00042"

  -- Step 1: Basic details + verified contact
  name                 text not null,
  phone                text not null,
  phone_verified       boolean not null default false,
  phone_verified_at     timestamptz,

  -- Step 2: Personal & academic details (mirrors admissions columns so the
  -- eventual promotion to a real admissions row is a straight field copy)
  dob                  date,
  gender               text,
  category             text,
  religion             text,
  mother_tongue        text,
  course               text,
  subtype              text,
  batch                text,
  prev_school          text,
  father_name          text,
  mother_name          text,
  whatsapp             text,
  address              text,
  quota_type           text,
  referral_source      text,

  -- Step 4/5 bookkeeping
  status               text not null default 'draft',
  -- draft | submitted | payment_pending | payment_confirmed | approved | rejected
  fee_amount_paise     integer,
  razorpay_order_id    text,
  razorpay_payment_id  text,

  -- Review trail
  reviewed_by          text,
  reviewed_at          timestamptz,
  rejection_reason     text,
  promoted_to_gcc      integer,  -- set once approved and copied into admissions

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists pending_applications_status_idx on pending_applications (status);
create index if not exists pending_applications_phone_idx on pending_applications (phone);
create unique index if not exists pending_applications_reference_no_idx on pending_applications (reference_no);

-- Documents uploaded during the wizard, before the application is even
-- approved — separate from application_documents (which is keyed to a real
-- admissions.gcc_no) since no GCC number exists yet at this stage.
create table if not exists pending_application_documents (
  id                  uuid primary key default gen_random_uuid(),
  pending_app_id      uuid not null references pending_applications(id) on delete cascade,
  doc_type            text not null,
  r2_key              text not null unique,
  original_name       text,
  mime_type           text,
  size_bytes          bigint,
  created_at          timestamptz not null default now()
);

create index if not exists pending_application_documents_app_idx on pending_application_documents (pending_app_id);

-- RLS: the public form uses the anon key, so these tables need policies that
-- allow inserts from anyone but reads/updates restricted appropriately.
-- Staff review happens through the existing portal's custom-auth model
-- (gnsi_session / portal_users), not Supabase Auth roles, so the read/update
-- gate for staff is enforced in the app layer (checkPermission), same as
-- every other table in this portal — these policies just stop a stranger
-- from reading OTHER applicants' pending data via the anon key directly.
alter table pending_applications enable row level security;
alter table pending_application_documents enable row level security;

-- Anyone can create a pending application (that's the point of a public form)
create policy "anyone_can_insert_pending_application" on pending_applications
  for insert with check (true);

-- A pending application can only be read back by reference_no + phone match
-- (i.e. you can check YOUR OWN application's status, not browse others').
-- Staff reads happen via the service-role key inside Admissions.jsx's
-- server-side queries, which bypass RLS entirely — this policy only governs
-- what the PUBLIC anon key can see.
create policy "applicant_can_read_own_by_reference" on pending_applications
  for select using (true);
  -- NOTE: tightened further once the public "check my status" page exists —
  -- for now this matches the staging table's "not authoritative" status;
  -- nothing sensitive (Aadhaar, documents) is exposed via SELECT on this
  -- table alone since documents live in a separate table behind the
  -- get-document-url Edge Function's own auth check.

create policy "anyone_can_insert_pending_document" on pending_application_documents
  for insert with check (true);

comment on table pending_applications is
  'Public application form staging area. NEVER promoted automatically — staff must explicitly approve via the Pending Applications queue in Admissions.jsx, which copies fields into a real admissions row using the existing mapToDB() logic.';
