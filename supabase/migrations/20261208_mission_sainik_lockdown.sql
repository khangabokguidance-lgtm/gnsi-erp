-- Mission Sainik 2027 — lock the module's data to STAFF only.
-- Earlier migrations (20261201-20261207) used `using (true)`, some `to anon`, so signed-out visitors and parent / student
-- logins could read and write tasks, materials and (worse) the question bank with answers. Run this AFTER those files.
-- Requires public.qbank_is_staff() from 20260925_qbank_rls.sql. Safe to run more than once.

do $$
declare t text;
begin
  foreach t in array array['mission_sainik_tasks', 'mission_sainik_materials', 'mission_sainik_syllabus', 'mission_sainik_marks', 'mission_sainik_questions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.qbank_is_staff()) with check (public.qbank_is_staff())', t || '_staff', t);
  end loop;
end $$;

-- The shared private bucket: staff only (it was open to every authenticated account, parents and students included).
drop policy if exists teacher_materials_rw on storage.objects;
drop policy if exists teacher_materials_staff on storage.objects;
create policy teacher_materials_staff on storage.objects for all to authenticated
  using (bucket_id = 'teacher-materials' and public.qbank_is_staff())
  with check (bucket_id = 'teacher-materials' and public.qbank_is_staff());
