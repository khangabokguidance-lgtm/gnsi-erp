// courseModePrint.js — the printable A4 approval form for a course / hostel type
// change request, with signature boxes for the requester, the admin and the parent.
import { receiptHeader, infoGrid, receiptSheet, receiptDocument, openReceiptWindow, esc } from './premiumReceipt'
import { changeLines, monthLabel, STATUS } from './lib/courseModeChange'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const when = t => t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const APPROVAL_FORM_CSS = `
  .chg th{background:#F1F5F9;border:1px solid #DCE3EC;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#334155;padding:6px 9px;text-align:left}
  .chg td{border:1px solid #DCE3EC;padding:8px 9px;font-size:12.5px}
  .chg td.to{font-weight:800;color:#0B1E3D}
  .sec{margin-top:12px;font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7A5A14}
  .box{margin-top:5px;border:1px solid #DCE3EC;border-radius:6px;padding:8px 11px;font-size:12px;line-height:1.55}
  .st{display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.08em}
  .sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:auto;padding-top:26px}
  .sigs .s{text-align:center}
  .sigs .ln{border-top:1px solid #0F172A;margin-top:46px;padding-top:4px;font-size:11px;font-weight:800;color:#0F172A}
  .sigs .sub{font-size:9.5px;color:#64748B;margin-top:2px}
  .rule{font-size:9.5px;color:#64748B;line-height:1.6;margin-top:10px}
`

export function approvalFormSheet(r) {
  const st = STATUS[r.status] || STATUS.pending
  const lines = changeLines(r).map(l => `<tr><td>${esc(l.what)}</td><td>${esc(l.from)}</td><td class="to">${esc(l.to)}</td></tr>`).join('')
  const f = r.fee_impact
  const impact = f && f.before ? `
    <table class="chg" style="margin-top:5px"><thead><tr><th>Monthly fee</th><th class="r">Before</th><th class="r">After</th></tr></thead><tbody>
      <tr><td>Course fee</td><td class="r mono">${inr(f.before.course)}</td><td class="r mono">${inr(f.after.course)}</td></tr>
      <tr><td>Flat (hostel / day) fee</td><td class="r mono">${inr(f.before.flat)}</td><td class="r mono">${inr(f.after.flat)}</td></tr>
      <tr><td><b>Total a month</b></td><td class="r mono"><b>${inr(f.before.total)}</b></td><td class="r mono"><b>${inr(f.after.total)}</b></td></tr>
    </tbody></table>
    <div class="box">${f.monthsAffected} month${f.monthsAffected === 1 ? '' : 's'} affected (${esc(f.firstMonth)} – ${esc(f.lastMonth)}): ${f.perMonth === 0 ? 'no change in the monthly fee.' : `${f.perMonth > 0 ? 'more' : 'less'} by <b>${inr(Math.abs(f.perMonth))}</b> a month, <b>${inr(Math.abs(f.total))}</b> ${f.perMonth > 0 ? 'extra' : 'less'} for the rest of the session.`}</div>`
    : '<div class="box">Fee impact was not recorded with this request — see the student\'s fee ledger.</div>'
  const decided = r.status === 'pending' ? '' : `
    <div class="sec">Decision</div>
    <div class="box"><span class="st" style="background:${st.bg};color:${st.color}">${esc(st.label.toUpperCase())}</span>
      &nbsp; by <b>${esc(r.decided_by || '—')}</b>${r.decider_email ? ` (${esc(r.decider_email)})` : ''} on ${esc(when(r.decided_at))}${r.decision_note ? `<br/>Note: ${esc(r.decision_note)}` : ''}</div>`
  const inner = `${receiptHeader('COURSE / HOSTEL TYPE CHANGE — APPROVAL FORM', r.form_no || 'REQUEST')}
    <div class="wrap">
      ${infoGrid([
        [['Form No.', `<span class="mono">${esc(r.form_no || '—')}</span>`], ['Student', esc(r.student_name || '—'), 2], ['GCC No.', `<span class="mono">${esc(r.gcc_no || '—')}</span>`]],
        [['Change starts', esc(monthLabel(r.effective_from)), 2], ['Status', `<span class="st" style="background:${st.bg};color:${st.color}">${esc(st.label)}</span>`, 2]],
        [['Requested by', esc(r.requested_by || '—'), 2], ['Requested on', esc(when(r.created_at)), 2]],
      ])}
      <div class="sec">Change</div>
      <table class="chg" style="margin-top:5px"><thead><tr><th>What</th><th>From</th><th>To</th></tr></thead><tbody>${lines}</tbody></table>
      <div class="sec">Reason</div>
      <div class="box">${esc(r.reason || '—')}</div>
      <div class="sec">Fee impact</div>
      ${impact}
      ${decided}
      <div class="rule">Months before ${esc(monthLabel(r.effective_from))} keep the old course / hostel type and their fees. Payments and receipts already issued are not changed; any extra paid or still due carries forward on the student's fee ledger. The change applies only after an admin approves it.</div>
      <div class="sigs">
        <div class="s"><div class="ln">Requested by</div><div class="sub">${esc(r.requested_by || '')}</div></div>
        <div class="s"><div class="ln">Approved by (Admin)</div><div class="sub">${r.status === 'approved' ? esc(r.decided_by || '') : 'Name, signature &amp; seal'}</div></div>
        <div class="s"><div class="ln">Parent / Guardian</div><div class="sub">Name &amp; signature</div></div>
      </div>
    </div>`
  return receiptSheet(inner)
}

export function printApprovalForm(r) {
  const title = `Approval form ${r.form_no || ''}`.trim()
  openReceiptWindow(title, receiptDocument(title, approvalFormSheet(r), { extraCss: APPROVAL_FORM_CSS }), { autoPrint: false })
}

