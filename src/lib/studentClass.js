// studentClass.js — which class a student is in, for the CBT result board.
//
//   Lakshya A · Lakshya B · Umeed          (Navodaya batches)
//   Achiever · Leader · Champion           (Sainik)      Pragati · Udaan  (Foundation)
//   Combined · Manipuri   /   Combined · English          (the Combined Course; the medium is a secondary-batch tag)
//
// It uses the same rules as the rest of the ERP (courseMap.js): the `batch` column first, then the course, then a batch
// name left in class_name. For the Combined Course the medium comes from the student's secondary batches
// ("Combined Navodaya Course(ENG)" / "(MM)", as set in Exams → Students), or ENG / MM written in batch / class_name.
import { canonicalBatch, isStandardBatch, courseOf } from '../courseMap.js'

export const CLASS_DEFS = [
  { key: 'lakshya-a', label: 'Lakshya A', course: 'Navodaya' },
  { key: 'lakshya-b', label: 'Lakshya B', course: 'Navodaya' },
  { key: 'umeed', label: 'Umeed', course: 'Navodaya' },
  { key: 'combined-mm', label: 'Combined · Manipuri', course: 'Combined Course' },
  { key: 'combined-eng', label: 'Combined · English', course: 'Combined Course' },
  { key: 'combined', label: 'Combined (medium not set)', course: 'Combined Course' },
  { key: 'lakshya', label: 'Lakshya (A/B not set)', course: 'Navodaya' },
  { key: 'achiever', label: 'Achiever', course: 'Sainik' },
  { key: 'leader', label: 'Leader', course: 'Sainik' },
  { key: 'champion', label: 'Champion', course: 'Sainik' },
  { key: 'pragati', label: 'Pragati', course: 'Foundation' },
  { key: 'udaan', label: 'Udaan', course: 'Foundation' },
  { key: 'unclassified', label: 'Not classified', course: '' },
  { key: 'guest', label: 'Guest / not in ERP', course: '' },
]
const BY_KEY = Object.fromEntries(CLASS_DEFS.map(d => [d.key, d]))
export const classDef = key => BY_KEY[key] || BY_KEY.unclassified
export const CLASS_ORDER = CLASS_DEFS.map(d => d.key)

const MEDIUM_MM = /\b(mm|man|manipuri|meitei|meiteilon)\b/i
const MEDIUM_ENG = /\b(eng|english)\b/i
/** 'mm' | 'eng' | '' from any text that names the medium. */
export function mediumOf(...texts) {
  for (const t of texts) {
    const s = String(t || '')
    if (!s) continue
    if (MEDIUM_MM.test(s)) return 'mm'
    if (MEDIUM_ENG.test(s)) return 'eng'
  }
  return ''
}

const BATCH_KEY = { 'Lakshya A': 'lakshya-a', 'Lakshya B': 'lakshya-b', Umeed: 'umeed', Lakshya: 'lakshya', Achiever: 'achiever', Leader: 'leader', Champion: 'champion', Pragati: 'pragati', Udaan: 'udaan' }

/**
 * @param student  an ERP students row (or null for someone not in the ERP)
 * @param secondaryTags  the student's secondary batch names, e.g. ['Combined Navodaya Course(ENG)']
 * @returns { key, label, course, medium, how }
 */
export function classifyStudent(student, secondaryTags = []) {
  if (!student) return { key: 'guest', label: BY_KEY.guest.label, course: '', medium: '', how: 'none' }
  const tags = (secondaryTags || []).map(String)
  const batch = canonicalBatch(student.batch)
  const fromClassName = !student.batch ? canonicalBatch(student.class_name) : ''
  const std = isStandardBatch(batch) ? batch : isStandardBatch(fromClassName) ? fromClassName : ''
  const combinedTag = tags.find(t => /combined/i.test(t))
  const course = courseOf(student)
  const isCombined = course === 'Combined Course' || /combined/i.test(student.batch || '') || (!std && !!combinedTag) || (!std && /^(—|-)?$/.test(String(student.batch || '').trim()) && course === 'Combined Course')
  if (isCombined && !(std && course !== 'Combined Course')) {
    const medium = mediumOf(combinedTag, ...tags, student.batch, student.class_name, student.section)
    const key = medium === 'mm' ? 'combined-mm' : medium === 'eng' ? 'combined-eng' : 'combined'
    return { key, label: BY_KEY[key].label, course: 'Combined Course', medium, how: combinedTag ? 'secondary' : 'student' }
  }
  if (std) { const key = BATCH_KEY[std]; return { key, label: BY_KEY[key].label, course: BY_KEY[key].course, medium: '', how: batch ? 'batch' : 'class_name' } }
  return { key: 'unclassified', label: BY_KEY.unclassified.label, course: course || '', medium: '', how: 'none' }
}
