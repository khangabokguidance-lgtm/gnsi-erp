// examBatchKey.js — a student's exam batch key (UDAAN, PRAGATI, ACHIEVER,
// "LAKSHYA - A", …), shared by Exams and the Parents Portal so both find the
// same exam_schedule rows, max marks and classmates.
//
// StudentDB (Attendance → Student DB) writes students.batch in its own
// spelling ("Achiever", "Lakshya A", "Udaan", "—" for Combined Course);
// students.class_name is a free-text section ("9A", "ENG") and is not the
// exam batch. Exams' courseSubjects keys are the all-caps spelling with
// Lakshya split ("LAKSHYA - A"), so the batch is translated here.
import { canonicalBatch, isStandardBatch } from './courseMap.js'

export const COMBINED_COURSE_BATCH_LABEL = 'Combined Navodaya Course (Sainik Appearing Group)'

const STUDENTDB_BATCH_TO_EXAM_KEY = {
  ACHIEVER: 'ACHIEVER',
  LEADER: 'LEADER',
  CHAMPION: 'CHAMPION',
  UMEED: 'UMEED',
  'LAKSHYA A': 'LAKSHYA - A',
  'LAKSHYA B': 'LAKSHYA - B',
  PRAGATI: 'PRAGATI',
  UDAAN: 'UDAAN',
  // Old names of these two batches, in case a record still carries them.
  PRIME: 'PRAGATI',
  ELITE: 'UDAAN',
}

/** A StudentDB batch value as its exam key ("Udaan — ENG" → UDAAN). */
export function batchToCourseSubjectsKey(batch) {
  const b = (batch || '').trim().toUpperCase()
  if (!b || b === '—') return COMBINED_COURSE_BATCH_LABEL
  if (STUDENTDB_BATCH_TO_EXAM_KEY[b]) return STUDENTDB_BATCH_TO_EXAM_KEY[b]
  // Other spellings of a standard batch: "Udaan — ENG", "LAKSHYA - A", " udaan ".
  const std = canonicalBatch(batch)
  return (isStandardBatch(std) && STUDENTDB_BATCH_TO_EXAM_KEY[std.toUpperCase()]) || batch || ''
}

/** A student's exam batch key, from batch (or the batch name left in class_name). */
export function examKeyFor(s) {
  // An older record with no batch but the batch name in class_name
  // ("Udaan", "Elite") still belongs to that batch.
  const classBatch = !s?.batch && isStandardBatch(canonicalBatch(s?.class_name)) ? s.class_name : ''
  const rawBatch = (s?.course === 'Combined Course' && (!s?.batch || s.batch === '—'))
    ? COMBINED_COURSE_BATCH_LABEL
    : (s?.batch || classBatch)
  return batchToCourseSubjectsKey(rawBatch)
}
