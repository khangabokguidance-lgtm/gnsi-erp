-- Online / counter registration for the entrance exam (NTA-style form, Razorpay payment, admit card).
-- Extra columns on entrance_candidates. All optional, so the existing Entrance module keeps working; the
-- api/entrance functions use the service role and so do not depend on any RLS policy for anonymous visitors.
alter table public.entrance_candidates
  add column if not exists signature_url     text,          -- storage path of the candidate's signature (bucket gnsi)
  add column if not exists reg_details       jsonb,         -- nationality, alt phone, state/district/pincode, medium, PwD, ...
  add column if not exists declared_at       timestamptz,
  add column if not exists source            text default 'staff',   -- 'online' | 'staff'
  add column if not exists payment_order_id  text,
  add column if not exists payment_id        text;

create index if not exists entrance_candidates_app_no_idx on public.entrance_candidates (application_no);
