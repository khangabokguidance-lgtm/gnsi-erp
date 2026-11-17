-- Mission Sainik 2027 — number of questions each panel member must upload. Run after 20261214. Safe to re-run.
alter table public.mission_sainik_panel add column if not exists question_quota integer check (question_quota is null or question_quota >= 0);
