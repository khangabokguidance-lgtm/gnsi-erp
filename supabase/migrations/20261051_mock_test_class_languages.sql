-- ============================================================================
-- Mock Test Analyzer: language of each class (English / Meitei Mayek)
-- ============================================================================
-- Used by the Self-Study Groups language filter. A class with no row here falls back to the language guessed from
-- its name ("English" -> English, "Manipuri" / "MM" -> Meitei Mayek); a row here always wins. One row per class,
-- the same for every series. Without this table the setting is kept in the browser only (the app falls back
-- automatically). Safe to run more than once.
-- ============================================================================

create table if not exists public.mock_test_class_languages (
  batch       text        primary key,
  language    text        not null check (language in ('English', 'Meitei Mayek')),
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table public.mock_test_class_languages enable row level security;

drop policy if exists mock_test_class_languages_all on public.mock_test_class_languages;
create policy mock_test_class_languages_all on public.mock_test_class_languages
  for all to anon, authenticated using (true) with check (true);
