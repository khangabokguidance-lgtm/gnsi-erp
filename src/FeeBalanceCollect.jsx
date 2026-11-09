// FeeBalanceCollect.jsx — collect the balance of a month that was part-paid.
// Lists this session's flat/course months that have a payment but still owe
// money (same figures as the dues engine) and records the top-up as a separate
// row (collectFee item.isBalance) instead of being skipped as "already paid".
import { useEffect, useState } from 'react'
import { getStudentDues } from './feeDues'
import { getSessionYear } from './feeEngine'

export default function FeeBalanceCollect({ student, saving, disabled, onCollect }) {
  const [months, setMonths] = useState(null)   // null = loading
  const [amts, setAmts] = useState({})
  const [err, setErr] = useState('')

  const load = () => {
    getStudentDues(student, getSessionYear(), { withArrears: false }).then(d => {
      const part = (kind, items) => (items || []).filter(i => i.due > 0 && i.paidAmount > 0).map(i => ({ ...i, kind }))
      setMonths(d ? [...part('course', d.courseFee.items), ...part('flat', d.flatFee.items)] : [])
      setAmts({})
    }).catch(e => { setErr(e.message || 'Could not load dues'); setMonths([]) })
  }
  useEffect(load, [student.gcc_no])   // eslint-disable-line react-hooks/exhaustive-deps

  if (months === null) return <div style={{ padding: 16, fontSize: 13 }}>Loading part-paid months…</div>
  if (!months.length) return <div style={{ padding: 16, fontSize: 13 }}>{err || 'No part-paid months — nothing to complete.'}</div>

  const key = m => `${m.kind}|${m.month}|${m.year}`
  const chosen = months.filter(m => Number(amts[key(m)]) > 0)
  const over = chosen.find(m => Number(amts[key(m)]) > m.due + 0.5)
  const go = async () => {
    setErr('')
    try {
      await onCollect(chosen.map(m => ({ kind: m.kind, month: m.month, year: m.year, amount: Number(amts[key(m)]), isBalance: true, standardAmount: m.expected })))
      load()
    } catch (e) { setErr(e.message || 'Failed to save.') }
  }
  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ fontSize: 12, marginBottom: 8 }}>Months paid in part. Enter what is being paid now (up to the balance).</div>
      {months.map(m => (
        <div key={key(m)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #eee', fontSize: 13 }}>
          <div style={{ flex: 1 }}>{m.kind === 'flat' ? 'Flat' : 'Course'} fee — {m.month} {m.year}
            <div style={{ fontSize: 11, opacity: .7 }}>Fee ₹{m.expected.toLocaleString('en-IN')} · paid ₹{m.paidAmount.toLocaleString('en-IN')}{m.waived ? ` · waived ₹${m.waived.toLocaleString('en-IN')}` : ''} · balance ₹{m.due.toLocaleString('en-IN')}</div></div>
          <input type="number" min="0" max={m.due} placeholder={String(m.due)} value={amts[key(m)] ?? ''}
            onChange={e => setAmts(a => ({ ...a, [key(m)]: e.target.value }))} style={{ width: 100, padding: 6 }} />
          <button type="button" onClick={() => setAmts(a => ({ ...a, [key(m)]: String(m.due) }))} style={{ fontSize: 11 }}>Full</button>
        </div>
      ))}
      {over && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{over.month} {over.year}: more than the ₹{over.due.toLocaleString('en-IN')} balance.</div>}
      {err && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{err}</div>}
      <button type="button" onClick={go} disabled={disabled || saving || !chosen.length || !!over}
        style={{ marginTop: 12, padding: '10px 18px', fontWeight: 800 }}>
        {saving ? '⏳ Saving…' : `🖨️ Record balance${chosen.length ? ` (₹${chosen.reduce((t, m) => t + Number(amts[key(m)]), 0).toLocaleString('en-IN')})` : ''} & Print Receipt`}
      </button>
    </div>
  )
}
