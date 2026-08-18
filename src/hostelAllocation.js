// hostelAllocation.js — the one place that writes hostel_allocations, and
// keeps students.house in sync as a read-only mirror of it.
// ─────────────────────────────────────────────────────────────────────────────
// hostel_allocations is the real record of a student's room assignment:
//   id, student_id, student_name, gcc_no, class_name,
//   hostel_name (NOT NULL), room_number (NOT NULL), bed_number,
//   allotment_date (NOT NULL), status, remarks, created_at
//
// students.house is kept ONLY as a denormalized mirror for the ~150
// existing reads across Hostel.jsx/Students.jsx (filters, exports,
// reports, roster displays) that were built against that field before
// hostel_allocations existed as a real, populated table. Those reads stay
// unchanged; what changes is that nothing should write students.house
// directly anymore — every assignment goes through allocateStudent() or
// vacateStudent() below, which write hostel_allocations first and mirror
// the result into students.house, so the two can't drift apart the way
// they did before (see mismatchDetector.js's house_no_allocation check,
// which exists specifically to catch that drift).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

function todayStr() {
  return new Date().toLocaleDateString('en-CA')   // YYYY-MM-DD, local timezone
}

/**
 * Assign (or reassign) one student to a hostel/room. Upserts the
 * hostel_allocations row (one per student — a reassignment updates the
 * existing row rather than creating a second one) and mirrors hostel_name
 * onto students.house.
 *
 * @param {object} student - needs at least { id, name, gcc_no, class_name }
 * @param {object} allocation - { hostelName, roomNumber, bedNumber?, allotmentDate?, status? }
 */
export async function allocateStudent(student, { hostelName, roomNumber, bedNumber = null, allotmentDate = null, status = 'Active', remarks = null }) {
  if (!student?.id) throw new Error('allocateStudent: student.id is required')
  if (!hostelName) throw new Error('allocateStudent: hostelName is required')
  if (!roomNumber) throw new Error('allocateStudent: roomNumber is required (hostel_allocations.room_number is NOT NULL)')

  // Is there already a row for this student? hostel_allocations has no
  // enforced unique constraint on student_id (confirmed nullable, no
  // unique index) — select-then-update/insert rather than assuming
  // onConflict works, since an upsert with no matching constraint would
  // either fail or (worse) silently insert a duplicate row per student.
  const { data: existing, error: selErr } = await supabase
    .from('hostel_allocations')
    .select('id')
    .eq('student_id', student.id)
    .maybeSingle()
  if (selErr) throw selErr

  const payload = {
    student_id: student.id,
    student_name: student.name || null,
    gcc_no: student.gcc_no ? String(student.gcc_no) : null,
    class_name: student.class_name || null,
    hostel_name: hostelName,
    room_number: roomNumber,
    bed_number: bedNumber,
    allotment_date: allotmentDate || todayStr(),
    status,
    remarks,
  }

  const { error: writeErr } = existing
    ? await supabase.from('hostel_allocations').update(payload).eq('id', existing.id)
    : await supabase.from('hostel_allocations').insert([payload])
  if (writeErr) throw writeErr

  // Mirror onto students.house — this is the ONLY place students.house
  // should be written from now on.
  const { error: mirrorErr } = await supabase.from('students').update({ house: hostelName }).eq('id', student.id)
  if (mirrorErr) throw mirrorErr

  return { ok: true }
}

/**
 * Clear a student's hostel allocation entirely — deletes the
 * hostel_allocations row and clears students.house to null. Used when
 * "unassigning" a student rather than moving them to a different house.
 */
export async function vacateStudent(studentId) {
  if (!studentId) throw new Error('vacateStudent: studentId is required')
  const { error: delErr } = await supabase.from('hostel_allocations').delete().eq('student_id', studentId)
  if (delErr) throw delErr
  const { error: mirrorErr } = await supabase.from('students').update({ house: null }).eq('id', studentId)
  if (mirrorErr) throw mirrorErr
  return { ok: true }
}

