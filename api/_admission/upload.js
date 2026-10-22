// POST /api/entrance?action=adm-upload { reference, dob, docType, fileName, file } — one document (JPG/PNG/WebP/PDF).
import { db, send, only, body, BUCKET } from './_deps.js'
import { findApplication, isOpen, logEvent } from './_common.js'
import { DOC_TYPES, MAX_DOC_KB, docLabel } from './portalApply.js'

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { reference, dob, docType, fileName, file } = body(req)
    const a = await findApplication(reference, dob)
    if (!a) return send(res, 404, { error: 'No application matches that reference and date of birth.' })
    if (!isOpen(a)) return send(res, 409, { error: 'This application is closed — documents can no longer be added.' })
    if (!DOC_TYPES.some(t => t.key === docType)) return send(res, 400, { error: 'Unknown document type' })
    const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(file || ''))
    if (!m) return send(res, 400, { error: 'Upload a JPG, PNG, WebP or PDF file.' })
    const buffer = Buffer.from(m[2], 'base64')
    if (!buffer.length || buffer.length > MAX_DOC_KB * 1024) return send(res, 400, { error: `File is too large (limit ${MAX_DOC_KB} KB).` })

    const { data: mine } = await db().from('portal_application_docs').select('id').eq('application_id', a.id).eq('doc_type', docType)
    if ((mine || []).length >= 4) return send(res, 409, { error: 'Too many files for this document — ask the office to clear a rejected one.' })

    const path = `applications/${a.reference_no}/${docType}-${Date.now()}.${EXT[m[1]]}`
    const up = await db().storage.from(BUCKET).upload(path, buffer, { contentType: m[1], upsert: false })
    if (up.error) return send(res, 500, { error: 'Could not store the file: ' + up.error.message })
    const { error } = await db().from('portal_application_docs').insert({
      application_id: a.id, doc_type: docType, storage_path: path, file_name: String(fileName || '').slice(0, 120) || null, mime: m[1], size_bytes: buffer.length,
    })
    if (error) { await db().storage.from(BUCKET).remove([path]).catch(() => {}); return send(res, 500, { error: 'Could not record the file: ' + error.message }) }
    if (a.status === 'Docs requested') await db().from('portal_applications').update({ status: 'Under review', updated_at: new Date().toISOString() }).eq('id', a.id)
    await logEvent(a.id, 'applicant', 'document_uploaded', docLabel(docType))
    return send(res, 200, { ok: true })
  } catch (e) {
    console.error('adm-upload', e)
    return send(res, 500, { error: 'Upload failed — please try again.' })
  }
}
