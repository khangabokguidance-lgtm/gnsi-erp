-- Fee rows carry the explanation for a below-standard / overridden amount.
-- The app has written these two columns for a while, but no migration created
-- them, so a low-fee COURSE payment failed with:
--   "Could not find the 'override_note' column of 'adm_course_fees' in the schema cache".
alter table public.adm_course_fees add column if not exists override_note text;
alter table public.adm_flat_fees   add column if not exists underpayment_note text;

-- Make PostgREST pick the new columns up immediately.
notify pgrst, 'reload schema';
