-- Expenditure reason: a reason of at least 5 characters (1 word) is enough to save.
-- Lowers the limits the ACC-005 trigger reads from accounting_controls (were 15 characters / 3 words).
-- Safe to run more than once.
alter table public.accounting_controls alter column min_reason_length set default 5;
alter table public.accounting_controls alter column min_reason_words  set default 1;
update public.accounting_controls set min_reason_length = 5, min_reason_words = 1 where id = 1;
