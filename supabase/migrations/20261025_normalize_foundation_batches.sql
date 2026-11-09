-- ============================================================================
-- Foundation batches: one spelling for every student — Udaan and Pragati
-- ============================================================================
-- Students saved as "UDAAN", "udaan ", "Udaan — ENG", "Elite", "ELITE — HIN"
-- become batch "Udaan"; "PRAGATI", "Prime", "PRIME — ENG" … become "Pragati".
-- A section suffix (ENG, HIN …) is kept in class_name when that is empty.
-- Students with a blank course get course "Foundation".
-- A student with no batch whose class_name holds the batch name gets that batch.
-- Safe to run more than once.
-- ============================================================================

update students
set class_name = case
      when coalesce(trim(class_name), '') = '' and batch ~ '[—–-]'
        then nullif(trim(regexp_replace(batch, '^\s*\S+\s*[—–-]\s*', '')), '')
      else class_name end,
    batch = case when lower(trim(batch)) ~ '^(elite|udaan)' then 'Udaan' else 'Pragati' end,
    course = case when coalesce(trim(course), '') = '' then 'Foundation' else course end
where lower(trim(batch)) ~ '^(elite|udaan|prime|pragati)(\s*$|\s*[—–-])'
  and batch not in ('Udaan', 'Pragati');

update students
set class_name = case when lower(trim(class_name)) in ('elite', 'udaan') then 'Udaan' else 'Pragati' end,
    batch = case when lower(trim(class_name)) in ('elite', 'udaan') then 'Udaan' else 'Pragati' end,
    course = case when coalesce(trim(course), '') = '' then 'Foundation' else course end
where lower(trim(class_name)) in ('elite', 'udaan', 'prime', 'pragati')
  and coalesce(trim(batch), '') = ''
  and coalesce(trim(course), '') in ('', 'Foundation');

select batch, count(*) as students
from students
where lower(batch) ~ '(elite|udaan|prime|pragati)'
group by batch
order by batch;
