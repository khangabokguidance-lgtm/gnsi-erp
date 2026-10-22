// GET /api/entrance?action=adm-options → { open, session, options:[{course,batch,hostel_type,admission_fee}], docTypes }
import { send, only } from './_deps.js'
import { openSession, feeOptions } from './_common.js'
import { DOC_TYPES } from './portalApply.js'

export default async function handler(req, res) {
  if (!only(req, res, 'GET')) return
  try {
    const session = await openSession()
    if (!session) return send(res, 200, { open: false, reason: 'Admissions are not open right now. Please check back later or contact the office.', options: [], docTypes: DOC_TYPES })
    return send(res, 200, { open: true, session, options: await feeOptions(session), docTypes: DOC_TYPES })
  } catch (e) {
    console.error('adm-options', e)
    return send(res, 500, { error: 'Could not load the admission form — please try again.' })
  }
}
