// waiverDetect.js — find students who get a fee waiver or concession, from what
// the fee register shows for each fee type (course fee, flat fee, admission).
// Pure: the standard rate lookup is passed in.
//
// Recorded waivers (counted in the register):
//   approved  low-fee concession approved on a payment
//   standing  scholarship / concession in Fees → Register
//   custom    a month charged below the standard rate for the student's type
//             (a custom flat fee, or a lower fee set just for them)
//   writtenOff dues written off in Refunds & Transfers
//   repeater  admission fee waived for a repeater
//   pending   a low-fee concession still awaiting approval (no amount yet)
// Unrecorded: the same reduced amount paid in 2+ months, short of the fee, with
// no concession or custom fee on record. Those months keep showing as short, so
// the dues grow — a sign someone was promised a waiver that was never entered.

const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }
const sessionOf = (month, year) => {
  const m = MONTH_NUM[month], y = Number(year)
  if (!m || !y) return null
  const s = m >= 4 ? y : y - 1
  return `${s}-${s + 1}`
}
const r0 = n => Math.round((Number(n) || 0) * 100) / 100

// item: { student, reg, entries } as built by buildAllLedgers.
export function detectWaivers(item, rateOf) {
  const { student, reg } = item
  const by = { course: 0, flat: 0 }
  const sources = { approved: 0, standing: 0, custom: 0, writtenOff: r0(reg.writtenOff), pending: 0 }
  const months = []
  const shortGroups = new Map()
  for (const r of reg.rows) {
    if (r.status === 'before') continue
    const kind = r.head === 'Flat Fee' ? 'flat' : 'course'
    const approved = r0((r.paid || []).reduce((s, p) => s + (p.concession || 0), 0))
    const standing = r0(r.standingAmt || 0)
    const std = rateOf({ student, session: sessionOf(r.month, r.year), course: student.course || '', batch: student.batch || '', type: r.hostelType || student.hostel_type || 'Day Scholar', field: kind === 'flat' ? 'flat_fee' : 'course_fee' })
    const custom = std > 0 && r.expected > 0 && r.expected < std - 0.5 ? r0(std - r.expected) : 0
    const pending = (r.paid || []).filter(p => p.concessionStatus === 'pending').length
    if (approved || standing || custom || pending) {
      by[kind] += approved + standing + custom
      sources.approved += approved; sources.standing += standing; sources.custom += custom; sources.pending += pending
      months.push({ month: r.month, year: r.year, kind, approved, standing, custom, pending, standard: std || r.expected })
    }
    if (r.status === 'short' && !approved && !standing && !custom && r.paidAmt > 0) {
      const k = r0(r.paidAmt)
      if (!shortGroups.has(k)) shortGroups.set(k, { paid: k, fee: r.expected, months: [], shortBy: 0 })
      const g = shortGroups.get(k); g.months.push(`${r.month.slice(0, 3)} ${r.year}`); g.shortBy += r.shortBy
    }
  }
  const unrecorded = [...shortGroups.values()].filter(g => g.months.length >= 2).map(g => ({ ...g, shortBy: r0(g.shortBy) }))
  const repeater = !!student.is_repeater
  const waived = r0(sources.approved + sources.standing + sources.custom + sources.writtenOff)
  if (!waived && !sources.pending && !repeater && !unrecorded.length) return null
  return { student, waived, byType: { course: r0(by.course), flat: r0(by.flat) }, sources, repeater, months, unrecorded }
}

export const SOURCE_LABEL = { approved: 'Approved concession', standing: 'Standing scholarship', custom: 'Custom / lower fee', writtenOff: 'Dues written off', pending: 'Concession pending', repeater: 'Repeater (admission waived)' }

// The tags to show for one detected student.
export function waiverTags(d) {
  const t = []
  if (d.sources.approved) t.push('approved')
  if (d.sources.standing) t.push('standing')
  if (d.sources.custom) t.push('custom')
  if (d.sources.writtenOff) t.push('writtenOff')
  if (d.sources.pending) t.push('pending')
  if (d.repeater) t.push('repeater')
  return t
}
