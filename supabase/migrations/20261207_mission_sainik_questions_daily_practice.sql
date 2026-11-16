-- Mission Sainik 2027 — let the question bank also hold Daily Class Test ('daily') and Practice Bank ('practice') questions.
alter table public.mission_sainik_questions drop constraint if exists mission_sainik_questions_series_check;
alter table public.mission_sainik_questions add constraint mission_sainik_questions_series_check
  check (series in ('pre', 'mega', 'daily', 'practice'));
