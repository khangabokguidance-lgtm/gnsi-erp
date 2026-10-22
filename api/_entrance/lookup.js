// POST /api/entrance/lookup  { applicationNo, dob }  → status and everything the admit card / confirmation slip shows.
import { db, send, only, body, findCandidate, BUCKET } from './_lib.js'
import { admitCardState, feeFor } from '../../src/lib/entranceReg.js'

const signed = async path => {
  if (!path || /^https?:/.test(path)) return path || ''
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl || ''
}

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { applicationNo, dob } = body(req)
    const found = await findCandidate(applicationNo, dob)
    if (!found) return send(res, 404, { error: 'No application matches that number and date of birth.' })
    const { candidate: c, exam } = found
    const st = admitCardState(c, exam)
    const [photo, signature] = await Promise.all([signed(c.photo_url), signed(c.signature_url)])
    // Seat details are shown only once staff have issued the hall ticket.
    const issued = st.state === 'admit'
    return send(res, 200, {
      state: st.state, label: st.label, fee: feeFor(exam),
      candidate: {
        id: c.id, exam_id: c.exam_id, application_no: c.application_no, student_name: c.student_name, dob: c.dob, gender: c.gender, category: c.category,
        father_name: c.father_name, mother_name: c.mother_name, phone: c.phone, email: c.email, address: c.address, school: c.school,
        class_studying: c.class_studying, fee_status: c.fee_status, fee_ref: c.fee_ref, fee_paid_on: c.fee_paid_on, status: c.status,
        roll_number: issued ? c.roll_number : null, room: issued ? c.room : null, seat_no: issued ? c.seat_no : null, reg_details: c.reg_details || null,
      },
      exam: { id: exam.id, exam_name: exam.exam_name, exam_type: exam.exam_type, exam_date: exam.exam_date, exam_time: exam.exam_time, reporting_time: exam.reporting_time,
        duration_mins: exam.duration_mins, venue: exam.venue, class_target: exam.class_target, instructions: exam.instructions, application_fee: exam.application_fee },
      photo, signature,
    })
  } catch (e) {
    console.error('entrance/lookup', e)
    return send(res, 500, { error: 'Could not load the application.' })
  }
}
