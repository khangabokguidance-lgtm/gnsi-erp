// concessionPrint.js — the printable A4 approval form for a Concession / Special
// Fee (FCR-YYYY-NNNN) with signature boxes, and the concessions-by-course report.
import { receiptHeader, infoGrid, receiptSheet, receiptDocument, openReceiptWindow, esc } from './premiumReceipt'
import { STATUS, stateOf, describe, monthLabel, appliesLabel, isFullWaiver, monthlyValue } from './lib/concessionPlan'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const when = t => t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const CSS = `
  .chg th{background:#F1F5F9;border:1px solid #DCE3EC;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#334155;padding:6px 9px;text-align:left}
  .chg td{border:1px solid #DCE3EC;padding:8px 9px;font-size:12.5px}
  .chg .r{text-align:right}
  .sec{margin-top:12px;font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7A5A14}
  .box{margin-top:5px;border:1px solid #DCE3EC;border-radius:6px;padding:8px 11px;font-size:12px;line-height:1.55}
  .warn{border-color:#FCA5A5;background:#FEF2F2;color:#991B1B;font-weight:700}
  .st{display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.08em}
  .sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:auto;padding-top:26px}
  .sigs .s{text-align:center}
  .sigs .ln{border-top:1px solid #0F172A;margin-top:46px;padding-top:4px;font-size:11px;font-weight:800;color:#0F172A}
  .sigs .sub{font-size:9.5px;color:#64748B;margin-top:2px}
  .rule{font-size:9.5px;color:#64748B;line-height:1.6;margin-top:10px}
`

function formSheet(r) {
  const sk = stateOf(r)
  const st = STATUS[sk] || STATUS.pending
  const f = r.fee_impact
  const full = isFullWaiver(r, f ? { course: f.course?.std, flat: f.flat?.std } : null)
  const impact = f && f.course ? `
    <table class="chg" style="margin-top:5px"><thead><tr><th>Fee</th><th class="r">Standard</th><th class="r">After concession</th><th class="r">Less by</th></tr></thead><tbody>
      <tr><td>Course fee (a month)</td><td class="r mono">${inr(f.course.std)}</td><td class="r mono"><b>${inr(f.course.after)}</b></td><td class="r mono">${inr(f.course.std - f.course.after)}</td></tr>
      <tr><td>Flat (hostel / day) fee</td><td class="r mono">${inr(f.flat.std)}</td><td class="r mono"><b>${inr(f.flat.after)}</b></td><td class="r mono">${inr(f.flat.std - f.flat.after)}</td></tr>
    </tbody></table>${f.oneTime ? `<div class="box">One-time concession of <b>${inr(f.oneTime)}</b> in ${esc(monthLabel(r.valid_from))}.</div>` : ''}`
    : '<div class="box">Fee before / after was not recorded with this entry — see the student\'s fee ledger.</div>'
  const decided = !r.decided_at ? '' : `
    <div class="sec">Decision</div>
    <div class="box"><span class="st" style="background:${st.bg};color:${st.color}">${esc((r.status === 'rejected' ? 'Rejected' : 'Approved').toUpperCase())}</span>
      &nbsp; by <b>${esc(r.decided_by || '—')}</b>${r.decider_email ? ` (${esc(r.decider_email)})` : ''} on ${esc(when(r.decided_at))}${r.decision_note ? `<br/>Note: ${esc(r.decision_note)}` : ''}</div>`
  const after = [
    r.ended_at ? `Ended from ${esc(monthLabel(r.valid_to))} on: ${esc(when(r.ended_at))} by ${esc(r.ended_by || '—')}` : '',
    r.status === 'revoked' ? `Cancelled on ${esc(when(r.revoked_at))} by ${esc(r.revoked_by || '—')}: ${esc(r.revoked_reason || '')}` : '',
  ].filter(Boolean)
  const inner = `${receiptHeader('CONCESSION / SPECIAL FEE — APPROVAL FORM', r.form_no || 'REQUEST')}
    <div class="wrap">
      ${infoGrid([
        [['Form No.', `<span class="mono">${esc(r.form_no || '—')}</span>`], ['Student', esc(r.student_name || '—'), 2], ['GCC No.', `<span class="mono">${esc(r.gcc || '—')}</span>`]],
        [['Course', esc(r.course || '—')], ['Batch', esc(r.batch || '—')], ['Hostel type', esc(r.hostel_type || '—')], ['Status', `<span class="st" style="background:${st.bg};color:${st.color}">${esc(st.label)}</span>`]],
        [['Category', esc(r.kind || '—')], ['Applies to', esc(appliesLabel(r.applies_to))], ['From', esc(monthLabel(r.valid_from))], ['Until', esc(monthLabel(r.valid_to))]],
        [['Requested by', esc(r.requested_by || '—'), 2], ['Requested on', esc(when(r.created_at)), 2]],
      ])}
      <div class="sec">Concession</div>
      <div class="box"><b>${esc(describe(r))}</b></div>
      ${full ? '<div class="box warn">FULL WAIVER — the fee becomes ₹0 for the months covered. Needs the admin\'s approval note.</div>' : ''}
      <div class="sec">Reason</div>
      <div class="box">${esc(r.reason || '—')}</div>
      <div class="sec">Fee before / after</div>
      ${impact}
      ${decided}
      ${after.length ? `<div class="sec">Later changes</div><div class="box">${after.join('<br/>')}</div>` : ''}
      <div class="rule">The student stays in the same course. The full fee is still billed each month; the concession is shown as a separate line on the fee ledger and lowers what is due only for the months above, and only after an admin approves it. Payments and receipts already issued are not changed. An approved concession can't be edited — it can be ended from a month, or cancelled with a reason.</div>
      <div class="sigs">
        <div class="s"><div class="ln">Requested by</div><div class="sub">${esc(r.requested_by || '')}</div></div>
        <div class="s"><div class="ln">Approved by (Admin)</div><div class="sub">${r.status !== 'pending' && r.status !== 'rejected' && r.decided_by ? esc(r.decided_by) : 'Name, signature &amp; seal'}</div></div>
        <div class="s"><div class="ln">Parent / Guardian</div><div class="sub">Name &amp; signature</div></div>
      </div>
    </div>`
  return receiptSheet(inner)
}

