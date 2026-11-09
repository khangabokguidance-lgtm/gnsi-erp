// POST /api/entrance?action=adm-submit { form, photo } → { reference, fee }
// Validates with the same rules as the browser, stores the photograph, numbers the application and saves it.
// The fee comes from fee_structures for the chosen course / batch / hostel — never from the browser.
import { db, send, only, body, BUCKET } from './_deps.js'
import { openSession, feeOptions, logEvent } from './_common.js'
import { validateApplication, applicationColumns, formSnapshot, portalFee, referenceNo, nextReferenceSeq, MAX_PHOTO_KB } from './portalApply.js'

const rand = () => Math.random().toString(36).slice(2, 8)
const parsePhoto = s => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''))
  if (!m) return null
  const buffer = Buffer.from(m[2], 'base64')
  return buffer.length && buffer.length <= MAX_PHOTO_KB * 1024 * 1.6 ? { buffer, type: m[1] } : null
}

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { form = {}, photo } = body(req)
    const session = await openSession()
    if (!session) return send(res, 409, { error: 'Admissions are not open right now.' })
    const options = await feeOptions(session)
    const img = parsePhoto(photo)
    const errors = validateApplication(form, options, { hasPhoto: !!img })
    if (Object.keys(errors).length) return send(res, 400, { error: 'Please correct the highlighted fields', errors })

    const cols = applicationColumns(form)
    const { data: same } = await db().from('portal_applications').select('reference_no, student_name, status').eq('session', session).eq('dob', cols.dob).eq('phone', cols.phone)
    const dup = (same || []).find(r => r.student_name.toLowerCase() === cols.student_name.toLowerCase() && !['Rejected', 'Withdrawn'].includes(r.status))
    if (dup) return send(res, 409, { error: 'An application for this student is already on file.', duplicate: true, reference: dup.reference_no })

    const fee = portalFee(options, form)
    const year = parseInt(session, 10) || new Date().getFullYear()
    let saved = null, lastErr = null
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const { data: last } = await db().from('portal_applications').select('reference_no').like('reference_no', `AP${String(year).slice(-2)}-%`).order('reference_no', { ascending: false }).limit(1)
      const ref = referenceNo(year, nextReferenceSeq(last || [], year) + attempt)
      const { data, error } = await db().from('portal_applications').insert({
        ...cols, reference_no: ref, session, status: 'Submitted', form: formSnapshot(form),
        fee_amount: fee, fee_status: fee > 0 ? 'Unpaid' : 'Waived', source: 'online',
      }).select().single()
      if (!error) { saved = data; break }
      lastErr = error
      if (error.code !== '23505') break          // 23505 = reference number taken by a simultaneous applicant → try the next one
    }
    if (!saved) return send(res, 500, { error: 'Could not save the application: ' + (lastErr?.message || 'please try again') })

    const path = `applications/${saved.reference_no}/photo-${Date.now()}-${rand()}.${img.type.split('/')[1]}`
    const up = await db().storage.from(BUCKET).upload(path, img.buffer, { contentType: img.type, upsert: false })
    if (up.error) {
      await db().from('portal_applications').delete().eq('id', saved.id)
      return send(res, 500, { error: 'Could not store the photograph: ' + up.error.message })
    }
    await db().from('portal_applications').update({ photo_path: path }).eq('id', saved.id)
    await logEvent(saved.id, 'applicant', 'submitted', `Online application for ${cols.course} · ${cols.batch} · ${cols.hostel_type}`)
    return send(res, 200, { ok: true, reference: saved.reference_no, fee })
  } catch (e) {
    console.error('adm-submit', e)
    return send(res, 500, { error: 'Could not submit the application — please try again.' })
  }
}