/**
 * Bulk-assign many students to the same hostel at once (e.g. "assign all
 * unassigned students to House X"). room_number can't be meaningfully set
 * per-student in a bulk action, so this uses a placeholder ("TBD") that
 * staff fill in per-student afterward via allocateStudent — the bulk
 * action's job is just getting everyone into the right house immediately
 * without blocking on room detail.
 *
 * Writes are batched (one insert/update pass, not N round trips), but
 * still needs to know which of these students already have an allocation
 * row (reassignment → update) vs not (new → insert), so this fetches
 * existing rows for the batch first.
 */
export async function bulkAllocateStudents(students, hostelName) {
  if (!hostelName) throw new Error('bulkAllocateStudents: hostelName is required')
  if (!students?.length) return { ok: true, count: 0 }

  const ids = students.map(s => s.id)
  const { data: existingRows, error: selErr } = await supabase
    .from('hostel_allocations')
    .select('id, student_id')
    .in('student_id', ids)
  if (selErr) throw selErr
  const existingByStudent = new Map((existingRows || []).map(r => [r.student_id, r.id]))

  const toInsert = []
  const updates = []
  const today = todayStr()
  for (const s of students) {
    const base = {
      student_id: s.id,
      student_name: s.name || null,
      gcc_no: s.gcc_no ? String(s.gcc_no) : null,
      class_name: s.class_name || null,
      hostel_name: hostelName,
      room_number: 'TBD',
      bed_number: null,
      allotment_date: today,
      status: 'Active',
    }
    const existingId = existingByStudent.get(s.id)
    if (existingId) updates.push({ id: existingId, ...base })
    else toInsert.push(base)
  }

  if (toInsert.length) {
    const { error } = await supabase.from('hostel_allocations').insert(toInsert)
    if (error) throw error
  }
  // Updates still go one at a time — Supabase has no bulk-update-with-
  // per-row-different-values in one call short of upsert-on-a-real-
  // constraint, which this table doesn't have (see allocateStudent's
  // comment). Bulk reassignment of already-allocated students is the
  // less common case (most bulk-assigns target unassigned students), so
  // this doesn't need to be as tight as the insert path.
  for (const u of updates) {
    const { id, ...payload } = u
    const { error } = await supabase.from('hostel_allocations').update(payload).eq('id', id)
    if (error) throw error
  }

  const { error: mirrorErr } = await supabase.from('students').update({ house: hostelName }).in('id', ids)
  if (mirrorErr) throw mirrorErr

  return { ok: true, count: students.length }
}

/**
 * One-time backfill helper — for students whose students.house is already
 * set (from before this module existed) but who have no hostel_allocations
 * row at all. Creates a minimal row with room_number: 'TBD' so it satisfies
 * the NOT NULL constraint; does NOT touch students.house since it's
 * already correct for these students. Distinct from bulkAllocateStudents
 * (which also sets the hostel_name, for a fresh assignment) — this only
 * fills the gap for students who already have the real hostel_name value
 * sitting in students.house.
 */
export async function backfillMissingAllocations(students) {
  const withHouse = (students || []).filter(s => s.house)
  if (!withHouse.length) return { ok: true, synced: 0, total: 0 }

  const ids = withHouse.map(s => s.id)
  const { data: existingRows, error: selErr } = await supabase
    .from('hostel_allocations')
    .select('student_id')
    .in('student_id', ids)
  if (selErr) throw selErr
  const alreadyAllocated = new Set((existingRows || []).map(r => r.student_id))

  const toInsert = withHouse
    .filter(s => !alreadyAllocated.has(s.id))
    .map(s => ({
      student_id: s.id,
      student_name: s.name || null,
      gcc_no: s.gcc_no ? String(s.gcc_no) : null,
      class_name: s.class_name || null,
      hostel_name: s.house,
      room_number: 'TBD',
      bed_number: null,
      allotment_date: todayStr(),
      status: 'Active',
    }))

  if (!toInsert.length) return { ok: true, synced: 0, total: withHouse.length }

  // Insert in batches to keep each request a reasonable size.
  const BATCH = 200
  let synced = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH)
    const { error } = await supabase.from('hostel_allocations').insert(chunk)
    if (error) throw error
    synced += chunk.length
  }
  return { ok: true, synced, total: withHouse.length }
}