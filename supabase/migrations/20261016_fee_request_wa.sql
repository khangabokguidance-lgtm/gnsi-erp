-- Track the automatic WhatsApp notices so each is sent once.
alter table public.fee_payment_requests add column if not exists wa_pending_sent_at   timestamptz;
alter table public.fee_payment_requests add column if not exists wa_collected_sent_at timestamptz;
notify pgrst, 'reload schema';
