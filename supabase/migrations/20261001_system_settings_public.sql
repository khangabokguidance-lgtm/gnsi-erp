-- ============================================================================
-- 20261001_system_settings_public.sql — System Settings the whole portal reads
--
-- System Settings (admin) saves key/value rows in system_settings. The rest
-- of the portal now uses them: institute name/address/phone on receipts and
-- letterheads, portal title/logo/colours, login lockout, idle logout, fee due
-- day, attendance threshold, online-payment and WhatsApp switches.
--
-- The login screen and the parents' pages run without a staff session, so
-- this function hands them ONLY the non-secret keys below. API secrets
-- (SMS key, WhatsApp token, Razorpay secret, portal API key, SMTP login) are
-- never returned.
--
-- Safe to run more than once.
-- ============================================================================

create or replace function public.public_system_settings()
returns table (key text, value text)
language sql
stable
security definer
set search_path = public
as $$
  select s.key::text, s.value::text
  from public.system_settings s
  where s.key in (
    'school_name', 'school_address', 'school_phone', 'school_email', 'session_year',
    'institute_type', 'affiliation', 'principal_name', 'established_year',
    'session_timeout_minutes', 'max_login_attempts', 'lockout_duration_minutes',
    'primary_color', 'sidebar_color', 'accent_color', 'font_family', 'logo_url', 'favicon_url', 'portal_title',
    'whatsapp_enabled', 'sms_alerts', 'email_alerts', 'whatsapp_alerts',
    'academic_year_start', 'academic_year_end', 'exam_grading', 'attendance_threshold', 'fee_due_day',
    'classes_list', 'courses_list',
    'razorpay_enabled', 'razorpay_key', 'google_enabled'
  )
$$;
grant execute on function public.public_system_settings() to anon, authenticated;
