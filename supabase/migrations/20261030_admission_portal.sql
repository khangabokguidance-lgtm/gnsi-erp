-- Online admission portal: applicants apply at /apply, pay the admission fee through Razorpay, upload documents and
-- track the application at /apply-status. Staff review everything in Admissions → Admission portal.
--
-- Public visitors never touch these tables directly: the api/entrance functions (adm-* actions) use the service role,
-- identify an applicant by reference number + date of birth and decide the fee on the server. Staff read and write
-- through the normal Supabase client; the policies below allow signed-in staff only (so applicants' personal details
-- are not readable with the public anon key).
--
-- This is separate from the older, unused `pending_applications` staging table (20260626).

create table if not exists public.portal_applications (
  id               uuid primary key default gen_random_uuid(),
  reference_no     text not null unique,                 -- "AP26-0001", shown to the applicant
  session          text,                                 -- admission session, e.g. 2026-2027
  status           text not null default 'Submitted',    -- Submitted | Under review | Docs requested | Approved | Rejected | Withdrawn
  student_name     text not null,
  dob              date not null,
  phone            text not null,
  email            text,
  course           text,
  batch            text,
  hostel_type      text,
  form             jsonb not null default '{}'::jsonb,   -- the full application as submitted
  photo_path       text,                                 -- storage path (bucket gnsi)
  -- fee
  fee_amount       numeric not null default 0,           -- decided by the server from fee_structures
  fee_status       text not null default 'Unpaid',       -- Unpaid | Paid | Waived | Refund due | Refunded
  payment_order_id text,
  payment_id       text,
  payment_mode     text,                                 -- Online | Cash | UPI ...
  fee_paid_on      date,
  fee_recorded     boolean not null default false,       -- true once the payment is in adm_fee_collections / accounts
  refund_ref       text,
  refunded_on      date,
  -- review
  public_note      text,                                 -- message shown to the applicant (e.g. which document is needed)
  reviewed_by      text,
  reviewed_at      timestamptz,
  rejection_reason text,
  promoted_gcc     integer,                              -- admissions.gcc_no once approved
  source           text not null default 'online',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists portal_applications_status_idx on public.portal_applications (status);
create index if not exists portal_applications_phone_idx on public.portal_applications (phone);
create unique index if not exists portal_applications_payment_id_uidx on public.portal_applications (payment_id) where payment_id is not null;

create table if not exists public.portal_application_docs (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.portal_applications(id) on delete cascade,
  doc_type       text not null,
  storage_path   text not null,
  file_name      text,
  mime           text,
  size_bytes     bigint,
  status         text not null default 'Uploaded',       -- Uploaded | Verified | Rejected
  remark         text,
  verified_by    text,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists portal_application_docs_app_idx on public.portal_application_docs (application_id);

-- The audit trail: every submission, payment, upload, review decision and note, with who and when.
create table if not exists public.portal_application_events (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.portal_applications(id) on delete cascade,
  at             timestamptz not null default now(),
  actor          text,                                   -- 'applicant', 'system' or the staff member's name
  action         text not null,
  detail         text
);
create index if not exists portal_application_events_app_idx on public.portal_application_events (application_id, at);

alter table public.portal_applications       enable row level security;
alter table public.portal_application_docs   enable row level security;
alter table public.portal_application_events enable row level security;

-- Staff only. Uses qbank_is_staff() (20260925_qbank_rls.sql) when it exists; otherwise any signed-in user.
do $$
declare t text; cond text;
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'qbank_is_staff') then
    cond := 'public.qbank_is_staff()';
  else
    cond := 'auth.uid() is not null';
  end if;
  foreach t in array array['portal_applications', 'portal_application_docs', 'portal_application_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('create policy %I on public.%I for all using (%s) with check (%s)', t || '_staff_all', t, cond, cond);
  end loop;
end $$;
