// refundLedger.js — how recorded refunds / transfers / write-offs show on a student's
// account (pure; the rows come from fee_refunds). Only approved or paid requests count.
//   Refund to parent        paid          → debit  (money handed back)
//   Adjust to sibling GCC   approved/paid → debit on the source, credit on the target
//   Write-off dues          approved/paid → credit (also lowers the balance due)
//   Carry credit            → no line (informational)
const counted = r => r.status === 'approved' || r.status === 'paid'
const g = v => String(parseInt(v) || 0)
const dateOf = r => String(r.decided_at || r.created_at || '').slice(0, 10)

export function refundStatementLines(gcc, refunds = []) {
  const me = g(gcc), out = []
  for (const r of refunds) {
    const amount = Number(r.amount) || 0
    if (!(amount > 0) || !dateOf(r)) continue
    const isSource = g(r.gcc) === me
    if (r.kind === 'Refund to parent' && r.status === 'paid' && isSource)
      out.push({ date: dateOf(r), kind: 'adjustment', particulars: 'Refund paid to parent', debit: amount, credit: 0, note: r.reason })
    else if (r.kind === 'Adjust to sibling GCC' && counted(r)) {
      if (isSource) out.push({ date: dateOf(r), kind: 'adjustment', particulars: `Transferred to GCC-${r.target_gcc}`, debit: amount, credit: 0, note: r.reason })
      else if (g(r.target_gcc) === me) out.push({ date: dateOf(r), kind: 'adjustment', particulars: `Adjusted from GCC-${r.gcc}`, debit: 0, credit: amount, note: r.reason })
    } else if (r.kind === 'Write-off dues' && counted(r) && isSource)
      out.push({ date: dateOf(r), kind: 'adjustment', particulars: 'Dues written off', debit: 0, credit: amount, note: r.reason })
  }
  return out
}

// Total written off for this student in one session (`sessionOf` maps a date to '2026-2027').
export function writtenOffFor(gcc, refunds = [], session, sessionOf) {
  const me = g(gcc)
  return refunds.filter(r => r.kind === 'Write-off dues' && counted(r) && g(r.gcc) === me && sessionOf(dateOf(r)) === session)
    .reduce((t, r) => t + (Number(r.amount) || 0), 0)
}
