// GET /api/entrance/exam?id=<exam id>  → the public details of one exam (for the registration page)
// GET /api/entrance/exam?open=1        → exams currently taking applications
import { db, send, only, EXAM_FIELDS } from './_lib.js'
import { registrationWindow } from './entranceReg.js'

export default async function handler(req, res) {
  if (!only(req, res, 'GET')) return
  try {
    if (req.query?.id) {
      const { data } = await db().from('entrance_exams').select(EXAM_FIELDS).eq('id', String(req.query.id)).maybeSingle()
      if (!data) return send(res, 404, { error: 'Exam not found' })
      return send(res, 200, { exam: data, window: registrationWindow(data) })
    }
    const { data } = await db().from('entrance_exams').select(EXAM_FIELDS).order('exam_date', { ascending: true })
    return send(res, 200, { exams: (data || []).filter(e => registrationWindow(e).open) })
  } catch (e) {
    console.error('entrance/exam', e)
    return send(res, 500, { error: 'Could not load the exam' })
  }
}
