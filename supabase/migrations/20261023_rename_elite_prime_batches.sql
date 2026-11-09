-- ============================================================================
-- Rename the Foundation batches: Elite -> Udaan, Prime -> Pragati
-- ============================================================================
-- The app now uses the new names. This renames the names already saved:
--   * every text column called batch, subtype, class_name, course, class,
--     cls, section, batch_name, for_batch or sub_type, in every table:
--       Elite -> Udaan,  ELITE -> UDAAN,  Prime -> Pragati,  PRIME -> PRAGATI
--     and the same with a section suffix ("ELITE — ENG" -> "UDAAN — ENG");
--   * the Exams settings (Course/Subjects and saved exam configs), whose
--     keys are "ELITE" / "PRIME".
-- Only whole values are changed, so text like "Prime Factorization" or a
-- staff performance level is never touched.
--
-- Run it once, right after the app update that brings the new names goes
-- live. It is safe to run again (nothing is left to rename the second time).
-- The SQL editor is exempt from the app's fee locks, so fee tables update too.
-- ============================================================================

do $rename$
declare
  r record;
  n bigint;
  total bigint := 0;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.data_type in ('text', 'character varying')
      and c.column_name in ('batch', 'subtype', 'class_name', 'course', 'class', 'cls', 'section', 'batch_name', 'for_batch', 'sub_type')
  loop
    execute format($q$
      update public.%1$I set %2$I = case
          when %2$I = 'Elite' then 'Udaan'   when %2$I = 'ELITE' then 'UDAAN'
          when %2$I = 'Prime' then 'Pragati' when %2$I = 'PRIME' then 'PRAGATI'
          when %2$I like 'Elite — %%' then 'Udaan'   || substr(%2$I, 6)
          when %2$I like 'ELITE — %%' then 'UDAAN'   || substr(%2$I, 6)
          when %2$I like 'Prime — %%' then 'Pragati' || substr(%2$I, 6)
          when %2$I like 'PRIME — %%' then 'PRAGATI' || substr(%2$I, 6)
        end
      where %2$I in ('Elite', 'ELITE', 'Prime', 'PRIME')
         or %2$I like 'Elite — %%' or %2$I like 'ELITE — %%'
         or %2$I like 'Prime — %%' or %2$I like 'PRIME — %%'
    $q$, r.table_name, r.column_name);
    get diagnostics n = row_count;
    if n > 0 then
      raise notice '%.%: % row(s) renamed', r.table_name, r.column_name, n;
      total := total + n;
    end if;
  end loop;
  raise notice 'Batch names renamed in % row(s) in all', total;
end
$rename$;

-- Exams settings: the keys of Course/Subjects and of saved exam configs.
-- (Works whether system_settings.value is text or jsonb.)
do $settings$
declare typ text;
begin
  select data_type into typ from information_schema.columns
  where table_schema = 'public' and table_name = 'system_settings' and column_name = 'value';
  if typ is null then return; end if;
  execute format($q$
    update public.system_settings
    set value = (replace(replace(replace(replace(value::text,
                  '"ELITE"', '"UDAAN"'), '"PRIME"', '"PRAGATI"'),
                  '"Elite"', '"Udaan"'), '"Prime"', '"Pragati"'))::%s
    where key in ('course_subjects', 'exam_configs')
      and value::text ~ '"(ELITE|PRIME|Elite|Prime)"'
  $q$, case when typ = 'jsonb' then 'jsonb' when typ = 'json' then 'json' else 'text' end);
end
$settings$;

-- Any other setting that still mentions the old names is only reported, not
-- changed (it may be something else, such as a staff performance level).
do $report$
declare k text;
begin
  for k in select key from public.system_settings
           where key not in ('course_subjects', 'exam_configs')
             and value::text ~ '"(ELITE|PRIME|Elite|Prime)"'
  loop
    raise notice 'system_settings "%" still mentions Elite/Prime — check it', k;
  end loop;
end
$report$;
