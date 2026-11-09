// POST /api/entrance?action=adm-lookup { reference, dob } → the applicant's own record: status, fee, documents, timeline, photo.
import { db, send, only, body, BUCKET } from './_deps.js'
import { findApplication } from './_common.js'

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { reference, dob } = body(req)
    const a = await findApplication(reference, dob)
    if (!a) return send(res, 404, { error: 'No application matches that reference and date of birth.' })
    const [{ data: docs }, { data: events }] = await Promise.all([
      db().from('portal_application_docs').select('id, doc_type, file_name, status, remark, created_at').eq('application_id', a.id).order('created_at'),
      db().from('portal_application_events').select('at, actor, action, detail').eq('application_id', a.id).neq('action', 'note').order('at'),
    ])
    let photo = ''
    if (a.photo_path) { const { data } = await db().storage.from(BUCKET).createSignedUrl(a.photo_path, 3600); photo = data?.signedUrl || '' }
    const { id, form, payment_order_id, reviewed_by, ...safe } = a
    return send(res, 200, { application: { ...safe, form: { ...form, aadhaar_last4: undefined } }, docs: docs || [], events: (events || []).map(e => ({ ...e, actor: e.actor === 'applicant' || e.actor === 'system' ? e.actor : 'office' })), photo })
  } catch (e) {
    console.error('adm-lookup', e)
    return send(res, 500, { error: 'Could not load the application — please try again.' })
  }
}
