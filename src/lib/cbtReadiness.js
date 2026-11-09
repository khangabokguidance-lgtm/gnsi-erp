// cbtReadiness.js — "is this online exam ready?" for staff. Pure: the caller gathers the facts, this decides.
// status: 'ok' | 'warn' | 'bad'. A 'bad' means students would hit a problem; a 'warn' is worth a look.
import { flatQuestions } from './cbtEngine.js'

const phoneOf = s => [s.parent_phone, s.father_phone, s.mother_phone, s.guardian_phone, s.guardian_mobile].map(v => String(v || '').replace(/\D/g, '')).find(d => d.length >= 10) || ''
const active = s => !s.deleted_at && (!s.status || s.status === 'Active')

// probes: { extra: bool, district: bool, dobEntered: bool, guestsInfo: bool, studentDistrict: bool }  (true = present in the database)
export function readiness({ row, test, probes = {}, students = null, now = Date.now() }) {
  const out = []
  const add = (id, status, label, detail = '') => out.push({ id, status, label, detail })

  const missing = [
    !probes.extra && '20261062 (extra time)', !probes.guestsInfo && '20261064 (second check, guests)',
    !(probes.district && probes.studentDistrict) && '20261065 (district / gender / caste)', !probes.dobEntered && '20261066 (date of birth when missing)',
  ].filter(Boolean)
  missing.length
    ? add('db', 'bad', 'Database is not up to date', `Run supabase/CBT_NEW_SQL_061_to_066.sql in the Supabase SQL editor. Missing: ${missing.join(', ')}.`)
    : add('db', 'ok', 'Database is up to date', 'Migrations 062, 064, 065 and 066 are in place.')

  if (test) {
    const qs = flatQuestions(test)
    const noKey = qs.filter(q => !q.answer).map(q => q.no)
    noKey.length
      ? add('key', 'bad', 'Answer key is incomplete', `${noKey.length} of ${qs.length} questions have no answer (Q${noKey.slice(0, 8).join(', Q')}${noKey.length > 8 ? '…' : ''}). They would not be marked.`)
      : add('key', 'ok', 'Answer key is complete', `${qs.length} questions, all with an answer.`)
    const four = qs.filter(q => !q.figure && (q.options || []).length !== 4).length
    if (four) add('options', 'warn', 'Some questions do not have 4 options', `${four} question${four === 1 ? '' : 's'} — check the smart check in the builder.`)
    if (!(Number(test.durationMin) > 0)) add('duration', 'bad', 'Duration is not set')
  } else add('key', 'warn', 'Could not load the test to check the answer key')

  const code = String(row?.access_code || '').trim()
  code.length >= 6 ? add('code', 'ok', 'Access code is set', 'Share it only with the candidates.')
    : add('code', code ? 'warn' : 'bad', code ? 'Access code is short' : 'No access code', 'Candidates cannot look themselves up without one; use 6 or more characters.')

  if (row?.status === 'closed') add('status', 'warn', 'The exam is closed', 'Reopen it from the Online tab when the exam starts.')
  const opens = row?.opens_at ? Date.parse(row.opens_at) : null, closes = row?.closes_at ? Date.parse(row.closes_at) : null
  if (closes && closes < now) add('window', 'bad', 'The closing time has already passed')
  else if (opens || closes) add('window', 'ok', 'Open and close times are set')
  else add('window', 'warn', 'No open / close time', 'The exam is open whenever it is live. Set a window if you want it to start and stop on time.')

  if (students) {
    const act = students.filter(active)
    const noPhone = act.filter(s => !phoneOf(s)).length
    noPhone
      ? add('phones', 'bad', `${noPhone} active student${noPhone === 1 ? ' has' : 's have'} no parent number`, 'They cannot start the exam online until the number is added in Students.')
      : add('phones', 'ok', 'Every active student has a parent number', `${act.length} students checked.`)
  } else add('phones', 'warn', 'Could not check the students list')

  const m = test?.marking || {}
  if (m.guests) add('guests', 'warn', 'Guests are allowed', 'Guest mobile numbers are not verified by a one-time code, so share the access code only with people you trust.')
  add('settings', 'ok', 'Exam settings', [
    m.shuffle?.questions || m.shuffle?.options ? 'shuffling on' : 'shuffling off',
    m.proctor?.fullscreen && m.proctor.fullscreen !== 'off' ? `full screen: ${m.proctor.fullscreen}` : 'full screen not required',
    m.proctor?.camera && m.proctor.camera !== 'off' ? `camera: ${m.proctor.camera}` : 'camera off',
    Array.isArray(m.sectionMinutes) && m.sectionMinutes.some(x => x > 0) ? 'section timers on' : 'no section timers',
    Number(m.minMinutes) > 0 ? `earliest submit ${m.minMinutes} min` : 'no earliest-submit limit',
  ].join(' · '))
  return out
}

// Things only a person can confirm (the app cannot see them).
export const MANUAL_CHECKS = [
  'Supabase → Authentication: sign-ups are closed (or email confirmation is on).',
  'You have tried the exam link yourself on a real phone, including the practice test.',
  'A staff member is ready on the Live tab during the exam.',
  'Supabase has a recent backup (Settings → Database → Backups).',
]

export const summary = checks => ({ bad: checks.filter(c => c.status === 'bad').length, warn: checks.filter(c => c.status === 'warn').length })
