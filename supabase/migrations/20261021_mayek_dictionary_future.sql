-- ============================================================================
-- Mayek Tool translation: add "future" -> ꯐ꯭ꯌꯨꯇꯥꯏꯜ (BMEI04: fy_utaIL)
-- ============================================================================
-- The Translation tab checks the school's dictionary (mayek_dictionary)
-- before any translation service, so a verified entry here is used as-is
-- whenever "future" is translated, and is passed to the AI as a glossary word
-- inside longer sentences.
--
-- APUN IYEK sits between PHAM and YANG (ꯐ꯭ꯌ), the Unicode order — see
-- src/meetei_mayek.js.
--
-- Safe to run more than once.
-- ============================================================================

insert into public.mayek_dictionary
  (entry_type, english, english_norm, bmei04, mayek_unicode, source, needs_review)
values
  ('word', 'future', 'future', 'fy_utaIL', 'ꯐ꯭ꯌꯨꯇꯥꯏꯜ', 'manual', false)
on conflict (english_norm) do update set
  entry_type    = excluded.entry_type,
  english       = excluded.english,
  bmei04        = excluded.bmei04,
  mayek_unicode = excluded.mayek_unicode,
  source        = excluded.source,
  needs_review  = false;
