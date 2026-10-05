// Pure helpers behind the "patient chart" panel in Student 360.
// No React / Supabase imports so they can be unit-tested with `npm test`.

const closed = s => ['resolved', 'closed'].includes(String(s || '').toLowerCase())

const day = v => {
  if (!v) return null
  const d = String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

// 0 (healthy) – 100 (needs attention). Weights are deliberately simple so an
// admin can explain every point of the score from the reasons list.
export function computeRiskIndex({ profile, dues, student } = {}) {
  const reasons = []
  let score = 0
  const add = (pts, text) => { score += pts; reasons.push({ pts, text }) }

  const pct = profile?.attendance?.pct
  if (pct != null && profile?.attendance?.totalMarked >= 5) {
    if (pct < 60) add(30, `Attendance ${pct}% (below 60%)`)
    else if (pct < 75) add(18, `Attendance ${pct}% (below 75%)`)
  }
  const due = Number(dues?.totalDue) || 0
  if (due > 0) add(due >= 10000 ? 25 : 15, `Fee due ₹${due.toLocaleString('en-IN')}`)
  const openDisc = (profile?.discipline || []).filter(d => !closed(d.status)).length
  if (openDisc) add(Math.min(20, 8 * openDisc), `${openDisc} open discipline record(s)`)
  const openComp = (profile?.complaints || []).filter(c => !closed(c.status)).length
  if (openComp) add(Math.min(10, 5 * openComp), `${openComp} open complaint(s)`)
  if ((profile?.sickbay || []).some(s => s.status === 'Admitted')) add(10, 'Currently in sickbay')
  if (student?.status && student.status !== 'Active') add(10, `Status: ${student.status}`)

  score = Math.min(100, score)
  const level = score >= 60 ? 'High' : score >= 30 ? 'Moderate' : 'Low'
  return { score, level, reasons }
}

// Checklist of follow-ups, like a care plan: what should someone do next?
// `target` is the App.jsx page id that handles the item.
export function buildActionItems({ profile, dues, student } = {}) {
  const items = []
  const due = Number(dues?.totalDue) || 0
  if (due > 0) items.push({ key: 'fees', target: 'fees', module: 'Fees', text: `Contact guardian about ₹${due.toLocaleString('en-IN')} fee due` })
  const pct = profile?.attendance?.pct
  if (pct != null && profile?.attendance?.totalMarked >= 5 && pct < 75) items.push({ key: 'att', target: 'attendance', module: 'Attendance', text: `Attendance ${pct}% — speak to class teacher` })
  const openDisc = (profile?.discipline || []).filter(d => !closed(d.status)).length
  if (openDisc) items.push({ key: 'disc', target: 'hostel', module: 'Discipline', text: `Resolve ${openDisc} open discipline record(s)` })
  const pendingLeave = (profile?.leave || []).filter(l => String(l.status || '').toLowerCase() === 'pending').length
  if (pendingLeave) items.push({ key: 'leave', target: 'leave', module: 'Leave', text: `Decide ${pendingLeave} pending leave request(s)` })
  if ((profile?.gatePasses || []).some(g => g.status === 'Issued')) items.push({ key: 'gate', target: 'reception', module: 'Gate Pass', text: 'Student is out on a gate pass — confirm return' })
  if (student?.house && !profile?.hostel) items.push({ key: 'hostel', target: 'hostel', module: 'Hostel', text: 'House set but no hostel allocation on record' })
  return items
}

// One chronological feed across modules, newest first.
export function buildTimeline({ profile, student } = {}, limit = 15) {
  const ev = []
  const push = (date, module, title) => { const d = day(date); if (d) ev.push({ date: d, module, title }) }

  push(student?.admission_date, 'Admission', 'Admitted')
  push(student?.left_date, 'Admission', 'Left school')
  for (const f of [...(profile?.fees?.admFeeCols || []), ...(profile?.fees?.admFlatFees || []), ...(profile?.fees?.admCourseFees || [])]) {
    const amt = Number(f.amount ?? f.paid_amount ?? f.total)
    push(f.pay_date, 'Fees', Number.isFinite(amt) ? `Fee payment ₹${amt.toLocaleString('en-IN')}` : 'Fee payment')
  }
  for (const e of profile?.exams || []) push(e.exam_date, 'Exams', `${e.subject || 'Exam'}: ${e.marks_obtained ?? '—'}`)
  for (const d of profile?.discipline || []) push(d.date, 'Discipline', d.status ? `Discipline record (${d.status})` : 'Discipline record')
  for (const s of profile?.sickbay || []) push(s.date, 'Sickbay', s.status ? `Sickbay: ${s.status}` : 'Sickbay visit')
  for (const l of profile?.leave || []) push(l.from_date, 'Leave', l.status ? `Leave (${l.status})` : 'Leave')
  for (const g of profile?.gatePasses || []) push(g.created_at, 'Gate Pass', g.status ? `Gate pass (${g.status})` : 'Gate pass')
  for (const c of profile?.complaints || []) push(c.created_at, 'Complaints', c.status ? `Complaint (${c.status})` : 'Complaint')
  if (profile?.hostel) push(profile.hostel.created_at, 'Hostel', 'Hostel allocation')

  ev.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return ev.slice(0, limit)
}
