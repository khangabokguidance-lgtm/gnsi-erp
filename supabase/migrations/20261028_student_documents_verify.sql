-- Student locker: let each document carry a verification status.
-- The Students module already saves documents in `student_documents` (student_id, doc_type, file_name, storage_path).
-- The Admissions "Locker" adds a Verified / Rejected state on top. All columns are optional, so the existing
-- screens keep working and the locker simply treats a missing status as "Uploaded".
alter table public.student_documents
  add column if not exists status text default 'Uploaded',
  add column if not exists verified_by text,
  add column if not exists verified_at timestamptz,
  add column if not exists note text,
  add column if not exists mime text,
  add column if not exists size_bytes bigint;
