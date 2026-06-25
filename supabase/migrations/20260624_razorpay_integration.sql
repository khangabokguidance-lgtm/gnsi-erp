-- supabase/migrations/[timestamp]_razorpay_integration.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the columns the three Edge Functions need on the existing
-- adm_fee_collections table, plus the idempotency constraint that makes a
-- webhook retry impossible to double-record.
--
-- Run with: supabase db push   (or paste into the SQL editor in dashboard)
-- ─────────────────────────────────────────────────────────────────────────────

-- New columns for tracking Razorpay's side of a payment.
-- All nullable since pre-existing rows (manual fee entries from before this
-- migration) won't have these — manual entry stays supported alongside
-- Razorpay payments.
alter table adm_fee_collections
  add column if not exists razorpay_order_id        text,
  add column if not exists razorpay_payment_link_id  text,
  add column if not exists razorpay_payment_id       text,
  add column if not exists payment_method            text,
  add column if not exists status                    text not null default 'paid';
  -- status default 'paid' preserves existing behavior for manual entries
  -- created before this migration — they were always implicitly "paid" the
  -- moment staff recorded them. New rows created by create-razorpay-order /
  -- create-payment-link explicitly insert status:'pending'.

-- The idempotency guarantee: a given Razorpay payment can only ever be
-- recorded once. A retried webhook hitting this constraint will fail the
-- INSERT (we use UPDATE in the webhook so this mainly guards against any
-- future code path that might try to insert directly).
create unique index if not exists adm_fee_collections_razorpay_payment_id_uidx
  on adm_fee_collections (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- Useful for the webhook's lookup-by-order-id / lookup-by-payment-link-id steps.
create index if not exists adm_fee_collections_razorpay_order_id_idx
  on adm_fee_collections (razorpay_order_id)
  where razorpay_order_id is not null;

create index if not exists adm_fee_collections_razorpay_payment_link_id_idx
  on adm_fee_collections (razorpay_payment_link_id)
  where razorpay_payment_link_id is not null;

-- Speeds up the "find existing pending row for this admission" guard in
-- create-razorpay-order.
create index if not exists adm_fee_collections_adm_app_id_status_idx
  on adm_fee_collections (adm_app_id, fee_type, status);

comment on column adm_fee_collections.status is
  'pending | paid | failed | amount_mismatch. Only razorpay-webhook may set this to paid — never set client-side.';
