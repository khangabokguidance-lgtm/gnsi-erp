// studentProfileLoader.js — the single cross-module student-profile query.
// ─────────────────────────────────────────────────────────────────────────────
// Extracted out of Student360.jsx so the SAME query logic backs both:
//   - the on-screen Student 360° view (one student, user-triggered)
//   - mismatchScanner.js's background auto-scan (many students, timer-
//     triggered)
// If this lived only inside Student360.jsx, the scanner would need its own
// copy — and a future edit to one (e.g. fixing the attendance fallback
// keys) could silently drift from the other, which is exactly the kind of
// mismatch this whole feature exists to catch elsewhere in the app.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

export async function loadFullProfile(student) {
  const gcc = String(student.gcc_no || '')
  const id = student.id

  // Attendance — attendance_records is NOT consistently keyed by
  // student_id alone (confirmed in Students.jsx's own profile loader);
  // some rows only have gcc_no or student_name populated. Query all three
  // and dedupe by session_id+status, same fallback Students.jsx uses, or
  // this would UNDERCOUNT attendance for exactly the students this tool
  // exists to catch mismatches for.
  const attQueries = [supabase.from('attendance_records').select('status,session_id').eq('student_id', id).not('session_id', 'is', null).limit(300)]
  if (gcc) attQueries.push(supabase.from('attendance_records').select('status,session_id').eq('gcc_no', gcc).not('session_id', 'is', null).limit(300))
  attQueries.push(supabase.from('attendance_records').select('status,session_id').eq('student_name', student.name).not('session_id', 'is', null).limit(300))

  const [
    admission,
    admFeeCols, admFlatFees, admCourseFees,
    ...attResults
  ] = await Promise.all([
    // Admissions — original application record, by GCC no
    gcc ? supabase.from('admissions').select('*').eq('gcc_no', gcc).maybeSingle() : Promise.resolve({ data: null }),

    // Fees — three payment tables Fees.jsx/Admissions.jsx write to
    gcc ? supabase.from('adm_fee_collections').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: false }) : Promise.resolve({ data: [] }),
    gcc ? supabase.from('adm_flat_fees').select('*').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false).order('pay_date', { ascending: false }) : Promise.resolve({ data: [] }),
    gcc ? supabase.from('adm_course_fees').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: false }) : Promise.resolve({ data: [] }),

    ...attQueries,
  ])

  const [
    hostelAlloc, disciplineRecs, sickbayRecs, leaveRecs,
    gatePasses, enquiries, parentItems, complaints,
  ] = await Promise.all([
    // Hostel — current allocation. Deliberately NOT using an embedded
    // join (e.g. select('*,hostel_rooms(...)')) here: that syntax only
    // resolves if PostgREST can find a single, unambiguous FK relationship
    // between hostel_allocations and hostel_rooms in schema metadata. If
    // that relationship is missing/ambiguous/renamed, PostgREST errors on
    // EVERY row, and since Supabase errors aren't exceptions, that error
    // was previously silently treated as "no hostel record" for every
    // student — which is exactly the false-positive bug this replaces.
    // Room details are joined manually below instead.
    supabase.from('hostel_allocations').select('*').eq('student_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('discipline_records').select('*').eq('student_id', id).order('date', { ascending: false }),
    supabase.from('sickbay_records').select('*').eq('student_id', id).order('date', { ascending: false }),
    supabase.from('leave_records').select('*').eq('student_id', id).order('from_date', { ascending: false }).limit(20),

    // Reception — gate passes, enquiries, parent items, complaints
    supabase.from('reception_gatepasses').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('reception_enquiries').select('*').or(`student_name.eq.${student.name},phone.eq.${student.phone || '__'}`).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('reception_parent_items').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('reception_complaints').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
  ])

  // Housemaster for this student's house — real data from the housemasters
  // table (same one Hostel.jsx queries), not previously wired into this
  // profile at all. Only meaningful if the student has a house assigned.
  const housemaster = student.house
    ? await supabase.from('housemasters').select('name,house,phone,status').eq('house', student.house).eq('status', 'Active').maybeSingle()
    : { data: null }

  // House occupancy — how many OTHER active students share this house, so
  // the Hostel card can show real capacity context instead of just this
  // one student's own allocation row.
  const houseOccupancy = student.house
    ? await supabase.from('students').select('id', { count: 'exact', head: true }).eq('house', student.house).is('deleted_at', null).neq('status', 'Inactive').neq('status', 'Dropout')
    : { count: null }

  // Dedupe attendance across the three lookup keys by session_id+status,
  // same as Students.jsx.
  const seen = new Set()
  const attRows = []
  attResults.forEach(({ data }) => {
    (data || []).forEach(r => {
      const key = `${r.session_id}|${r.status}`
      if (seen.has(key)) return
      seen.add(key); attRows.push(r)
    })
  })

  // Exam marks — queried separately since it wasn't part of either
  // Promise.all batch above.
  const examMarks = await supabase.from('exam_marks').select('exam_type_id,exam_date,subject,marks_obtained').eq('student_id', id).order('exam_date', { ascending: false })

  // Surface (don't swallow) query errors that would otherwise silently
  // read as "no record" and feed false-positive mismatch flags. This
  // logs to console rather than throwing, so one bad table/query doesn't
  // take down the whole profile load for a student.
  ;[
    ['admission', admission], ['adm_fee_collections', admFeeCols], ['adm_flat_fees', admFlatFees],
    ['adm_course_fees', admCourseFees], ['hostel_allocations', hostelAlloc], ['discipline_records', disciplineRecs],
    ['sickbay_records', sickbayRecs], ['leave_records', leaveRecs], ['reception_gatepasses', gatePasses],
    ['reception_enquiries', enquiries], ['reception_parent_items', parentItems], ['reception_complaints', complaints],
    ['exam_marks', examMarks],
  ].forEach(([label, result]) => {
    if (result?.error) console.error(`loadFullProfile(${student.name || id}): ${label} query failed —`, result.error.message || result.error)
  })

  // Room details for the current allocation, fetched as a plain lookup
  // rather than an embedded join (see note above the hostel_allocations
  // query for why).
  const hostelRow = hostelAlloc.data?.[0] || null
  let hostelRoom = null
  if (hostelRow?.room_id) {
    const roomResult = await supabase.from('hostel_rooms').select('room_no,floor,capacity,room_type').eq('id', hostelRow.room_id).maybeSingle()
    if (roomResult.error) console.error(`loadFullProfile(${student.name || id}): hostel_rooms lookup failed —`, roomResult.error.message)
    hostelRoom = roomResult.data || null
  }

  const presentCount = attRows.filter(r => r.status === 'Present').length
  const attendancePct = attRows.length ? Math.round((presentCount / attRows.length) * 100) : null

  const admFeeTotal = (admFeeCols.data || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  const flatFeeTotal = (admFlatFees.data || []).reduce((s, r) => s + Number(r.amount || 0), 0)
  const courseFeeTotal = (admCourseFees.data || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0)

  return {
    admission: admission.data || null,
    fees: { admFeeCols: admFeeCols.data || [], admFlatFees: admFlatFees.data || [], admCourseFees: admCourseFees.data || [], total: admFeeTotal + flatFeeTotal + courseFeeTotal },
    attendance: { records: attRows, presentCount, totalMarked: attRows.length, pct: attendancePct },
    exams: examMarks.data || [],
    hostel: hostelRow ? { ...hostelRow, hostel_rooms: hostelRoom } : null,
    housemaster: housemaster.data || null,
    houseOccupancy: houseOccupancy.count,
    discipline: disciplineRecs.data || [],
    sickbay: sickbayRecs.data || [],
    leave: leaveRecs.data || [],
    gatePasses: gatePasses.data || [],
    enquiries: enquiries.data || [],
    parentItems: parentItems.data || [],
    complaints: complaints.data || [],
  }
}