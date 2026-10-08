-- ============================================================================
-- Meetei Mayek: put APUN IYEK (꯭) between the two consonants it joins
-- ============================================================================
-- BMEI04 types APUN IYEK after a cluster ("fy_" draws ꯐ꯭ꯌ), but Unicode puts
-- it between the consonants. The app used to keep the typing order, so text
-- converted to Unicode before this fix has it one letter late:
--   ꯍꯋ꯭ꯥꯏ  should be  ꯍ꯭ꯋꯥꯏ        ꯐꯌ꯭ꯨꯇꯥꯢꯜ  should be  ꯐ꯭ꯌꯨꯇꯥꯏꯜ
-- The converter (src/meetei_mayek.js) is fixed; this repairs saved text.
--
--   * Unicode text of unknown origin (questions, AI/translator dictionary
--     entries): only the cases that can never be correct Unicode are fixed —
--     two consonants then APUN followed by a vowel sign, lonsum, punctuation,
--     a space or the end. Text that is already right is left alone.
--   * Dictionary entries typed in BMEI04 (their bmei04 is the source of
--     truth): Meetei Mayek is rebuilt the way the converter now does it, and
--     capital I becomes ꯏ (it used to give ꯢ).
--   * Dictionary entries whose BMEI04 was worked out from Unicode: bmei04 is
--     rewritten in typing order (ꯐ꯭ꯌ -> fy_, not f_y).
--
-- Safe to run more than once: the BMEI04-typed rebuild runs only the first
-- time (recorded in public.mayek_fix_log); the rest leaves correct text alone.
-- ============================================================================

create table if not exists public.mayek_fix_log (name text primary key, ran_at timestamptz not null default now());
alter table public.mayek_fix_log enable row level security;  -- no policies: not reachable from the app

-- Unambiguous repair, for any Unicode Meetei Mayek text.
create or replace function pg_temp.fix_apun(t text) returns text
language sql immutable as $$
  select regexp_replace(t,
    '([ꯀ-ꯍꯐꯒ-ꯚ])([ꯀ-ꯍꯐꯒ-ꯚ])꯭(?=[ꯛ-꯭꯰-꯿]|[^ꯀ-꯿]|$)',
    '\1' || U&'\ABED' || '\2', 'g')
$$;

-- Full repair, for Unicode converted straight from BMEI04 keystrokes.
create or replace function pg_temp.fix_apun_typed(t text) returns text
language sql immutable as $$
  select replace(regexp_replace(t,
    '([ꯀ-ꯍꯐꯒ-ꯚ])([ꯀ-ꯍꯐꯒ-ꯚ])꯭',
    '\1' || U&'\ABED' || '\2', 'g'), U&'\ABE2', U&'\ABCF')
$$;

-- ── Question Bank ───────────────────────────────────────────────────────────
-- BMEI04 rows hold Latin keystrokes and are converted when shown; only the
-- Unicode rows need repair.
update public.qbank_questions set
  question_mayek = pg_temp.fix_apun(question_mayek),
  option_a_mayek = pg_temp.fix_apun(option_a_mayek),
  option_b_mayek = pg_temp.fix_apun(option_b_mayek),
  option_c_mayek = pg_temp.fix_apun(option_c_mayek),
  option_d_mayek = pg_temp.fix_apun(option_d_mayek)
where coalesce(question_mayek_font, '') <> 'bmei04'
  and concat(question_mayek, option_a_mayek, option_b_mayek, option_c_mayek, option_d_mayek) like '%' || U&'\ABED' || '%';

-- ── Dictionary ──────────────────────────────────────────────────────────────
-- Typed in BMEI04: rebuild the Meetei Mayek from the keystrokes' order.
-- Only once: on text that is already rebuilt this would move APUN again.
do $fix$
begin
  if exists (select 1 from public.mayek_fix_log where name = 'apun_order_typed') then return; end if;
  update public.mayek_dictionary
  set mayek_unicode = pg_temp.fix_apun_typed(mayek_unicode)
  where coalesce(source, '') not in ('translator_correction', 'question_bank')
    and coalesce(source, '') not like '%\_draft'
    and coalesce(source, '') not like '%\_reviewed'
    and mayek_unicode is distinct from pg_temp.fix_apun_typed(mayek_unicode);
  insert into public.mayek_fix_log(name) values ('apun_order_typed');
end
$fix$;

-- Unicode is the source of truth: repair it, then write bmei04 in typing order.
update public.mayek_dictionary
set mayek_unicode = pg_temp.fix_apun(mayek_unicode),
    bmei04 = case when source = 'question_bank' then bmei04
                  else regexp_replace(bmei04, '([kslmpnctwyhfgrbjdzHvYJGD])_([kslmpnctwyhfgrbjdzHvYJGD])', '\1\2_', 'g') end
where (source in ('translator_correction', 'question_bank') or source like '%\_draft' or source like '%\_reviewed')
  and (mayek_unicode is distinct from pg_temp.fix_apun(mayek_unicode)
       or (source <> 'question_bank' and bmei04 ~ '[kslmpnctwyhfgrbjdzHvYJGD]_[kslmpnctwyhfgrbjdzHvYJGD]'));
