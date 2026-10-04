-- Parent's WhatsApp number, editable by the parent from Parents Portal → My Profile.
alter table public.students add column if not exists whatsapp_no text;