export function printConcessionForm(r) {
  const title = `Concession form ${r.form_no || ''}`.trim()
  openReceiptWindow(title, receiptDocument(title, formSheet(r), { extraCss: CSS }), { autoPrint: false })
}

// rows: register entries already filtered to what the report should show; groups from courseReport().
export function printConcessionReport({ groups, rows, courseOf, title = 'Concessions by course' }) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const summary = `<table class="chg" style="margin-top:5px"><thead><tr><th>Course</th><th class="r">Students</th><th class="r">Active concessions</th><th class="r">Course fee given up / month</th><th class="r">Waiting for approval</th></tr></thead><tbody>
    ${groups.map(g => `<tr><td><b>${esc(g.course)}</b></td><td class="r">${g.students}</td><td class="r">${g.entries}</td><td class="r mono">${inr(g.monthly)}</td><td class="r">${g.pending || ''}</td></tr>`).join('')}
    <tr><td><b>Total</b></td><td class="r"><b>${groups.reduce((t, g) => t + g.students, 0)}</b></td><td class="r"><b>${groups.reduce((t, g) => t + g.entries, 0)}</b></td><td class="r mono"><b>${inr(groups.reduce((t, g) => t + g.monthly, 0))}</b></td><td class="r"><b>${groups.reduce((t, g) => t + g.pending, 0) || ''}</b></td></tr>
  </tbody></table>`
  const detail = groups.map(g => {
    const list = rows.filter(r => (courseOf(r) || 'Unassigned') === g.course)
    if (!list.length) return ''
    return `<div class="sec">${esc(g.course)}</div><table class="chg" style="margin-top:5px"><thead><tr><th>Form</th><th>Student</th><th>Category</th><th>Concession</th><th>From – until</th><th class="r">Less / month</th><th>Status</th></tr></thead><tbody>
      ${list.map(r => `<tr><td class="mono">${esc(r.form_no || '')}</td><td>${esc(r.student_name || '')} <span class="mono">(${esc(r.gcc)})</span></td><td>${esc(r.kind)}</td><td>${esc(describe(r))}</td><td>${esc(monthLabel(r.valid_from))} – ${esc(monthLabel(r.valid_to))}</td><td class="r mono">${inr(monthlyValue(r))}</td><td>${esc((STATUS[stateOf(r)] || {}).label || r.status)}</td></tr>`).join('')}
    </tbody></table>`
  }).join('')
  const inner = `${receiptHeader(title.toUpperCase(), today)}<div class="wrap">${summary}${detail}
    <div class="rule">Active and approved concessions (and requests waiting for approval). "Less / month" is the course fee given up each month, worked out when the concession was requested.</div></div>`
  openReceiptWindow(title, receiptDocument(title, receiptSheet(inner), { extraCss: CSS }), { autoPrint: false })
}
