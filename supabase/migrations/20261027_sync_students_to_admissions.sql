-- Keep an application in step with its student record, whoever edits the student.
-- Attendance, Hostel, Exams, the dashboard etc. update `students` directly, so the matching `admissions` row
-- (read by profile cards, house occupancy and the Applications tab) used to drift out of date. This copies the
-- shared fields from the student to the admission (not class_name / parent_phone — the Admissions form never records them — and not session, which an application keeps) of the same GCC after every change to them.
-- Safe by design: only fills from non-blank student values, only touches a row that actually differs, and any
-- error inside is swallowed with a warning so it can never block a student save. Admissions → Students is still
-- done by the app, so there is no loop.
create or replace function public.sync_student_to_admission()
returns trigger language plpgsql as $$
begin
  begin
    update public.admissions a set
      applicant_name = coalesce(nullif(new.name, ''), a.applicant_name),
      dob            = coalesce(new.dob, a.dob),
      gender         = coalesce(nullif(new.gender, ''), a.gender),
      blood_group    = coalesce(nullif(new.blood_group, ''), a.blood_group),
      course         = coalesce(nullif(new.course, ''), a.course),
      batch          = coalesce(nullif(new.batch, ''), a.batch),
      house          = coalesce(nullif(new.house, ''), a.house),
      hostel_type    = coalesce(nullif(new.hostel_type, ''), a.hostel_type),
      father_name    = coalesce(nullif(new.father_name, ''), a.father_name),
      mother_name    = coalesce(nullif(new.mother_name, ''), a.mother_name),
      phone          = coalesce(nullif(new.phone, ''), a.phone),
      address        = coalesce(nullif(new.address, ''), a.address),
      prev_school    = coalesce(nullif(new.prev_school, ''), a.prev_school)
    where a.gcc_no::text = new.gcc_no::text
      and (a.applicant_name, a.dob, a.gender, a.blood_group, a.course, a.batch, a.house, a.hostel_type,
           a.father_name, a.mother_name, a.phone, a.address, a.prev_school)
          is distinct from
          (coalesce(nullif(new.name, ''), a.applicant_name), coalesce(new.dob, a.dob), coalesce(nullif(new.gender, ''), a.gender),
           coalesce(nullif(new.blood_group, ''), a.blood_group), coalesce(nullif(new.course, ''), a.course),
           coalesce(nullif(new.batch, ''), a.batch),
           coalesce(nullif(new.house, ''), a.house), coalesce(nullif(new.hostel_type, ''), a.hostel_type),
           coalesce(nullif(new.father_name, ''), a.father_name),
           coalesce(nullif(new.mother_name, ''), a.mother_name), coalesce(nullif(new.phone, ''), a.phone),
           coalesce(nullif(new.address, ''), a.address),
           coalesce(nullif(new.prev_school, ''), a.prev_school));
  exception when others then
    raise warning 'sync_student_to_admission skipped for GCC %: %', new.gcc_no, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_sync_student_to_admission on public.students;
create trigger trg_sync_student_to_admission
  after update of name, dob, gender, blood_group, course, batch, house, hostel_type,
                  father_name, mother_name, phone, address, prev_school
  on public.students
  for each row execute function public.sync_student_to_admission();
