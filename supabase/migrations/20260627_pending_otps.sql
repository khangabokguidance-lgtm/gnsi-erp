-- supabase/migrations/20260627_pending_otps.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Needed because we switched OTP delivery from Supabase Auth's built-in
-- phone provider to calling MSG91 directly (see send-application-otp /
-- verify-application-otp). Since we're no longer using Supabase Auth to
-- generate/verify the code, we store and check it ourselves here.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pending_otps (
  phone        text primary key,   -- normalized as 91XXXXXXXXXX, no '+'
  otp          text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  created_at   timestamptz not null default now()
);

-- RLS: this table is only ever touched by Edge Functions using the service
-- role key, which bypasses RLS entirely — but enabling RLS with no public
-- policies means even a leaked anon key can never read or write OTP codes.
alter table pending_otps enable row level security;

comment on table pending_otps is
  'Short-lived OTP storage for the public application wizard, delivered via MSG91. Only Edge Functions (service role) read/write this table — no public policies exist by design.';
