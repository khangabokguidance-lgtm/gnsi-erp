// POST /api/entrance/register  { examId, form, photo, signature }  → { applicationNo, fee }
// Validates with the same rules as the browser form, stores photo + signature in the private bucket,
// numbers the candidate, and saves the application (fee unpaid until Razorpay confirms it).
import { db, send, only, body, EXAM_FIELDS, BUCKET, parseDataUrl, insertTolerant } from './_lib.js'
import { registrationWindow, validateRegistration, candidatePayload, feeFor, MAX_PHOTO_KB, MAX_SIGN_KB } from '../../src/lib/entranceReg.js'
import { applicationNo, nextApplicationSeq, nextRoll } from '../../src/lib/entranceNumbers.js'

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }

const rand = () => Math.random().toString(36).slice(2, 8)

async function putImage(path, img) {
  const { error } = await db().storage.from(BUCKET).upload(path, img.buffer, { contentType: img.type, upsert: false })
  if (error) throw new Error('Could not store the image: ' + error.message)
  return path
}

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { examId, form = {}, photo, signature } = body(req)
    const { data: exam } = await db().from('entrance_exams').select(EXAM_FIELDS).eq('id', String(examId || '')).maybeSingle()
    if (!exam) return send(res, 404, { error: 'Exam not found' })
    const win = registrationWindow(exam)
    if (!win.open) return send(res, 409, { error: win.reason })

    const photoImg = parseDataUrl(photo, MAX_PHOTO_KB * 1024 * 1.6), signImg = parseDataUrl(signature, MAX_SIGN_KB * 1024 * 1.6)
    const errors = validateRegistration(form, exam, { assets: { photo: !!photoImg, signature: !!signImg } })
    if (Object.keys(errors).length) return send(res, 400, { error: 'Please correct the highlighted fields', errors })

    const payload = candidatePayload(form)
    // Same person registering twice (same name + date of birth + phone) → point to the existing application.
    const { data: same } = await db().from('entrance_candidates').select('application_no, student_name, dob, phone').eq('exam_id', exam.id).eq('phone', payload.phone).eq('dob', payload.dob)
    const dup = (same || []).find(r => String(r.student_name || '').trim().toLowerCase() === payload.student_name.toLowerCase())
    if (dup) return send(res, 409, { error: 'This candidate is already registered for this exam.', duplicate: true, applicationNo: dup.application_no })

    const stamp = `${Date.now()}-${rand()}`
    const photoPath = await putImage(`entrance/photos/${exam.id}/${stamp}.${photoImg.type.split('/')[1]}`, photoImg)
    const signPath = await putImage(`entrance/signatures/${exam.id}/${stamp}.${signImg.type.split('/')[1]}`, signImg)

    const fee = feeFor(exam)
    let saved = null, lastErr = null
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      // numbers come from what is already stored; a clash with a simultaneous registration is detected after the insert
      const { data: last } = await db().from('entrance_candidates').select('roll_number, application_no, exam_id').eq('exam_id', exam.id).order('roll_number', { ascending: false }).limit(1)
      const { data: lastApp } = await db().from('entrance_candidates').select('application_no, exam_id, roll_number').eq('exam_id', exam.id).order('application_no', { ascending: false }).limit(1)
      const roll = nextRoll(last || [], exam.id) + attempt
      const seq = nextApplicationSeq(lastApp || [], exam.id) + attempt
      const { data, error } = await insertTolerant('entrance_candidates', {
        ...payload, exam_id: exam.id, status: 'Registered', verified: false, roll_number: roll, application_no: applicationNo(exam, seq),
        photo_url: photoPath, signature_url: signPath, fee_status: fee > 0 ? 'Unpaid' : 'Waived', source: 'online',
      })
      if (error) { lastErr = error; break }
      const { data: clash } = await db().from('entrance_candidates').select('id, roll_number, application_no').eq('exam_id', exam.id).or(`roll_number.eq.${roll},application_no.eq.${data.application_no}`).order('id', { ascending: true })
      if ((clash || []).length > 1 && String(clash[0].id) !== String(data.id)) { await db().from('entrance_candidates').delete().eq('id', data.id); continue }   // someone else got the number first — try the next
      saved = data
    }
    if (!saved) {
      await db().storage.from(BUCKET).remove([photoPath, signPath]).catch(() => {})
      return send(res, 500, { error: lastErr ? 'Could not save the application: ' + lastErr.message : 'Could not allocate an application number — please try again.' })
    }
    return send(res, 200, { ok: true, applicationNo: saved.application_no, fee })
  } catch (e) {
    console.error('entrance/register', e)
    return send(res, 500, { error: 'Registration failed — please try again.' })
  }
}
